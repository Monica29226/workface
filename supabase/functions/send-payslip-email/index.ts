import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPayslipRequest {
  payrollLineId: string;
  companyId: string;
}

// Format currency for Costa Rica
function formatCurrency(amount: number, currency: string = 'CRC'): string {
  if (currency === 'CRC') {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { payrollLineId, companyId }: SendPayslipRequest = await req.json();

    console.log("Sending payslip for line:", payrollLineId);

    // Get payroll line with employee and batch info
    const { data: line, error: lineError } = await supabase
      .from('payroll_lines')
      .select(`
        *,
        employee:employees!inner(
          id,
          employee_id,
          full_name,
          work_email,
          hire_date,
          contract_type
        ),
        batch:payroll_batches!inner(
          id,
          batch_id,
          period_start,
          period_end,
          frequency
        )
      `)
      .eq('id', payrollLineId)
      .single();

    if (lineError || !line) {
      console.error("Line not found:", lineError);
      return new Response(
        JSON.stringify({ error: "Línea de planilla no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('display_name, tax_id, payroll_email_from, logo_url')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyError);
      return new Response(
        JSON.stringify({ error: "Empresa no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const employee = line.employee;
    const batch = line.batch;
    const periodStart = new Date(batch.period_start);
    const periodEnd = new Date(batch.period_end);
    const periodLabel = periodStart.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
    const currency = line.currency || 'CRC';

    // Calculate breakdown
    const grossSalary = Number(line.gross_salary);
    const ccssEmployee = grossSalary * 0.105;  // 10.5% CCSS employee
    const rentaEstimated = Number(line.deductions) - ccssEmployee; // Simplified
    const totalDeductions = Number(line.deductions);
    const netPay = Number(line.net_pay);
    const aguinaldo = Number(line.aguinaldo_accrued || 0);
    const vacationDays = Number(line.vacation_accrued_days || 0);

    // Build professional HTML email following MTSS Costa Rica format
    const companyName = company.display_name;
    
    // Using noreply@aureoncr.com - domain aureoncr.com is verified in Resend
    const rawFromEmail = (Deno.env.get("RESEND_FROM_EMAIL") || "noreply@aureoncr.com").trim();
    const cleanedFrom = rawFromEmail.replace(/^"+|"+$/g, "").trim();
    // Extract just the email if it has Name <email> format
    const emailMatch = cleanedFrom.match(/<([^>]+)>/);
    const pureEmail = emailMatch ? emailMatch[1] : cleanedFrom;
    const from = `${companyName} <${pureEmail}>`;
    
    console.log("Using FROM:", from);

    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boleta de Pago - ${companyName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 700px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                ${companyName}
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
                COMPROBANTE DE PAGO
              </p>
              ${company.tax_id ? `<p style="color: rgba(255,255,255,0.7); margin: 4px 0 0 0; font-size: 12px;">Cédula Jurídica: ${company.tax_id}</p>` : ''}
            </td>
          </tr>
          
          <!-- Period Banner -->
          <tr>
            <td style="background: #f0f9ff; padding: 16px 30px; border-bottom: 1px solid #e0e7ff;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #1e3a8a; font-weight: 600; font-size: 14px;">
                    📅 Período: ${periodLabel.toUpperCase()}
                  </td>
                  <td style="text-align: right; color: #64748b; font-size: 13px;">
                    Del ${periodStart.toLocaleDateString('es-CR')} al ${periodEnd.toLocaleDateString('es-CR')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Employee Info -->
          <tr>
            <td style="padding: 24px 30px 16px 30px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 8px; padding: 16px;">
                <tr>
                  <td colspan="2" style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Datos del Colaborador</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; width: 50%;">
                    <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 12px;">Nombre Completo</p>
                    <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 15px;">${employee.full_name}</p>
                  </td>
                  <td style="padding: 12px 16px; width: 50%;">
                    <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 12px;">ID Empleado</p>
                    <p style="margin: 0; color: #1e293b; font-weight: 500; font-size: 15px;">${employee.employee_id}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 12px;">Tipo de Contrato</p>
                    <p style="margin: 0; color: #1e293b; font-weight: 500; font-size: 14px;">${employee.contract_type === 'mensual' ? 'Mensual' : 'Por Horas'}</p>
                  </td>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 12px;">Frecuencia</p>
                    <p style="margin: 0; color: #1e293b; font-weight: 500; font-size: 14px;">${batch.frequency.charAt(0).toUpperCase() + batch.frequency.slice(1)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Salary Breakdown -->
          <tr>
            <td style="padding: 8px 30px 24px 30px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <!-- Ingresos Header -->
                <tr>
                  <td colspan="2" style="background: #dcfce7; padding: 12px 16px; border-bottom: 1px solid #bbf7d0;">
                    <p style="margin: 0; color: #166534; font-weight: 600; font-size: 13px;">💰 INGRESOS</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">Salario Base</td>
                  <td style="padding: 12px 16px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${formatCurrency(grossSalary, currency)}</td>
                </tr>
                ${Number(line.overtime || 0) > 0 ? `
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">Horas Extra</td>
                  <td style="padding: 12px 16px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${formatCurrency(Number(line.overtime), currency)}</td>
                </tr>
                ` : ''}
                ${Number(line.additional_bonuses || 0) > 0 ? `
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">Bonificaciones</td>
                  <td style="padding: 12px 16px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${formatCurrency(Number(line.additional_bonuses), currency)}</td>
                </tr>
                ` : ''}
                <tr style="background: #f0fdf4;">
                  <td style="padding: 14px 16px; font-weight: 700; color: #166534;">TOTAL INGRESOS</td>
                  <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #166534; font-size: 16px;">${formatCurrency(grossSalary, currency)}</td>
                </tr>
                
                <!-- Deducciones Header -->
                <tr>
                  <td colspan="2" style="background: #fef2f2; padding: 12px 16px; border-bottom: 1px solid #fecaca; border-top: 2px solid #e2e8f0;">
                    <p style="margin: 0; color: #991b1b; font-weight: 600; font-size: 13px;">📉 DEDUCCIONES</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">CCSS Obrero (10.5%)</td>
                  <td style="padding: 12px 16px; text-align: right; font-weight: 500; color: #dc2626; border-bottom: 1px solid #f1f5f9;">-${formatCurrency(ccssEmployee, currency)}</td>
                </tr>
                ${rentaEstimated > 0 ? `
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">Impuesto de Renta</td>
                  <td style="padding: 12px 16px; text-align: right; font-weight: 500; color: #dc2626; border-bottom: 1px solid #f1f5f9;">-${formatCurrency(rentaEstimated, currency)}</td>
                </tr>
                ` : ''}
                ${Number(line.additional_deductions || 0) > 0 ? `
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">Otras Deducciones</td>
                  <td style="padding: 12px 16px; text-align: right; font-weight: 500; color: #dc2626; border-bottom: 1px solid #f1f5f9;">-${formatCurrency(Number(line.additional_deductions), currency)}</td>
                </tr>
                ` : ''}
                <tr style="background: #fef2f2;">
                  <td style="padding: 14px 16px; font-weight: 700; color: #991b1b;">TOTAL DEDUCCIONES</td>
                  <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #991b1b; font-size: 16px;">-${formatCurrency(totalDeductions, currency)}</td>
                </tr>
                
                <!-- Net Pay -->
                <tr style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);">
                  <td style="padding: 18px 16px; font-weight: 700; color: white; font-size: 15px;">SALARIO NETO A PAGAR</td>
                  <td style="padding: 18px 16px; text-align: right; font-weight: 700; color: white; font-size: 20px;">${formatCurrency(netPay, currency)}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Accruals Info -->
          <tr>
            <td style="padding: 0 30px 24px 30px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 50%; padding-right: 8px;">
                    <table width="100%" cellspacing="0" cellpadding="0" style="background: #fffbeb; border-radius: 8px; border: 1px solid #fcd34d;">
                      <tr>
                        <td style="padding: 14px;">
                          <p style="margin: 0 0 4px 0; color: #92400e; font-size: 11px; text-transform: uppercase;">Aguinaldo Acumulado</p>
                          <p style="margin: 0; color: #78350f; font-weight: 700; font-size: 16px;">${formatCurrency(aguinaldo, currency)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 50%; padding-left: 8px;">
                    <table width="100%" cellspacing="0" cellpadding="0" style="background: #f0f9ff; border-radius: 8px; border: 1px solid #7dd3fc;">
                      <tr>
                        <td style="padding: 14px;">
                          <p style="margin: 0 0 4px 0; color: #0369a1; font-size: 11px; text-transform: uppercase;">Vacaciones Acumuladas</p>
                          <p style="margin: 0; color: #0c4a6e; font-weight: 700; font-size: 16px;">${vacationDays.toFixed(2)} días</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Legal Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 11px; text-align: center;">
                Este comprobante de pago cumple con los requisitos establecidos en el Código de Trabajo de Costa Rica.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 10px; text-align: center;">
                Documento generado electrónicamente por ACL Payroll CR | ${new Date().toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </td>
          </tr>
          
          <!-- Copyright -->
          <tr>
            <td style="background: #1e3a8a; padding: 16px 30px; text-align: center;">
              <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 11px;">
                © ${new Date().getFullYear()} ${companyName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // List-Unsubscribe headers improve email reputation with Gmail, Outlook, etc.
    const unsubscribeEmail = 'unsubscribe@aureoncr.com';

    // Send email via Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const emailResponse = await resend.emails.send({
      from,
      to: [employee.work_email],
      subject: `📄 Boleta de Pago - ${periodLabel} | ${companyName}`,
      html: emailHtml,
      headers: {
        'List-Unsubscribe': `<mailto:${unsubscribeEmail}?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    console.log("Payslip email sent:", emailResponse);

    // Log the email
    await supabase.from("email_logs").insert({
      company_id: companyId,
      recipient_email: employee.work_email,
      recipient_name: employee.full_name,
      subject: `Boleta de Pago - ${periodLabel}`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    // Update or create payslip record
    const { data: existingPayslip } = await supabase
      .from('payslips')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('batch_id', batch.id)
      .maybeSingle();

    if (existingPayslip) {
      await supabase
        .from('payslips')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', existingPayslip.id);
    } else {
      await supabase.from('payslips').insert({
        batch_id: batch.id,
        company_id: companyId,
        employee_id: employee.id,
        employee_email: employee.work_email,
        payslip_id: `PAY-${line.line_id}`,
        period_label: periodLabel,
        sent_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Boleta enviada a ${employee.work_email}`,
        emailId: emailResponse?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-payslip-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
