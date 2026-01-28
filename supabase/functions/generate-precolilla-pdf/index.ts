import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

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

    // Generate PDF
    const pdfBytes = generatePreColillaPDF(payrollLine, company);

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pre-colilla-${payrollLine.employee.employee_id}-${payrollLine.batch.period_end}.pdf"`,
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

function generatePreColillaPDF(payrollLine: any, company: any): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  // Colors
  const primaryColor = [15, 42, 68]; // #0F2A44
  const goldColor = [201, 162, 77]; // #C9A24D
  const greenColor = [46, 125, 50]; // #2e7d32
  const redColor = [198, 40, 40]; // #c62828
  const blueColor = [25, 118, 210]; // #1976d2
  const grayColor = [100, 100, 100];
  const lightGray = [248, 249, 250];

  // Helper functions - Use proper colon symbol
  const formatNumber = (num: number, decimals = 0) => {
    return new Intl.NumberFormat('es-CR', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    }).format(num || 0);
  };
  // FIXED: Using proper colon symbol (₡) - Unicode \u20A1
  const formatCRC = (amount: number) => `\u20A1${formatNumber(amount, 0)}`;

  // Parse data
  const periodStart = new Date(payrollLine.batch.period_start);
  const periodEnd = new Date(payrollLine.batch.period_end);
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const periodLabel = `${periodStart.getDate()} ${months[periodStart.getMonth()]} - ${periodEnd.getDate()} ${months[periodEnd.getMonth()]} ${periodEnd.getFullYear()}`;

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

  const grossSalaryCRC = Number(payrollLine.gross_salary);
  const netPayCRC = Number(payrollLine.net_pay);
  const hireDate = payrollLine.employee.hire_date 
    ? new Date(payrollLine.employee.hire_date).toLocaleDateString('es-CR')
    : 'N/A';

  // Calculate vacation days accrued based on months worked (1 day per month as per Costa Rican law)
  // For biweekly payroll = 0.5 days per period
  const isBiweekly = payrollLine.batch.frequency === 'quincenal';
  const vacationDaysAccrued = isBiweekly ? 0.5 : 1.0;

  let y = 15;
  const marginLeft = 15;
  const pageWidth = 216; // Letter width in mm
  const contentWidth = pageWidth - 30;

  // ===== HEADER WITH COMPANY LOGO =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Try to add company logo if available
  let logoAdded = false;
  if (company.logo_url) {
    try {
      // Logo placeholder - will be positioned at left
      // For now, we'll add a placeholder circle since we can't fetch external images easily
      doc.setFillColor(255, 255, 255);
      doc.circle(marginLeft + 12, 22, 10, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...primaryColor);
      doc.text("LOGO", marginLeft + 12, 24, { align: 'center' });
      logoAdded = true;
    } catch (e) {
      console.warn("Could not add logo:", e);
    }
  }

  const textStartX = logoAdded ? marginLeft + 30 : marginLeft;

  // Platform name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("ACL WORKFORCE HUB", pageWidth - marginLeft, 12, { align: 'right' });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...goldColor);
  doc.text("Pre-Colilla", pageWidth - marginLeft, 22, { align: 'right' });

  // Company name
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(company.display_name, textStartX, 22);

  if (company.tax_id) {
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(`Cedula Juridica: ${company.tax_id}`, textStartX, 28);
  }

  // Period
  doc.setFontSize(9);
  doc.setTextColor(...goldColor);
  doc.text(`Periodo: ${periodLabel}`, textStartX, 38);

  y = 50;

  // ===== DRAFT WARNING BANNER =====
  doc.setFillColor(255, 243, 205);
  doc.rect(marginLeft, y, contentWidth, 10, 'F');
  doc.setDrawColor(255, 193, 7);
  doc.setLineWidth(0.5);
  doc.rect(marginLeft, y, contentWidth, 10, 'S');
  doc.setTextColor(133, 100, 4);
  doc.setFontSize(9);
  doc.text("DOCUMENTO DE VALIDACION - NO ES COMPROBANTE OFICIAL", pageWidth / 2, y + 6.5, { align: 'center' });

  y += 18;

  // ===== COLLABORATOR INFO =====
  doc.setFillColor(...lightGray);
  doc.roundedRect(marginLeft, y, contentWidth, 22, 2, 2, 'F');

  const infoY = y + 6;
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);

  const infoCol1 = marginLeft + 5;
  const infoCol2 = marginLeft + 55;
  const infoCol3 = marginLeft + 105;
  const infoCol4 = marginLeft + 150;

  doc.text("COLABORADOR", infoCol1, infoY);
  doc.text("CEDULA / ID", infoCol2, infoY);
  doc.text("FECHA INGRESO", infoCol3, infoY);
  doc.text("CENTRO DE COSTO", infoCol4, infoY);

  doc.setFontSize(10);
  doc.setTextColor(26, 26, 46);
  doc.text(payrollLine.employee.full_name.substring(0, 25), infoCol1, infoY + 8);
  doc.text(payrollLine.employee.employee_id, infoCol2, infoY + 8);
  doc.text(hireDate, infoCol3, infoY + 8);
  doc.text((payrollLine.cost_center?.name || 'N/A').substring(0, 18), infoCol4, infoY + 8);

  y += 30;

  // ===== HOURS WORKED =====
  doc.setFillColor(...primaryColor);
  doc.roundedRect(marginLeft, y, contentWidth, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("HORAS TRABAJADAS", marginLeft + 5, y + 5.5);

  y += 10;

  const hoursBoxWidth = (contentWidth - 15) / 4;
  const hoursData = [
    { label: "Ordinarias", value: Number(payrollLine.regular_hours) || 0 },
    { label: "Extra", value: Number(payrollLine.overtime_hours) || 0 },
    { label: "Vacaciones", value: `${Number(payrollLine.vacation_days_taken) || 0} dias` },
    { label: "Ausencias", value: Number(payrollLine.absence_days) || 0 },
  ];

  hoursData.forEach((item, i) => {
    const boxX = marginLeft + (i * (hoursBoxWidth + 5));
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(boxX, y, hoursBoxWidth, 18, 2, 2, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(...grayColor);
    doc.text(item.label.toUpperCase(), boxX + hoursBoxWidth / 2, y + 6, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 46);
    doc.text(String(item.value), boxX + hoursBoxWidth / 2, y + 14, { align: 'center' });
  });

  y += 25;

  // ===== EARNINGS SECTION =====
  doc.setFillColor(...greenColor);
  doc.roundedRect(marginLeft, y, contentWidth, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("INGRESOS", marginLeft + 5, y + 5.5);

  y += 10;

  const drawRow = (label: string, value: string, isTotal = false, color?: number[]) => {
    if (isTotal) {
      doc.setFillColor(240, 255, 240);
      doc.rect(marginLeft, y - 1, contentWidth, 8, 'F');
    }
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text(label, marginLeft + 5, y + 4);
    doc.setTextColor(...(color || [26, 26, 46]));
    if (isTotal) doc.setFont(undefined, 'bold');
    doc.text(value, marginLeft + contentWidth - 5, y + 4, { align: 'right' });
    doc.setFont(undefined, 'normal');
    y += 8;
  };

  drawRow("Salario Base", formatCRC(grossSalaryCRC));
  if (Number(payrollLine.overtime) > 0) {
    drawRow("Horas Extra", `+${formatCRC(Number(payrollLine.overtime))}`, false, greenColor);
  }
  if (Number(payrollLine.additional_bonuses) > 0) {
    drawRow("Bonificaciones", `+${formatCRC(Number(payrollLine.additional_bonuses))}`, false, greenColor);
  }
  const totalIngresos = grossSalaryCRC + Number(payrollLine.overtime || 0) + Number(payrollLine.additional_bonuses || 0);
  drawRow("Total Ingresos", formatCRC(totalIngresos), true, greenColor);

  y += 5;

  // ===== DEDUCTIONS SECTION =====
  doc.setFillColor(...redColor);
  doc.roundedRect(marginLeft, y, contentWidth, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("DEDUCCIONES", marginLeft + 5, y + 5.5);

  y += 10;

  if (deductionsDetail.ccss_obrero) {
    drawRow(`CCSS Obrero (${deductionsDetail.ccss_rate || 10.83}%)`, `-${formatCRC(deductionsDetail.ccss_obrero)}`, false, redColor);
  }
  if (deductionsDetail.isr_neto > 0) {
    drawRow("Impuesto sobre la Renta", `-${formatCRC(deductionsDetail.isr_neto)}`, false, redColor);
  }
  if (deductionsDetail.magisterio > 0) {
    drawRow("Magisterio Nacional", `-${formatCRC(deductionsDetail.magisterio)}`, false, redColor);
  }
  if (deductionsDetail.poliza_vida > 0) {
    drawRow("Poliza de Vida", `-${formatCRC(deductionsDetail.poliza_vida)}`, false, redColor);
  }
  if (deductionsDetail.loan_deduction > 0) {
    drawRow("Prestamos", `-${formatCRC(deductionsDetail.loan_deduction)}`, false, redColor);
  }
  if (Number(payrollLine.additional_deductions) > 0) {
    drawRow("Otras Deducciones", `-${formatCRC(Number(payrollLine.additional_deductions))}`, false, redColor);
  }

  // Total deductions with red background
  doc.setFillColor(255, 240, 240);
  doc.rect(marginLeft, y - 1, contentWidth, 8, 'F');
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...grayColor);
  doc.text("Total Deducciones", marginLeft + 5, y + 4);
  doc.setTextColor(...redColor);
  doc.text(`-${formatCRC(Number(payrollLine.deductions))}`, marginLeft + contentWidth - 5, y + 4, { align: 'right' });
  doc.setFont(undefined, 'normal');
  y += 12;

  // ===== ACCRUALS SECTION =====
  doc.setFillColor(...blueColor);
  doc.roundedRect(marginLeft, y, contentWidth, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("PROVISIONES DEL PERIODO", marginLeft + 5, y + 5.5);

  y += 10;

  // Vacation days - 1 day per month worked (Costa Rican law)
  const vacationLabel = isBiweekly ? "Vacaciones Acumuladas (0.5 dias/quincena)" : "Vacaciones Acumuladas (1 dia/mes)";
  drawRow(vacationLabel, `${vacationDaysAccrued.toFixed(2)} dias`);
  drawRow("Aguinaldo Acumulado", formatCRC(Number(payrollLine.aguinaldo_accrued || 0)));

  y += 8;

  // ===== NET PAY BOX =====
  doc.setFillColor(...greenColor);
  doc.roundedRect(marginLeft, y, contentWidth, 30, 4, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("TOTAL A DEPOSITAR", pageWidth / 2, y + 10, { align: 'center' });

  doc.setFontSize(22);
  doc.text(formatCRC(netPayCRC), pageWidth / 2, y + 24, { align: 'center' });

  y += 40;

  // ===== FOOTER =====
  doc.setFillColor(255, 243, 205);
  doc.roundedRect(marginLeft, y, contentWidth, 12, 2, 2, 'F');
  doc.setTextColor(133, 100, 4);
  doc.setFontSize(8);
  doc.text("Este es un documento de pre-visualizacion para validacion interna.", pageWidth / 2, y + 5, { align: 'center' });
  doc.text("NO debe ser enviado al empleado como comprobante oficial.", pageWidth / 2, y + 10, { align: 'center' });

  y += 18;

  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.text("ACL Workforce HUB - Gestion de Nomina Costa Rica", pageWidth / 2, y, { align: 'center' });
  doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, pageWidth / 2, y + 5, { align: 'center' });

  // Return as Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}
