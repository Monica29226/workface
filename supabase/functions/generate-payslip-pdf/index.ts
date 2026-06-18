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

    // Get payslip with all related data including new fields
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
          status,
          payroll_type,
          payment_location,
          payment_date
        ),
        employee:employees!inner(
          id,
          employee_id,
          full_name,
          work_email,
          base_salary,
          contract_type,
          currency,
          job_title
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

    // Get payroll line data including new HP fields
    const { data: payrollLine, error: lineError } = await supabaseClient
      .from('payroll_lines')
      .select('*, lpt_banco_popular, mixed_overtime_hours, mixed_overtime_amount, ccss_disability_hours, ins_disability_hours')
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

    // Check if this is "segunda quincena" (2nd fortnight) to look for advance payment
    let advancePayment: number | null = null;
    let advanceBatchId: string | null = null;
    
    if (payslip.batch.payroll_type === 'segunda') {
      // Find the matching "adelanto" batch for the same month/company/employee
      const periodStart = new Date(payslip.batch.period_start);
      const firstDayOfMonth = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
      const midMonth = new Date(periodStart.getFullYear(), periodStart.getMonth(), 15);
      
      console.log('Looking for adelanto batch for segunda quincena:', {
        companyId: payslip.company.id,
        employeeId: payslip.employee_id,
        firstDayOfMonth: firstDayOfMonth.toISOString(),
        midMonth: midMonth.toISOString()
      });
      
      // Find adelanto batch for the same month
      const { data: adelantoBatch, error: adelantoError } = await supabaseClient
        .from('payroll_batches')
        .select('id, batch_id')
        .eq('company_id', payslip.company.id)
        .eq('payroll_type', 'adelanto')
        .gte('period_start', firstDayOfMonth.toISOString().split('T')[0])
        .lte('period_end', midMonth.toISOString().split('T')[0])
        .single();
      
      if (adelantoBatch && !adelantoError) {
        advanceBatchId = adelantoBatch.batch_id;
        
        // Get the payroll line from the adelanto batch for this employee
        const { data: adelantoLine, error: adelantoLineError } = await supabaseClient
          .from('payroll_lines')
          .select('net_pay, total_to_pay')
          .eq('batch_id', adelantoBatch.id)
          .eq('employee_id', payslip.employee_id)
          .single();
        
        if (adelantoLine && !adelantoLineError) {
          advancePayment = adelantoLine.total_to_pay || adelantoLine.net_pay || 0;
          console.log('Found advance payment:', advancePayment, 'from batch:', advanceBatchId);
        }
      }
    }

    // Check if this is Horizonte Positivo - use company-specific template
    const isHorizontePositivo = payslip.company.id === '550e8400-e29b-41d4-a716-446655440000' || 
                                payslip.company.display_name?.toLowerCase().includes('horizonte positivo');

    // Generate HTML for PDF - use company-specific template for Horizonte Positivo
    const html = isHorizontePositivo 
      ? generateHorizontePositivoPayslipHTML(payslip, payrollLine, advancePayment, advanceBatchId)
      : generatePayslipHTML(payslip, payrollLine, advancePayment, advanceBatchId);

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

function generatePayslipHTML(payslip: any, payrollLine: any, advancePayment: number | null = null, advanceBatchId: string | null = null): string {
  const periodStart = new Date(payslip.batch.period_start);
  const periodEnd = new Date(payslip.batch.period_end);
  const periodLabel = `${periodStart.toLocaleDateString('es-CR', { day: '2-digit', month: 'long' })} - ${periodEnd.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  const isSegundaQuincena = payslip.batch.payroll_type === 'segunda';
  
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
      background: linear-gradient(135deg, #0F2A44 0%, #1a3a5c 100%);
      color: white;
      padding: 20px 30px;
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
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 120px;
      min-height: 70px;
    }
    .logo {
      max-width: 100px;
      max-height: 50px;
      object-fit: contain;
    }
    .logo-placeholder {
      width: 100px;
      height: 50px;
      background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      color: #0F2A44;
    }
    .logo-text {
      font-size: 10px;
      color: #999;
      text-align: center;
      margin-top: 5px;
    }
    .header-brand {
      text-align: right;
    }
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
      margin: 0;
      color: #C9A24D;
    }
    .header-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .company-info {
      flex: 1;
    }
    .company-name {
      font-size: 20px;
      font-weight: bold;
      margin: 0;
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
      letter-spacing: 0.5px;
      opacity: 0.8;
      margin-bottom: 3px;
    }
    .period-label {
      font-size: 14px;
      font-weight: 600;
      color: #C9A24D;
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
      <div class="header-top">
        <div class="logo-container">
          ${logoUrl 
            ? `<img src="${logoUrl}" alt="Logo de ${payslip.company.display_name}" class="logo" />`
            : `<div class="logo-placeholder">${payslip.company.display_name.substring(0, 3).toUpperCase()}</div>`
          }
        </div>
        <div class="header-brand">
          <p class="platform-name">ACL Web · Planillas</p>
          <p class="payslip-title">COMPROBANTE DE PAGO</p>
        </div>
      </div>
      <div class="header-bottom">
        <div class="company-info">
          <p class="company-name">${payslip.company.display_name}</p>
          <p class="company-tax-id">Cédula Jurídica: ${payslip.company.tax_id || 'N/A'}</p>
        </div>
        <div class="period-info">
          <p class="period-label-title">Período de Pago</p>
          <p class="period-label">${periodLabel}</p>
        </div>
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
        
        ${isSegundaQuincena && advancePayment && advancePayment > 0 ? `
        <div class="advance-payment-section" style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border: 2px solid #ff9800; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <span style="font-size: 24px;">💰</span>
            <span style="font-size: 16px; font-weight: bold; color: #e65100;">ADELANTO RECIBIDO</span>
          </div>
          <div class="total-row" style="padding: 5px 0;">
            <span style="color: #bf360c;">Adelanto 1ra Quincena ${advanceBatchId ? `(${advanceBatchId})` : ''}:</span>
            <span style="color: #e65100; font-weight: 600; font-size: 16px;">
              -${formatCRC(advancePayment)}
              ${isUSDSalary && exchangeRate ? ` <span style="font-size: 12px; color: #666;">(~${formatUSD(advancePayment / exchangeRate)})</span>` : ''}
            </span>
          </div>
        </div>
        ` : ''}
        
        ${isUSDSalary ? `
        <div class="net-pay-usd">
          <div class="total-row" style="padding: 0; align-items: center;">
            <span style="font-size: 18px; font-weight: bold; color: #0d47a1;">💵 ${isSegundaQuincena && advancePayment ? 'SALDO FINAL A DEPOSITAR' : 'TOTAL A DEPOSITAR'}:</span>
            <span class="total-value-container">
              <div class="total-usd-main" style="font-size: 24px;">${formatUSD(isSegundaQuincena && advancePayment ? (netPayCRC - advancePayment) / exchangeRate : netPayUSD)}</div>
              <div class="total-crc-secondary">${formatCRC(isSegundaQuincena && advancePayment ? netPayCRC - advancePayment : netPayCRC)}</div>
            </span>
          </div>
        </div>
        ` : `
        <div class="total-row net-pay">
          <span>${isSegundaQuincena && advancePayment ? 'SALDO FINAL A DEPOSITAR' : 'TOTAL A DEPOSITAR'}:</span>
          <span>${formatCRC(isSegundaQuincena && advancePayment ? (payrollLine.total_to_pay || payrollLine.net_pay) - advancePayment : (payrollLine.total_to_pay || payrollLine.net_pay))}</span>
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

// =============================================================================
// HORIZONTE POSITIVO - CUSTOM PAYSLIP TEMPLATE (USD BIWEEKLY FORMAT)
// =============================================================================
function generateHorizontePositivoPayslipHTML(payslip: any, payrollLine: any, advancePayment: number | null = null, advanceBatchId: string | null = null): string {
  const periodStart = new Date(payslip.batch.period_start);
  const periodEnd = new Date(payslip.batch.period_end);
  const paymentDate = payslip.batch.payment_date 
    ? new Date(payslip.batch.payment_date).toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' });
  const periodLabel = `${periodStart.toLocaleDateString('es-CR', { day: '2-digit', month: 'long' })} - ${periodEnd.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  const location = payslip.batch.payment_location || 'San José, WeWork Escazú';
  
  // Format USD currency
  const formatUSD = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Employee data
  const employeeName = payslip.employee.full_name;
  const employeeId = payslip.employee.employee_id;
  const jobTitle = payslip.employee.job_title || 'Colaborador';
  const grossMonthlySalary = payslip.employee.base_salary || 0;
  
  // Biweekly salary (50% of monthly)
  const biweeklySalary = grossMonthlySalary / 2;
  
  // Overtime and mixed hours (editable fields, default to 0)
  const overtimeHours = payrollLine.overtime_hours || 0;
  const overtimeAmount = payrollLine.overtime || 0;
  const mixedOvertimeHours = payrollLine.mixed_overtime_hours || 0;
  const mixedOvertimeAmount = payrollLine.mixed_overtime_amount || 0;
  
  // Total benefits
  const totalBenefits = biweeklySalary + overtimeAmount + mixedOvertimeAmount + (payrollLine.additional_bonuses || 0);
  
  // Deductions - HP specific rates
  // LPT Banco Popular - fixed amount per employee
  const lptBancoPopular = payrollLine.lpt_banco_popular || 0;
  
  // SEM Trabajador CCSS - 5.5% of biweekly salary
  const semCCSS = biweeklySalary * 0.055;
  
  // IVM Trabajador CCSS - 4.17% of biweekly salary  
  const ivmCCSS = biweeklySalary * 0.0417;
  
  // Impuesto de Renta - only for monthly gross > $4,000
  // Using CR progressive tax brackets converted to USD
  let incomeTax = 0;
  if (grossMonthlySalary > 4000) {
    // Simplified calculation for HP - would need proper bracket calculation
    // This is a placeholder - real implementation would use company_parameters
    const taxableBase = grossMonthlySalary - 4000;
    incomeTax = (taxableBase * 0.10) / 2; // 10% on excess, divided by 2 for biweekly
  }
  
  // Total deductions
  const totalDeductions = lptBancoPopular + semCCSS + ivmCCSS + incomeTax + (payrollLine.additional_deductions || 0);
  
  // Control fields (editable)
  const ccssDisabilityHours = payrollLine.ccss_disability_hours || 0;
  const insDisabilityHours = payrollLine.ins_disability_hours || 0;
  const absenceHours = payrollLine.absence_days ? payrollLine.absence_days * 8 : 0;
  
  // Total to pay
  const totalToPay = totalBenefits - totalDeductions;
  
  const logoUrl = payslip.company.logo_url;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Comprobante de Pago - ${employeeName}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #fff;
      color: #1a1a2e;
      font-size: 13px;
      padding: 25px;
    }
    .container {
      max-width: 700px;
      margin: 0 auto;
      border: 2px solid #0B2B4C;
      border-radius: 12px;
      overflow: hidden;
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #0B2B4C 0%, #1a4a6e 100%);
      color: white;
      padding: 20px 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo-box {
      background: white;
      border-radius: 8px;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 50px;
    }
    .logo-box img {
      max-width: 70px;
      max-height: 40px;
      object-fit: contain;
    }
    .company-details h1 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .company-details p {
      font-size: 11px;
      opacity: 0.9;
    }
    .header-right {
      text-align: right;
    }
    .payslip-title {
      font-size: 16px;
      font-weight: 700;
      color: #C9A24D;
      margin-bottom: 5px;
    }
    .payslip-subtitle {
      font-size: 11px;
      opacity: 0.8;
    }
    
    /* Content */
    .content {
      padding: 20px 25px;
    }
    
    /* Employee Info Section */
    .employee-section {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px 20px;
      margin-bottom: 20px;
      border-left: 4px solid #2A9D8F;
    }
    .employee-section h2 {
      font-size: 14px;
      color: #0B2B4C;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .employee-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .employee-field {
      display: flex;
      flex-direction: column;
    }
    .employee-field label {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .employee-field span {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }
    .salary-highlight {
      background: #e8f5e9;
      border-radius: 6px;
      padding: 8px 12px;
      text-align: center;
      grid-column: span 2;
      margin-top: 5px;
    }
    .salary-highlight label {
      display: block;
      font-size: 10px;
      color: #2e7d32;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .salary-highlight span {
      font-size: 20px;
      font-weight: 700;
      color: #1b5e20;
    }
    
    /* Table Sections */
    .section {
      margin-bottom: 15px;
    }
    .section-header {
      background: #0B2B4C;
      color: white;
      padding: 8px 15px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      border-radius: 6px 6px 0 0;
    }
    .section-body {
      border: 1px solid #e0e0e0;
      border-top: none;
      border-radius: 0 0 6px 6px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      border-bottom: 1px solid #f0f0f0;
    }
    .row:last-child {
      border-bottom: none;
    }
    .row-label {
      color: #444;
    }
    .row-value {
      font-weight: 600;
    }
    .row-value.income {
      color: #2e7d32;
    }
    .row-value.deduction {
      color: #c62828;
    }
    .row-total {
      background: #f5f5f5;
      font-weight: 700;
    }
    .row-total .row-value {
      font-size: 15px;
    }
    
    /* Control Fields */
    .control-section {
      background: #fff3e0;
      border: 1px solid #ffcc80;
      border-radius: 8px;
      padding: 12px 15px;
      margin-bottom: 15px;
    }
    .control-section h3 {
      font-size: 11px;
      color: #e65100;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .control-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .control-field {
      text-align: center;
    }
    .control-field label {
      display: block;
      font-size: 9px;
      color: #666;
      margin-bottom: 3px;
    }
    .control-field span {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }
    
    /* Period Info */
    .period-info {
      background: #e3f2fd;
      border: 1px solid #90caf9;
      border-radius: 8px;
      padding: 12px 15px;
      margin-bottom: 15px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }
    .period-field {
      text-align: center;
    }
    .period-field label {
      display: block;
      font-size: 9px;
      color: #1565c0;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .period-field span {
      font-size: 12px;
      font-weight: 600;
      color: #0d47a1;
    }
    
    /* Total to Pay */
    .total-section {
      background: linear-gradient(135deg, #2A9D8F 0%, #1a7a6e 100%);
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      margin-top: 20px;
    }
    .total-label {
      font-size: 12px;
      color: rgba(255,255,255,0.9);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .total-amount {
      font-size: 32px;
      font-weight: 700;
      color: white;
    }
    .total-calc {
      font-size: 11px;
      color: rgba(255,255,255,0.8);
      margin-top: 8px;
    }
    
    /* Footer */
    .footer {
      background: #f8f9fa;
      padding: 15px 25px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
      font-size: 10px;
      color: #666;
    }
    .footer p {
      margin: 3px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <div class="logo-box">
          ${logoUrl 
            ? `<img src="${logoUrl}" alt="${payslip.company.display_name}" />`
            : `<span style="font-weight:bold;color:#0B2B4C;font-size:14px;">HP</span>`
          }
        </div>
        <div class="company-details">
          <h1>${payslip.company.display_name}</h1>
          <p>Cédula: ${payslip.company.tax_id || '3-002-674691'}</p>
        </div>
      </div>
      <div class="header-right">
        <p class="payslip-title">COMPROBANTE DE PAGO</p>
        <p class="payslip-subtitle">Frecuencia: Quincenal</p>
      </div>
    </div>
    
    <div class="content">
      <!-- 1. Employee Data Section -->
      <div class="employee-section">
        <h2>📋 Datos del Colaborador</h2>
        <div class="employee-grid">
          <div class="employee-field">
            <label>Nombre Completo</label>
            <span>${employeeName}</span>
          </div>
          <div class="employee-field">
            <label>Número de Identificación</label>
            <span>${employeeId}</span>
          </div>
          <div class="employee-field">
            <label>Puesto</label>
            <span>${jobTitle}</span>
          </div>
          <div class="employee-field">
            <label>Salario Bruto Mensual</label>
            <span>${formatUSD(grossMonthlySalary)}</span>
          </div>
        </div>
      </div>
      
      <!-- 2. Benefits Section -->
      <div class="section">
        <div class="section-header">💰 Beneficios</div>
        <div class="section-body">
          <div class="row">
            <span class="row-label">Salario Quincenal (Bruto / 2)</span>
            <span class="row-value income">${formatUSD(biweeklySalary)}</span>
          </div>
          <div class="row">
            <span class="row-label">Horas Extras${overtimeHours > 0 ? ` (${overtimeHours} hrs)` : ''}</span>
            <span class="row-value income">${formatUSD(overtimeAmount)}</span>
          </div>
          <div class="row">
            <span class="row-label">Horas Mixtas${mixedOvertimeHours > 0 ? ` (${mixedOvertimeHours} hrs)` : ''}</span>
            <span class="row-value income">${formatUSD(mixedOvertimeAmount)}</span>
          </div>
          ${payrollLine.additional_bonuses > 0 ? `
          <div class="row">
            <span class="row-label">Bonificaciones Adicionales</span>
            <span class="row-value income">+${formatUSD(payrollLine.additional_bonuses)}</span>
          </div>
          ` : ''}
          <div class="row row-total">
            <span class="row-label">TOTAL BENEFICIOS</span>
            <span class="row-value income">${formatUSD(totalBenefits)}</span>
          </div>
        </div>
      </div>
      
      <!-- 3. Deductions Section -->
      <div class="section">
        <div class="section-header">📋 Deducciones</div>
        <div class="section-body">
          <div class="row">
            <span class="row-label">LPT Banco Popular</span>
            <span class="row-value deduction">-${formatUSD(lptBancoPopular)}</span>
          </div>
          <div class="row">
            <span class="row-label">SEM Trabajador CCSS (5.5%)</span>
            <span class="row-value deduction">-${formatUSD(semCCSS)}</span>
          </div>
          <div class="row">
            <span class="row-label">IVM Trabajador CCSS (4.17%)</span>
            <span class="row-value deduction">-${formatUSD(ivmCCSS)}</span>
          </div>
          ${incomeTax > 0 ? `
          <div class="row">
            <span class="row-label">Impuesto de Renta</span>
            <span class="row-value deduction">-${formatUSD(incomeTax)}</span>
          </div>
          ` : ''}
          ${payrollLine.additional_deductions > 0 ? `
          <div class="row">
            <span class="row-label">Otras Deducciones</span>
            <span class="row-value deduction">-${formatUSD(payrollLine.additional_deductions)}</span>
          </div>
          ` : ''}
          <div class="row row-total">
            <span class="row-label">TOTAL DEDUCCIONES</span>
            <span class="row-value deduction">-${formatUSD(totalDeductions)}</span>
          </div>
        </div>
      </div>
      
      <!-- 4. Control Fields -->
      <div class="control-section">
        <h3>⚙️ Campos de Control</h3>
        <div class="control-grid">
          <div class="control-field">
            <label>Horas Incapacidad CCSS</label>
            <span>${ccssDisabilityHours.toFixed(2)}</span>
          </div>
          <div class="control-field">
            <label>Horas Incapacidad INS</label>
            <span>${insDisabilityHours.toFixed(2)}</span>
          </div>
          <div class="control-field">
            <label>Horas de Ausencia</label>
            <span>${absenceHours.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <!-- 5. Period Information -->
      <div class="period-info">
        <div class="period-field">
          <label>Fecha de Pago</label>
          <span>${paymentDate}</span>
        </div>
        <div class="period-field">
          <label>Período</label>
          <span>${periodLabel}</span>
        </div>
        <div class="period-field">
          <label>Ubicación</label>
          <span>${location}</span>
        </div>
      </div>
      
      <!-- 6. Advance Payment (if segunda quincena) -->
      ${advancePayment && advancePayment > 0 ? `
      <div class="advance-section" style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border: 2px solid #ff9800; border-radius: 10px; padding: 15px 20px; margin-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <span style="font-size: 24px;">💰</span>
          <span style="font-size: 16px; font-weight: bold; color: #e65100;">ADELANTO RECIBIDO</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #bf360c;">Adelanto 1ra Quincena ${advanceBatchId ? `(${advanceBatchId})` : ''}:</span>
          <span style="color: #e65100; font-weight: bold; font-size: 18px;">-${formatUSD(advancePayment)}</span>
        </div>
      </div>
      ` : ''}
      
      <!-- 7. Total to Pay -->
      <div class="total-section">
        <p class="total-label">${advancePayment && advancePayment > 0 ? 'Saldo Final a Depositar' : 'Total a Pagar'}</p>
        <p class="total-amount">${formatUSD(advancePayment && advancePayment > 0 ? totalToPay - advancePayment : totalToPay)}</p>
        <p class="total-calc">${advancePayment && advancePayment > 0 
          ? `Neto (${formatUSD(totalToPay)}) - Adelanto (${formatUSD(advancePayment)})`
          : `Beneficios (${formatUSD(totalBenefits)}) - Deducciones (${formatUSD(totalDeductions)})`
        }</p>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Comprobante generado el ${new Date().toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
      <p>Este documento es una representación electrónica de su recibo de pago | Moneda: USD</p>
      <p>ID: ${payslip.payslip_id} | Lote: ${payslip.batch.batch_id}</p>
    </div>
  </div>
</body>
</html>
  `;
}
