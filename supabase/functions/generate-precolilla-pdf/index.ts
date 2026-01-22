import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratePreColillaPdfRequest {
  payrollLineId: string;
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

    const { payrollLineId }: GeneratePreColillaPdfRequest = await req.json();

    console.log("Generating Pre-Colilla PDF for payroll_line:", payrollLineId);

    // Get payroll line with all related data
    const { data: payrollLine, error: lineError } = await supabaseClient
      .from('payroll_lines')
      .select(`
        *,
        employee:employees!inner(
          id,
          employee_id,
          full_name,
          work_email,
          base_salary,
          contract_type,
          currency,
          hire_date
        ),
        batch:payroll_batches!inner(
          id,
          batch_id,
          period_start,
          period_end,
          frequency,
          base_currency,
          status
        ),
        cost_center:cost_centers(name, code)
      `)
      .eq('id', payrollLineId)
      .single();

    if (lineError || !payrollLine) {
      console.error("Payroll line error:", lineError);
      return new Response(
        JSON.stringify({ error: "Línea de planilla no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company info
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', payrollLine.company_id)
      .single();

    if (companyError || !company) {
      console.error("Company error:", companyError);
      return new Response(
        JSON.stringify({ error: "Empresa no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate HTML for PDF
    const html = generatePreColillaHTML(payrollLine, company);

    // Return as HTML (in production, convert to PDF)
    const pdfBuffer = new TextEncoder().encode(html);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="pre-colilla-${payrollLine.employee.employee_id}-${payrollLine.batch.period_end}.html"`,
      },
    });

  } catch (error: any) {
    console.error("Error in generate-precolilla-pdf function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generatePreColillaHTML(payrollLine: any, company: any): string {
  const periodStart = new Date(payrollLine.batch.period_start);
  const periodEnd = new Date(payrollLine.batch.period_end);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const periodLabel = `${periodStart.getDate()} ${months[periodStart.getMonth()]} - ${periodEnd.getDate()} ${months[periodEnd.getMonth()]} ${periodEnd.getFullYear()}`;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);
  };

  const formatCRC = (amount: number) => `₡${formatNumber(amount)}`;
  const formatUSD = (amount: number) => `$${formatNumber(amount)}`;

  // Parse deductions detail
  let deductionsDetail: any = {};
  try {
    if (payrollLine.deductions_detail) {
      deductionsDetail = typeof payrollLine.deductions_detail === 'string' 
        ? JSON.parse(payrollLine.deductions_detail) 
        : payrollLine.deductions_detail;
    }
  } catch (e) {
    console.error("Error parsing deductions_detail:", e);
  }

  const exchangeRate = payrollLine.exchange_rate_to_base || 505.10;
  const isUSDSalary = payrollLine.currency === 'USD';
  const grossSalaryCRC = isUSDSalary ? Number(payrollLine.gross_salary) * exchangeRate : Number(payrollLine.gross_salary);
  const netPayCRC = Number(payrollLine.net_pay);
  const netPayUSD = netPayCRC / exchangeRate;

  const logoUrl = company.logo_url;
  const hireDate = payrollLine.employee.hire_date 
    ? new Date(payrollLine.employee.hire_date).toLocaleDateString('es-CR')
    : 'N/A';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Pre-Colilla - ${payrollLine.employee.full_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      margin: 0;
      padding: 30px;
      color: #1a1a2e;
      background: #fff;
      font-size: 14px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #0F2A44 0%, #1a3a5c 100%);
      color: white;
      padding: 25px 30px;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid rgba(255,255,255,0.2);
    }
    .logo-container {
      background: white;
      border-radius: 10px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 120px;
      min-height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo { max-width: 100px; max-height: 50px; object-fit: contain; }
    .logo-placeholder {
      width: 100px;
      height: 50px;
      background: #f0f0f0;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #666;
    }
    .header-brand { text-align: right; }
    .platform-name {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
      margin-bottom: 3px;
    }
    .payslip-title {
      font-size: 20px;
      font-weight: bold;
      color: #C9A24D;
    }
    .header-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .company-name {
      font-size: 20px;
      font-weight: bold;
    }
    .company-tax-id {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .period-info {
      text-align: right;
      background: rgba(201, 162, 77, 0.15);
      padding: 10px 15px;
      border-radius: 8px;
      border: 1px solid rgba(201, 162, 77, 0.3);
    }
    .period-label-title {
      font-size: 10px;
      text-transform: uppercase;
      opacity: 0.8;
    }
    .period-label {
      font-size: 14px;
      font-weight: 600;
      color: #C9A24D;
    }
    .draft-banner {
      background: #fff3cd;
      border: 2px dashed #ffc107;
      color: #856404;
      padding: 10px 20px;
      text-align: center;
      font-weight: bold;
      font-size: 12px;
    }
    .content { padding: 25px 30px; }
    .usd-banner {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 2px solid #1976d2;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 25px;
    }
    .usd-banner-title {
      font-size: 16px;
      font-weight: bold;
      color: #0d47a1;
      margin-bottom: 12px;
    }
    .usd-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .usd-detail { display: flex; flex-direction: column; }
    .usd-label {
      font-size: 11px;
      color: #1565c0;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .usd-value {
      font-size: 15px;
      font-weight: bold;
      color: #0d47a1;
    }
    .usd-note {
      font-size: 11px;
      color: #1976d2;
      margin-top: 12px;
      font-style: italic;
    }
    .employee-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 25px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    .employee-info-item { display: flex; flex-direction: column; }
    .employee-info-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .employee-info-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }
    .section { margin-bottom: 20px; }
    .section-title {
      background: #003d7a;
      color: white;
      padding: 10px 15px;
      font-weight: bold;
      font-size: 13px;
      border-radius: 6px 6px 0 0;
    }
    .section-title.earnings { background: #2e7d32; }
    .section-title.deductions { background: #c62828; }
    .section-title.accruals { background: #1565c0; }
    .section-content {
      border: 1px solid #e0e0e0;
      border-top: none;
      border-radius: 0 0 6px 6px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #444; }
    .info-value { font-weight: 600; color: #1a1a2e; }
    .info-value.green { color: #2e7d32; }
    .info-value.red { color: #c62828; }
    .hours-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      padding: 15px;
    }
    .hour-box {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .hour-label {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .hour-value {
      font-size: 18px;
      font-weight: bold;
      color: #1a1a2e;
    }
    .net-pay-section {
      background: linear-gradient(135deg, #2e7d32 0%, #388e3c 100%);
      color: white;
      border-radius: 10px;
      padding: 25px;
      text-align: center;
      margin-top: 20px;
    }
    .net-pay-label {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      opacity: 0.9;
    }
    .net-pay-amount {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .net-pay-secondary {
      font-size: 16px;
      opacity: 0.9;
    }
    .footer {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #999;
      font-size: 11px;
    }
    .footer-warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 15px;
      color: #856404;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <div class="logo-container">
          ${logoUrl 
            ? `<img src="${logoUrl}" alt="Logo" class="logo" />` 
            : `<div class="logo-placeholder">${company.display_name.substring(0, 2).toUpperCase()}</div>`
          }
        </div>
        <div class="header-brand">
          <div class="platform-name">ACL Workforce HUB</div>
          <div class="payslip-title">Pre-Colilla</div>
        </div>
      </div>
      <div class="header-bottom">
        <div class="company-info">
          <div class="company-name">${company.display_name}</div>
          ${company.tax_id ? `<div class="company-tax-id">Cédula Jurídica: ${company.tax_id}</div>` : ''}
        </div>
        <div class="period-info">
          <div class="period-label-title">Período</div>
          <div class="period-label">${periodLabel}</div>
        </div>
      </div>
    </div>

    <div class="draft-banner">
      ⚠️ DOCUMENTO DE VALIDACIÓN - NO ES COMPROBANTE OFICIAL ⚠️
    </div>

    <div class="content">
      ${isUSDSalary ? `
      <div class="usd-banner">
        <div class="usd-banner-title">💵 Salario Original en Dólares</div>
        <div class="usd-details">
          <div class="usd-detail">
            <span class="usd-label">Salario Bruto USD</span>
            <span class="usd-value">${formatUSD(Number(payrollLine.gross_salary))}</span>
          </div>
          <div class="usd-detail">
            <span class="usd-label">Tipo de Cambio (BCCR)</span>
            <span class="usd-value">₡${exchangeRate.toFixed(2)}</span>
          </div>
          <div class="usd-detail">
            <span class="usd-label">Equivalente CRC</span>
            <span class="usd-value">${formatCRC(grossSalaryCRC)}</span>
          </div>
        </div>
        <div class="usd-note">* Tipo de cambio de venta del BCCR aplicado para cálculo de deducciones legales</div>
      </div>
      ` : ''}

      <div class="employee-info">
        <div class="employee-info-item">
          <span class="employee-info-label">Empleado</span>
          <span class="employee-info-value">${payrollLine.employee.full_name}</span>
        </div>
        <div class="employee-info-item">
          <span class="employee-info-label">Cédula / ID</span>
          <span class="employee-info-value">${payrollLine.employee.employee_id}</span>
        </div>
        <div class="employee-info-item">
          <span class="employee-info-label">Fecha Ingreso</span>
          <span class="employee-info-value">${hireDate}</span>
        </div>
        <div class="employee-info-item">
          <span class="employee-info-label">Centro de Costo</span>
          <span class="employee-info-value">${payrollLine.cost_center?.name || 'N/A'}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">HORAS TRABAJADAS</div>
        <div class="section-content">
          <div class="hours-grid">
            <div class="hour-box">
              <div class="hour-label">Ordinarias</div>
              <div class="hour-value">${Number(payrollLine.regular_hours) || 0}</div>
            </div>
            <div class="hour-box">
              <div class="hour-label">Extra</div>
              <div class="hour-value">${Number(payrollLine.overtime_hours) || 0}</div>
            </div>
            <div class="hour-box">
              <div class="hour-label">Vacaciones</div>
              <div class="hour-value">${Number(payrollLine.vacation_days_taken) || 0}</div>
            </div>
            <div class="hour-box">
              <div class="hour-label">Ausencias</div>
              <div class="hour-value">${Number(payrollLine.absence_days) || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title earnings">INGRESOS</div>
        <div class="section-content">
          <div class="info-row">
            <span class="info-label">Salario Base</span>
            <span class="info-value green">${formatCRC(grossSalaryCRC)}</span>
          </div>
          ${Number(payrollLine.overtime) > 0 ? `
          <div class="info-row">
            <span class="info-label">Horas Extra</span>
            <span class="info-value green">+${formatCRC(Number(payrollLine.overtime))}</span>
          </div>
          ` : ''}
          ${Number(payrollLine.additional_bonuses) > 0 ? `
          <div class="info-row">
            <span class="info-label">Bonificaciones</span>
            <span class="info-value green">+${formatCRC(Number(payrollLine.additional_bonuses))}</span>
          </div>
          ` : ''}
          <div class="info-row" style="background: #f0fff0; font-weight: bold;">
            <span class="info-label">Total Ingresos</span>
            <span class="info-value green">${formatCRC(grossSalaryCRC + Number(payrollLine.overtime || 0) + Number(payrollLine.additional_bonuses || 0))}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title deductions">DEDUCCIONES</div>
        <div class="section-content">
          ${deductionsDetail.ccss_obrero ? `
          <div class="info-row">
            <span class="info-label">CCSS Obrero (${deductionsDetail.ccss_rate || 10.83}%)</span>
            <span class="info-value red">-${formatCRC(deductionsDetail.ccss_obrero)}</span>
          </div>
          ` : ''}
          ${deductionsDetail.isr_neto > 0 ? `
          <div class="info-row">
            <span class="info-label">Impuesto sobre la Renta</span>
            <span class="info-value red">-${formatCRC(deductionsDetail.isr_neto)}</span>
          </div>
          ` : ''}
          ${deductionsDetail.magisterio > 0 ? `
          <div class="info-row">
            <span class="info-label">Magisterio Nacional</span>
            <span class="info-value red">-${formatCRC(deductionsDetail.magisterio)}</span>
          </div>
          ` : ''}
          ${deductionsDetail.poliza_vida > 0 ? `
          <div class="info-row">
            <span class="info-label">Póliza de Vida</span>
            <span class="info-value red">-${formatCRC(deductionsDetail.poliza_vida)}</span>
          </div>
          ` : ''}
          ${deductionsDetail.loan_deduction > 0 ? `
          <div class="info-row">
            <span class="info-label">Préstamos</span>
            <span class="info-value red">-${formatCRC(deductionsDetail.loan_deduction)}</span>
          </div>
          ` : ''}
          ${Number(payrollLine.additional_deductions) > 0 ? `
          <div class="info-row">
            <span class="info-label">Otras Deducciones</span>
            <span class="info-value red">-${formatCRC(Number(payrollLine.additional_deductions))}</span>
          </div>
          ` : ''}
          <div class="info-row" style="background: #fff0f0; font-weight: bold;">
            <span class="info-label">Total Deducciones</span>
            <span class="info-value red">-${formatCRC(Number(payrollLine.deductions))}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title accruals">PROVISIONES DEL PERÍODO</div>
        <div class="section-content">
          <div class="info-row">
            <span class="info-label">Vacaciones Acumuladas</span>
            <span class="info-value">${Number(payrollLine.vacation_accrued_days || 0).toFixed(2)} días</span>
          </div>
          <div class="info-row">
            <span class="info-label">Aguinaldo Acumulado</span>
            <span class="info-value">${formatCRC(Number(payrollLine.aguinaldo_accrued || 0))}</span>
          </div>
        </div>
      </div>

      <div class="net-pay-section">
        <div class="net-pay-label">Total a Depositar</div>
        <div class="net-pay-amount">${formatUSD(netPayUSD)} USD</div>
        <div class="net-pay-secondary">(${formatCRC(netPayCRC)} CRC)</div>
      </div>

      <div class="footer">
        <div class="footer-warning">
          Este es un documento de pre-visualización para validación interna.
          NO debe ser enviado al empleado como comprobante oficial.
        </div>
        <p>ACL Workforce HUB - Gestión de Nómina Costa Rica</p>
        <p>Generado: ${new Date().toLocaleString('es-CR')}</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}
