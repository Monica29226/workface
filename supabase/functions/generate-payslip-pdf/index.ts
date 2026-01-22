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

interface DeductionItem {
  code: string;
  label: string;
  type?: 'percentage' | 'fixed';
  rate?: number;
  amount: number;
}

interface DeductionsDetail {
  items?: DeductionItem[];
  total_deductions?: number;
}

function generatePayslipHTML(payslip: any, payrollLine: any): string {
  const periodStart = new Date(payslip.batch.period_start);
  const periodEnd = new Date(payslip.batch.period_end);
  const periodLabel = `${periodStart.toLocaleDateString('es-CR', { day: '2-digit', month: 'long' })} - ${periodEnd.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: currency === 'CRC' ? 'CRC' : 'USD',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatCRC = (amount: number) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Parse deductions_detail JSON
  let deductionsDetail: DeductionsDetail = { items: [], total_deductions: 0 };
  try {
    if (payrollLine.deductions_detail) {
      if (typeof payrollLine.deductions_detail === 'string') {
        deductionsDetail = JSON.parse(payrollLine.deductions_detail);
      } else {
        deductionsDetail = payrollLine.deductions_detail;
      }
    }
  } catch (e) {
    console.error("Error parsing deductions_detail:", e);
  }

  // Parse manual_adjustments for USD salary info
  let manualAdjustments: any = {};
  try {
    if (payrollLine.manual_adjustments) {
      if (typeof payrollLine.manual_adjustments === 'string') {
        manualAdjustments = JSON.parse(payrollLine.manual_adjustments);
      } else {
        manualAdjustments = payrollLine.manual_adjustments;
      }
    }
  } catch (e) {
    console.error("Error parsing manual_adjustments:", e);
  }

  const deductionItems = deductionsDetail.items || [];
  const logoUrl = payslip.company.logo_url;

  // Check if this is a USD salary
  const exchangeRate = payrollLine.exchange_rate_to_base || manualAdjustments?.exchange_rate_applied;
  const originalCurrency = manualAdjustments?.original_currency || payslip.employee.currency;
  const originalSalary = manualAdjustments?.original_salary || payslip.employee.base_salary;
  const isUSDSalary = originalCurrency === 'USD' && exchangeRate && exchangeRate > 1;

  // Calculate values in both currencies for USD employees
  const grossSalaryCRC = isUSDSalary ? originalSalary * exchangeRate : payrollLine.gross_salary;
  const netPayCRC = payrollLine.net_pay;
  const netPayUSD = isUSDSalary ? netPayCRC / exchangeRate : null;
  const deductionsCRC = payrollLine.deductions;
  const deductionsUSD = isUSDSalary ? deductionsCRC / exchangeRate : null;

  // Generate USD salary banner HTML
  const usdBannerHTML = isUSDSalary ? `
    <div class="usd-banner">
      <div class="usd-banner-icon">💵</div>
      <div class="usd-banner-content">
        <div class="usd-banner-title">Salario Original en Dólares</div>
        <div class="usd-banner-details">
          <div class="usd-detail">
            <span class="usd-label">Salario Bruto USD:</span>
            <span class="usd-value">${formatUSD(originalSalary)}</span>
          </div>
          <div class="usd-detail">
            <span class="usd-label">Tipo de Cambio (BCCR):</span>
            <span class="usd-value">₡${exchangeRate.toFixed(2)}</span>
          </div>
          <div class="usd-detail">
            <span class="usd-label">Equivalente CRC:</span>
            <span class="usd-value">${formatCRC(grossSalaryCRC)}</span>
          </div>
        </div>
        <div class="usd-banner-note">* Tipo de cambio de venta del Banco Central de Costa Rica aplicado a la fecha del período</div>
      </div>
    </div>
  ` : '';

  // Generate deductions rows HTML with USD equivalents for USD employees
  const deductionsRowsHTML = deductionItems.length > 0 
    ? deductionItems.map((item: DeductionItem) => `
      <div class="info-row">
        <span class="info-label">${item.label}${item.type === 'percentage' && item.rate ? ` (${(item.rate * 100).toFixed(1)}%)` : ''}:</span>
        <span class="deduction-amount">
          -${formatCRC(item.amount)}
          ${isUSDSalary ? `<span class="usd-equivalent">(~${formatUSD(item.amount / exchangeRate)})</span>` : ''}
        </span>
      </div>
    `).join('')
    : `
      <div class="info-row">
        <span class="info-label">CCSS Obrero:</span>
        <span class="deduction-amount">-${formatCRC(payrollLine.deductions * 0.095)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Impuesto sobre la Renta:</span>
        <span class="deduction-amount">-${formatCRC(payrollLine.deductions * 0.05)}</span>
      </div>
    `;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Colilla de Pago - ${payslip.employee.full_name}</title>
  <style>
    * {
      box-sizing: border-box;
    }
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
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #003d7a 0%, #0066cc 100%);
      color: white;
      padding: 25px 30px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
      background: white;
      border-radius: 8px;
      padding: 8px;
    }
    .logo-placeholder {
      width: 80px;
      height: 80px;
      background: rgba(255,255,255,0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
    }
    .company-name {
      font-size: 22px;
      font-weight: bold;
      margin: 0;
    }
    .company-tax-id {
      font-size: 13px;
      opacity: 0.9;
      margin-top: 5px;
    }
    .header-right {
      text-align: right;
    }
    .payslip-title {
      font-size: 18px;
      font-weight: bold;
      margin: 0;
    }
    .period-label {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 5px;
    }
    .content {
      padding: 25px 30px;
    }
    .usd-banner {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 2px solid #1976d2;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 25px;
      display: flex;
      align-items: flex-start;
      gap: 15px;
    }
    .usd-banner-icon {
      font-size: 32px;
    }
    .usd-banner-content {
      flex: 1;
    }
    .usd-banner-title {
      font-size: 16px;
      font-weight: bold;
      color: #0d47a1;
      margin-bottom: 12px;
    }
    .usd-banner-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .usd-detail {
      display: flex;
      flex-direction: column;
    }
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
    .usd-banner-note {
      font-size: 11px;
      color: #1976d2;
      margin-top: 12px;
      font-style: italic;
    }
    .usd-equivalent {
      font-size: 11px;
      color: #1976d2;
      margin-left: 5px;
    }
    .employee-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 25px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .employee-info-item {
      display: flex;
      flex-direction: column;
    }
    .employee-info-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .employee-info-value {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a2e;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      background: #003d7a;
      color: white;
      padding: 10px 15px;
      font-weight: bold;
      font-size: 14px;
      border-radius: 6px 6px 0 0;
      margin: 0;
    }
    .section-content {
      border: 1px solid #e0e0e0;
      border-top: none;
      border-radius: 0 0 6px 6px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 15px;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #444;
    }
    .info-value {
      font-weight: 600;
      color: #1a1a2e;
    }
    .deduction-amount {
      font-weight: 600;
      color: #dc3545;
      text-align: right;
    }
    .income-amount {
      font-weight: 600;
      color: #28a745;
      text-align: right;
    }
    .income-detail {
      font-size: 11px;
      color: #1976d2;
      display: block;
      margin-top: 2px;
    }
    .totals {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 8px;
      padding: 20px;
      margin-top: 25px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 15px;
    }
    .total-row.subtotal {
      border-bottom: 1px dashed #ccc;
      padding-bottom: 15px;
      margin-bottom: 10px;
    }
    .total-value-container {
      text-align: right;
    }
    .total-usd-main {
      font-size: 20px;
      font-weight: bold;
      color: #0d47a1;
    }
    .total-crc-secondary {
      font-size: 13px;
      color: #666;
      margin-top: 2px;
    }
    .net-pay {
      font-size: 20px;
      font-weight: bold;
      color: #003d7a;
      padding-top: 15px;
      border-top: 2px solid #003d7a;
      margin-top: 10px;
    }
    .net-pay-usd {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 2px solid #1976d2;
      border-radius: 8px;
      padding: 15px 20px;
      margin-top: 15px;
    }
    .footer {
      text-align: center;
      padding: 20px 30px;
      background: #f8f9fa;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e0e0e0;
    }
    .footer p {
      margin: 5px 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-mensual {
      background: #e3f2fd;
      color: #1565c0;
    }
    .badge-horas {
      background: #fff3e0;
      color: #e65100;
    }
    .badge-usd {
      background: #e8f5e9;
      color: #2e7d32;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        ${logoUrl 
          ? `<img src="${logoUrl}" alt="Logo" class="logo" />`
          : `<div class="logo-placeholder">${payslip.company.display_name.charAt(0)}</div>`
        }
        <div>
          <p class="company-name">${payslip.company.display_name}</p>
          <p class="company-tax-id">Cédula Jurídica: ${payslip.company.tax_id || 'N/A'}</p>
        </div>
      </div>
      <div class="header-right">
        <p class="payslip-title">COMPROBANTE DE PAGO</p>
        <p class="period-label">${periodLabel}</p>
      </div>
    </div>

    <div class="content">
      ${usdBannerHTML}
      
      <div class="employee-info">
        <div class="employee-info-item">
          <span class="employee-info-label">Nombre del Colaborador</span>
          <span class="employee-info-value">${payslip.employee.full_name}</span>
        </div>
        <div class="employee-info-item">
          <span class="employee-info-label">Identificación</span>
          <span class="employee-info-value">${payslip.employee.employee_id}</span>
        </div>
        <div class="employee-info-item">
          <span class="employee-info-label">Correo Electrónico</span>
          <span class="employee-info-value">${payslip.employee.work_email}</span>
        </div>
        <div class="employee-info-item">
          <span class="employee-info-label">Tipo de Contrato</span>
          <span class="employee-info-value">
            <span class="badge ${payslip.employee.contract_type === 'mensual' ? 'badge-mensual' : 'badge-horas'}">
              ${payslip.employee.contract_type === 'mensual' ? 'Mensual' : 'Por Horas'}
            </span>
            ${isUSDSalary ? '<span class="badge badge-usd">USD</span>' : ''}
          </span>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">💰 INGRESOS</h3>
        <div class="section-content">
          <div class="info-row">
            <span class="info-label">Salario Base</span>
            <span class="income-amount">
              ${isUSDSalary 
                ? `${formatUSD(originalSalary)}<span class="income-detail">(${formatCRC(grossSalaryCRC)})</span>`
                : formatCRC(payrollLine.gross_salary)
              }
            </span>
          </div>
          ${payrollLine.overtime > 0 ? `
          <div class="info-row">
            <span class="info-label">Horas Extra (${payrollLine.overtime_hours || 0} hrs)</span>
            <span class="income-amount">+${formatCRC(payrollLine.overtime)}</span>
          </div>
          ` : ''}
          ${payrollLine.project_hours_amount > 0 ? `
          <div class="info-row">
            <span class="info-label">Horas de Proyecto</span>
            <span class="income-amount">+${formatCRC(payrollLine.project_hours_amount)}</span>
          </div>
          ` : ''}
          ${payrollLine.additional_bonuses > 0 ? `
          <div class="info-row">
            <span class="info-label">Bonificaciones Adicionales</span>
            <span class="income-amount">+${formatCRC(payrollLine.additional_bonuses)}</span>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">📋 DEDUCCIONES</h3>
        <div class="section-content">
          ${deductionsRowsHTML}
          <div class="info-row" style="background: #fff5f5;">
            <span class="info-label" style="font-weight: bold;">Total Deducciones</span>
            <span class="deduction-amount" style="font-size: 15px;">
              -${formatCRC(deductionsCRC)}
              ${isUSDSalary ? `<span class="usd-equivalent">(~${formatUSD(deductionsUSD)})</span>` : ''}
            </span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">📊 PROVISIONES</h3>
        <div class="section-content">
          <div class="info-row">
            <span class="info-label">Aguinaldo Acumulado</span>
            <span class="info-value">${formatCRC(payrollLine.aguinaldo_accrued || 0)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Vacaciones Acumuladas</span>
            <span class="info-value">${payrollLine.vacation_accrued_days || 0} días</span>
          </div>
          ${payrollLine.vacation_days_taken > 0 ? `
          <div class="info-row">
            <span class="info-label">Vacaciones Disfrutadas</span>
            <span class="info-value">${payrollLine.vacation_days_taken} días</span>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="totals">
        <div class="total-row subtotal">
          <span>Salario Bruto:</span>
          <span class="total-value-container">
            ${isUSDSalary 
              ? `<div class="total-usd-main">${formatUSD(originalSalary)}</div><div class="total-crc-secondary">${formatCRC(grossSalaryCRC)}</div>`
              : `<span style="font-weight: 600;">${formatCRC(payrollLine.gross_salary)}</span>`
            }
          </span>
        </div>
        <div class="total-row">
          <span>Total Deducciones:</span>
          <span style="color: #dc3545; font-weight: 600;">
            -${formatCRC(deductionsCRC)}
            ${isUSDSalary ? ` <span style="font-size: 12px; color: #666;">(~${formatUSD(deductionsUSD)})</span>` : ''}
          </span>
        </div>
        
        ${isUSDSalary ? `
        <div class="net-pay-usd">
          <div class="total-row" style="padding: 0; align-items: center;">
            <span style="font-size: 18px; font-weight: bold; color: #0d47a1;">💵 TOTAL A DEPOSITAR:</span>
            <span class="total-value-container">
              <div class="total-usd-main" style="font-size: 24px;">${formatUSD(netPayUSD)}</div>
              <div class="total-crc-secondary">${formatCRC(netPayCRC)}</div>
            </span>
          </div>
        </div>
        ` : `
        <div class="total-row net-pay">
          <span>TOTAL A DEPOSITAR:</span>
          <span>${formatCRC(payrollLine.total_to_pay || payrollLine.net_pay)}</span>
        </div>
        `}
      </div>
    </div>

    <div class="footer">
      <p><strong>Colilla generada el ${new Date().toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
      <p>Este documento es una representación electrónica de su recibo de pago</p>
      <p>ID Colilla: ${payslip.payslip_id} | ID Lote: ${payslip.batch.batch_id}${isUSDSalary ? ` | TC: ₡${exchangeRate.toFixed(2)}` : ''}</p>
    </div>
  </div>
</body>
</html>
  `;
}
