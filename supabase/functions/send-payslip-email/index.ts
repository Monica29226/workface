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

function formatCurrency(amount: number, currency: string = 'CRC'): string {
  if (currency === 'CRC') {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency', currency: 'CRC',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(Math.round(amount));
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2
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

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payrollLineId, companyId }: SendPayslipRequest = await req.json();

    if (!payrollLineId || !companyId) {
      return new Response(
        JSON.stringify({ error: "payrollLineId y companyId son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify caller has access to this company
    const { data: callerAccess } = await supabase
      .from("company_users")
      .select("id")
      .eq("user_id", callerUser.id)
      .eq("company_id", companyId)
      .maybeSingle();

    // Also check admin roles
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isGlobalAdmin = callerRoles?.some((r) =>
      ["admin", "ACL_SuperAdmin", "ACL_PayrollSpecialist"].includes(r.role)
    );

    if (!callerAccess && !isGlobalAdmin) {
      await supabase.from("audit_log").insert({
        log_id: `SEC-${Date.now()}`,
        actor_email: callerUser.email || "system",
        action: "payslip_send_blocked",
        company_id: companyId,
        details: "Intento de envío de colilla sin acceso a la empresa",
      });
      return new Response(
        JSON.stringify({ error: "No tiene acceso a esta empresa" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get payroll line with employee and batch info
    const { data: line, error: lineError } = await supabase
      .from('payroll_lines')
      .select(`
        *,
        employee:employees!inner(
          id, employee_id, full_name, work_email, hire_date, contract_type, currency
        ),
        batch:payroll_batches!inner(
          id, batch_id, period_start, period_end, frequency
        )
      `)
      .eq('id', payrollLineId)
      .single();

    if (lineError || !line) {
      return new Response(
        JSON.stringify({ error: "Línea de planilla no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // CRITICAL: Validate company_id matches
    if (line.company_id !== companyId) {
      await supabase.from("audit_log").insert({
        log_id: `SEC-${Date.now()}`,
        actor_email: callerUser.email || "system",
        action: "payslip_company_mismatch",
        company_id: companyId,
        details: `Intento de enviar colilla de empresa ${line.company_id} desde contexto ${companyId}`,
      });
      return new Response(
        JSON.stringify({ error: "La colilla no pertenece a la empresa seleccionada" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('display_name, tax_id, payroll_email_from, logo_url, base_currency')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Empresa no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get company parameters for accurate deduction labels
    const { data: companyParams } = await supabase
      .from('company_parameters')
      .select('ccss_obrero_total, is_education_sector, magisterio_rate, poliza_vida_fija, ccss_obrero_education')
      .eq('company_id', companyId)
      .single();

    const employee = line.employee;
    const batch = line.batch;
    const periodStart = new Date(batch.period_start);
    const periodEnd = new Date(batch.period_end);
    const periodLabel = periodStart.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
    const lineCurrency = line.currency || 'CRC';
    const exchangeRate = Number(line.exchange_rate_to_base || 1);
    const isUSD = lineCurrency === 'USD';

    // Use actual deductions from deductions_detail if available
    const detail = line.deductions_detail as any || {};
    const grossSalary = Number(line.gross_salary);
    const grossSalaryCRC = isUSD ? grossSalary * exchangeRate : grossSalary;

    // Determine CCSS rate
    const isEducation = companyParams?.is_education_sector || false;
    const ccssRate = isEducation
      ? (companyParams?.ccss_obrero_education || 6.70)
      : (companyParams?.ccss_obrero_total || 10.83);

    // Extract actual deduction amounts
    const ccssObrero = detail.ccss_obrero != null
      ? Number(detail.ccss_obrero)
      : Math.round(grossSalaryCRC * (ccssRate / 100));
    const isrNeto = detail.isr_neto != null
      ? Number(detail.isr_neto)
      : 0;
    const bancoPopular = detail.lpt_banco_popular != null
      ? Number(detail.lpt_banco_popular)
      : Math.round(grossSalaryCRC * 0.01);
    const magisterio = isEducation && detail.magisterio != null
      ? Number(detail.magisterio)
      : (isEducation ? Math.round(grossSalaryCRC * ((companyParams?.magisterio_rate || 8.5) / 100)) : 0);
    const polizaVida = isEducation ? (companyParams?.poliza_vida_fija || 0) : 0;

    const totalDeductions = Number(line.deductions);
    const netPay = Number(line.net_pay);
    const totalToPay = Number(line.total_to_pay || netPay);
    const aguinaldo = Number(line.aguinaldo_accrued || 0);
    const vacationDays = Number(line.vacation_accrued_days || 0);
    const additionalDeductions = Number(line.additional_deductions || 0);

    // Determine display currency: for Horizonte Positivo-style companies, show in USD
    const displayCurrency = isUSD ? 'USD' : 'CRC';
    const displayNetPay = isUSD ? totalToPay / exchangeRate : totalToPay;

    const companyName = company.display_name;

    const rawFromEmail = (Deno.env.get("RESEND_FROM_EMAIL") || "noreply@aureoncr.com").trim();
    const cleanedFrom = rawFromEmail.replace(/^"+|"+$/g, "").trim();
    const emailMatchResult = cleanedFrom.match(/<([^>]+)>/);
    const pureEmail = emailMatchResult ? emailMatchResult[1] : cleanedFrom;
    const from = `${companyName} <${pureEmail}>`;

    // Build deductions rows
    const deductionRows = [];

    // CCSS
    const ccssLabel = isEducation
      ? `CCSS Obrero (${ccssRate}%)`
      : `CCSS Obrero (${ccssRate}%)`;
    deductionRows.push({ label: ccssLabel, amount: ccssObrero });

    // Magisterio (education sector)
    if (isEducation && magisterio > 0) {
      deductionRows.push({ label: `Magisterio (${companyParams?.magisterio_rate || 8.5}%)`, amount: magisterio });
    }

    // Póliza de Vida (education sector)
    if (isEducation && polizaVida > 0) {
      deductionRows.push({ label: 'Póliza de Vida', amount: polizaVida });
    }

    // ISR
    if (isrNeto > 0) {
      deductionRows.push({ label: 'Impuesto de Renta', amount: isrNeto });
    }

    // Banco Popular
    if (bancoPopular > 0) {
      deductionRows.push({ label: 'LPT Banco Popular (1%)', amount: bancoPopular });
    }

    // Additional deductions
    if (additionalDeductions > 0) {
      deductionRows.push({ label: 'Otras Deducciones', amount: additionalDeductions });
    }

    // Build deductions HTML
    const deductionsHtml = deductionRows.map(row => `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">${row.label}</td>
        <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #dc2626; border-bottom: 1px solid #f1f5f9; font-size: 14px;">-${formatCurrency(row.amount, 'CRC')}</td>
      </tr>
    `).join('');

    // USD banner if applicable
    const usdBanner = isUSD ? `
      <tr>
        <td style="background: #dbeafe; padding: 12px 16px; border-bottom: 1px solid #93c5fd;">
          <table width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="color: #1e40af; font-size: 13px;">
                💵 <strong>Salario en USD:</strong> ${formatCurrency(grossSalary / exchangeRate, 'USD')}
              </td>
              <td style="text-align: right; color: #1e40af; font-size: 13px;">
                Tipo de cambio: ₡${exchangeRate.toFixed(2)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    ` : '';

    // Net pay display
    const netPayDisplay = isUSD
      ? `${formatCurrency(displayNetPay, 'USD')} <span style="font-size: 13px; color: rgba(255,255,255,0.8);">(${formatCurrency(totalToPay, 'CRC')})</span>`
      : formatCurrency(totalToPay, 'CRC');

    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 700px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F2A44, #1e3a8a); padding: 30px; text-align: center;">
              ${company.logo_url ? `<img src="${company.logo_url}" alt="${companyName}" style="max-width: 160px; height: auto; margin-bottom: 12px;" />` : ''}
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">${companyName}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">COMPROBANTE DE PAGO</p>
              ${company.tax_id ? `<p style="color: rgba(255,255,255,0.7); margin: 4px 0 0 0; font-size: 12px;">Cédula Jurídica: ${company.tax_id}</p>` : ''}
            </td>
          </tr>
          
          <!-- Period -->
          <tr>
            <td style="background: #f0f9ff; padding: 14px 30px; border-bottom: 1px solid #e0e7ff;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #1e3a8a; font-weight: 600; font-size: 14px;">📅 ${periodLabel.toUpperCase()}</td>
                  <td style="text-align: right; color: #64748b; font-size: 13px;">
                    Del ${periodStart.toLocaleDateString('es-CR')} al ${periodEnd.toLocaleDateString('es-CR')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          ${usdBanner}
          
          <!-- Employee Info -->
          <tr>
            <td style="padding: 20px 30px 12px 30px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px; width: 50%;">
                    <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase;">Colaborador</p>
                    <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 15px;">${employee.full_name}</p>
                  </td>
                  <td style="padding: 14px 16px; width: 50%;">
                    <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase;">ID</p>
                    <p style="margin: 0; color: #1e293b; font-weight: 500; font-size: 14px;">${employee.employee_id}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Salary Breakdown -->
          <tr>
            <td style="padding: 8px 30px 20px 30px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <!-- Ingresos -->
                <tr>
                  <td colspan="2" style="background: #dcfce7; padding: 10px 16px;">
                    <p style="margin: 0; color: #166534; font-weight: 600; font-size: 13px;">💰 INGRESOS</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">Salario Bruto</td>
                  <td style="padding: 10px 16px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9; font-size: 14px;">${formatCurrency(grossSalaryCRC, 'CRC')}</td>
                </tr>
                ${Number(line.overtime || 0) > 0 ? `
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">Horas Extra</td>
                  <td style="padding: 10px 16px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9; font-size: 14px;">${formatCurrency(Number(line.overtime), 'CRC')}</td>
                </tr>` : ''}
                ${Number(line.additional_bonuses || 0) > 0 ? `
                <tr>
                  <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">Bonificaciones</td>
                  <td style="padding: 10px 16px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9; font-size: 14px;">${formatCurrency(Number(line.additional_bonuses), 'CRC')}</td>
                </tr>` : ''}
                
                <!-- Deducciones -->
                <tr>
                  <td colspan="2" style="background: #fef2f2; padding: 10px 16px; border-top: 2px solid #e2e8f0;">
                    <p style="margin: 0; color: #991b1b; font-weight: 600; font-size: 13px;">📉 DEDUCCIONES (en CRC)</p>
                  </td>
                </tr>
                ${deductionsHtml}
                <tr style="background: #fef2f2;">
                  <td style="padding: 12px 16px; font-weight: 700; color: #991b1b; font-size: 14px;">TOTAL DEDUCCIONES</td>
                  <td style="padding: 12px 16px; text-align: right; font-weight: 700; color: #991b1b; font-size: 15px;">-${formatCurrency(totalDeductions, 'CRC')}</td>
                </tr>
                
                <!-- Net Pay -->
                <tr style="background: linear-gradient(135deg, #0F2A44, #1e3a8a);">
                  <td style="padding: 16px; font-weight: 700; color: white; font-size: 14px;">TOTAL A DEPOSITAR</td>
                  <td style="padding: 16px; text-align: right; font-weight: 700; color: white; font-size: 18px;">${netPayDisplay}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Accruals -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 50%; padding-right: 6px;">
                    <table width="100%" cellspacing="0" cellpadding="0" style="background: #fffbeb; border-radius: 8px; border: 1px solid #fcd34d;">
                      <tr>
                        <td style="padding: 12px;">
                          <p style="margin: 0 0 4px 0; color: #92400e; font-size: 11px; text-transform: uppercase;">Aguinaldo Acumulado</p>
                          <p style="margin: 0; color: #78350f; font-weight: 700; font-size: 15px;">${formatCurrency(aguinaldo, 'CRC')}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 50%; padding-left: 6px;">
                    <table width="100%" cellspacing="0" cellpadding="0" style="background: #f0f9ff; border-radius: 8px; border: 1px solid #7dd3fc;">
                      <tr>
                        <td style="padding: 12px;">
                          <p style="margin: 0 0 4px 0; color: #0369a1; font-size: 11px; text-transform: uppercase;">Vacaciones Acumuladas</p>
                          <p style="margin: 0; color: #0c4a6e; font-weight: 700; font-size: 15px;">${vacationDays.toFixed(2)} días</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 16px 30px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 11px; text-align: center;">
                Este comprobante cumple con los requisitos del Código de Trabajo de Costa Rica.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 10px; text-align: center;">
                Generado por ACL Workforce HUB | ${new Date().toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const unsubscribeEmailAddr = 'unsubscribe@aureoncr.com';

    // Create email log BEFORE sending
    const { data: logEntry } = await supabase.from("email_logs").insert({
      company_id: companyId,
      recipient_email: employee.work_email,
      recipient_name: employee.full_name,
      subject: `Boleta de Pago - ${periodLabel} | ${companyName}`,
      status: 'sending',
    }).select("id").single();

    try {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      const emailResponse = await resend.emails.send({
        from,
        to: [employee.work_email],
        subject: `📄 Boleta de Pago - ${periodLabel} | ${companyName}`,
        html: emailHtml,
        headers: {
          'List-Unsubscribe': `<mailto:${unsubscribeEmailAddr}?subject=Unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      console.log("Payslip email sent:", emailResponse);

      // Update log to sent
      if (logEntry) {
        await supabase.from("email_logs")
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq("id", logEntry.id);
      }

      // Update or create payslip record
      const { data: existingPayslip } = await supabase
        .from('payslips')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('batch_id', batch.id)
        .maybeSingle();

      if (existingPayslip) {
        await supabase.from('payslips')
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

      // Audit log
      await supabase.from("audit_log").insert({
        log_id: `PAYSLIP-${Date.now()}`,
        actor_email: callerUser.email || "system",
        action: "payslip_email_sent",
        target_email: employee.work_email,
        company_id: companyId,
        details: `Colilla ${periodLabel} enviada a ${employee.full_name}`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Boleta enviada a ${employee.work_email}`,
          emailId: emailResponse?.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (emailError: any) {
      console.error("Error sending payslip email:", emailError);

      if (logEntry) {
        await supabase.from("email_logs")
          .update({ status: 'failed', error_message: emailError.message || "Error al enviar" })
          .eq("id", logEntry.id);
      }

      return new Response(
        JSON.stringify({ error: emailError.message || "Error al enviar la colilla" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Error in send-payslip-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
