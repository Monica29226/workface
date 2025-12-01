import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratePdfRequest {
  payslipId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { payslipId }: GeneratePdfRequest = await req.json();

    console.log("Generating PDF for payslip:", payslipId);

    // Get payslip with all related data
    const { data: payslip, error: payslipError } = await supabaseClient
      .from('payslips')
      .select(`
        *,
        batch:payroll_batches!inner(
          id,
          batch_id,
          period_start,
          period_end,
          frequency,
          base_currency,
          status
        ),
        employee:employees!inner(
          id,
          employee_id,
          full_name,
          work_email,
          base_salary,
          contract_type,
          currency
        ),
        company:companies!inner(
          id,
          company_id,
          display_name,
          tax_id,
          iban,
          logo_url
        )
      `)
      .eq('id', payslipId)
      .single();

    if (payslipError || !payslip) {
      console.error("Payslip error:", payslipError);
      return new Response(
        JSON.stringify({ error: "Colilla no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payroll line data
    const { data: payrollLine, error: lineError } = await supabaseClient
      .from('payroll_lines')
      .select('*')
      .eq('batch_id', payslip.batch.id)
      .eq('employee_id', payslip.employee_id)
      .single();

    if (lineError || !payrollLine) {
      console.error("Payroll line error:", lineError);
      return new Response(
        JSON.stringify({ error: "Datos de planilla no encontrados" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate HTML for PDF
    const html = generatePayslipHTML(payslip, payrollLine);

    // For now, return HTML (in production, use a PDF library like puppeteer or jsPDF)
    // This is a placeholder - you'll need to integrate actual PDF generation
    const pdfBuffer = new TextEncoder().encode(html);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="colilla-${payslip.payslip_id}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error("Error in generate-payslip-pdf function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generatePayslipHTML(payslip: any, payrollLine: any): string {
  const periodStart = new Date(payslip.batch.period_start);
  const periodLabel = periodStart.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: currency === 'CRC' ? 'CRC' : 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Colilla de Pago - ${payslip.employee.full_name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #333;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #003d7a;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #003d7a;
      margin: 5px 0;
    }
    .company-info {
      text-align: center;
      margin-bottom: 20px;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      background-color: #003d7a;
      color: white;
      padding: 8px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 10px;
      border-bottom: 1px solid #ddd;
    }
    .info-label {
      font-weight: bold;
    }
    .totals {
      background-color: #f5f5f5;
      padding: 15px;
      margin-top: 20px;
      border: 1px solid #ddd;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 16px;
    }
    .net-pay {
      font-size: 20px;
      font-weight: bold;
      color: #003d7a;
      padding-top: 10px;
      border-top: 2px solid #003d7a;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>COLILLA DE PAGO</h1>
    <p>${periodLabel}</p>
  </div>

  <div class="company-info">
    <h2>${payslip.company.display_name}</h2>
    <p>Cédula Jurídica: ${payslip.company.tax_id || 'N/A'}</p>
  </div>

  <div class="section">
    <div class="section-title">DATOS DEL EMPLEADO</div>
    <div class="info-row">
      <span class="info-label">Nombre:</span>
      <span>${payslip.employee.full_name}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Cédula:</span>
      <span>${payslip.employee.employee_id}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Correo:</span>
      <span>${payslip.employee.work_email}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Tipo de Contrato:</span>
      <span>${payslip.employee.contract_type === 'mensual' ? 'Mensual' : 'Por Horas'}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">INGRESOS</div>
    <div class="info-row">
      <span class="info-label">Salario Base:</span>
      <span>${formatCurrency(payrollLine.gross_salary, payrollLine.currency)}</span>
    </div>
    ${payrollLine.overtime > 0 ? `
    <div class="info-row">
      <span class="info-label">Horas Extra (${payrollLine.overtime_hours || 0} hrs):</span>
      <span>${formatCurrency(payrollLine.overtime, payrollLine.currency)}</span>
    </div>
    ` : ''}
    ${payrollLine.project_hours_amount > 0 ? `
    <div class="info-row">
      <span class="info-label">Horas de Proyecto:</span>
      <span>${formatCurrency(payrollLine.project_hours_amount, payrollLine.currency)}</span>
    </div>
    ` : ''}
    ${payrollLine.additional_bonuses > 0 ? `
    <div class="info-row">
      <span class="info-label">Bonificaciones:</span>
      <span>${formatCurrency(payrollLine.additional_bonuses, payrollLine.currency)}</span>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">DEDUCCIONES</div>
    <div class="info-row">
      <span class="info-label">Cargas Sociales (CCSS):</span>
      <span>${formatCurrency(payrollLine.deductions * 0.1067, payrollLine.currency)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Impuesto Renta:</span>
      <span>${formatCurrency(payrollLine.deductions * 0.05, payrollLine.currency)}</span>
    </div>
    ${payrollLine.additional_deductions > 0 ? `
    <div class="info-row">
      <span class="info-label">Otras Deducciones:</span>
      <span>${formatCurrency(payrollLine.additional_deductions, payrollLine.currency)}</span>
    </div>
    ` : ''}
    <div class="info-row">
      <span class="info-label">Total Deducciones:</span>
      <span>${formatCurrency(payrollLine.deductions, payrollLine.currency)}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">PROVISIONES</div>
    <div class="info-row">
      <span class="info-label">Aguinaldo Acumulado:</span>
      <span>${formatCurrency(payrollLine.aguinaldo_accrued || 0, payrollLine.currency)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Vacaciones Acumuladas:</span>
      <span>${payrollLine.vacation_accrued_days || 0} días</span>
    </div>
    ${payrollLine.vacation_days_taken > 0 ? `
    <div class="info-row">
      <span class="info-label">Vacaciones Disfrutadas:</span>
      <span>${payrollLine.vacation_days_taken} días</span>
    </div>
    ` : ''}
  </div>

  <div class="totals">
    <div class="total-row">
      <span>Salario Bruto:</span>
      <span>${formatCurrency(payrollLine.gross_salary, payrollLine.currency)}</span>
    </div>
    <div class="total-row">
      <span>Total Deducciones:</span>
      <span>-${formatCurrency(payrollLine.deductions, payrollLine.currency)}</span>
    </div>
    <div class="total-row net-pay">
      <span>SALARIO NETO A PAGAR:</span>
      <span>${formatCurrency(payrollLine.net_pay, payrollLine.currency)}</span>
    </div>
  </div>

  <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
    <p>Colilla generada el ${new Date().toLocaleDateString('es-CR')}</p>
    <p>Este documento es una representación electrónica de su recibo de pago</p>
  </div>
</body>
</html>
  `;
}
