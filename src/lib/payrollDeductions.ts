/**
 * ============================================================================
 * FÓRMULA CANÓNICA DE DEDUCCIONES — Costa Rica
 * ============================================================================
 * ÚNICA fuente de verdad en el frontend. Debe coincidir 1:1 con la edge
 * function `supabase/functions/process-payroll/index.ts`.
 *
 * Sector privado (NO educación):
 *   - CCSS obrero = company_parameters.ccss_obrero_total% × salario BRUTO
 *     (el parámetro 10.67% YA INCLUYE Banco Popular obrero 1% + CCSS 9.67%,
 *      todo en una sola línea: "CCSS + B. Popular").
 *   - ISR = se calcula sobre el salario BRUTO (NO bruto − CCSS), usando los
 *     tramos renta_bracket_*_limit / renta_bracket_*_rate.
 *
 * Sector educación (is_education_sector = true):
 *   - CCSS obrero = ccss_obrero_education% × bruto
 *   - Magisterio  = magisterio_rate% × bruto
 *   - Póliza vida = poliza_vida_fija (monto FIJO)
 *   - ISR sigue calculándose sobre el BRUTO.
 *
 * Préstamos y otros descuentos se suman aparte (loanDeduction, additional).
 * ============================================================================
 */

export interface PayrollCompanyParams {
  is_education_sector?: boolean | null;
  ccss_obrero_total?: number | null;
  ccss_obrero_education?: number | null;
  magisterio_rate?: number | null;
  poliza_vida_fija?: number | null;
  renta_bracket_1_limit?: number | null;
  renta_bracket_1_rate?: number | null;
  renta_bracket_2_limit?: number | null;
  renta_bracket_2_rate?: number | null;
  renta_bracket_3_limit?: number | null;
  renta_bracket_3_rate?: number | null;
  renta_bracket_4_limit?: number | null;
  renta_bracket_4_rate?: number | null;
  renta_bracket_5_rate?: number | null;
}

export interface ISRBreakdown {
  total: number;
  isr_10: number;
  isr_15: number;
  isr_20: number;
  isr_25: number;
}

export interface DeductionLineItem {
  code: string;
  label: string;
  rate?: number;     // porcentaje (ej. 10.67)
  amount: number;    // monto en CRC
}

export interface DeductionsResult {
  baseImponible: number;
  ccssObrero: number;
  ccssRate: number;          // porcentaje aplicado
  ccssLabel: string;         // "CCSS + B. Popular (10.67%)" o "CCSS Educación (6.7%)"
  magisterio: number;
  polizaVida: number;
  isr: number;
  isrBreakdown: ISRBreakdown;
  loan: number;
  additional: number;
  items: DeductionLineItem[];
  totalDeducciones: number;
  netPay: number;
}

export interface DeductionsInput {
  grossSalary: number;        // bruto mensual en CRC
  params: PayrollCompanyParams | null | undefined;
  loanDeduction?: number;     // préstamos del periodo
  additionalDeductions?: number; // otros descuentos puntuales
}

function calcISR(base: number, p: PayrollCompanyParams): ISRBreakdown {
  const b1 = Number(p.renta_bracket_1_limit ?? 918000);
  const b2 = Number(p.renta_bracket_2_limit ?? 1347000);
  const b3 = Number(p.renta_bracket_3_limit ?? 2364000);
  const b4 = Number(p.renta_bracket_4_limit ?? 4727000);
  const r2 = Number(p.renta_bracket_2_rate ?? 10) / 100;
  const r3 = Number(p.renta_bracket_3_rate ?? 15) / 100;
  const r4 = Number(p.renta_bracket_4_rate ?? 20) / 100;
  const r5 = Number(p.renta_bracket_5_rate ?? 25) / 100;

  let isr_10 = 0, isr_15 = 0, isr_20 = 0, isr_25 = 0;
  if (base > b1) isr_10 = (Math.min(base, b2) - b1) * r2;
  if (base > b2) isr_15 = (Math.min(base, b3) - b2) * r3;
  if (base > b3) isr_20 = (Math.min(base, b4) - b3) * r4;
  if (base > b4) isr_25 = (base - b4) * r5;

  return {
    isr_10: Math.round(isr_10),
    isr_15: Math.round(isr_15),
    isr_20: Math.round(isr_20),
    isr_25: Math.round(isr_25),
    total: Math.round(isr_10 + isr_15 + isr_20 + isr_25),
  };
}

/**
 * Función canónica única. NO usar otra fórmula en el frontend.
 */
export function calculatePayrollDeductions(input: DeductionsInput): DeductionsResult {
  const gross = Math.max(0, Number(input.grossSalary) || 0);
  const loan = Math.max(0, Number(input.loanDeduction) || 0);
  const additional = Math.max(0, Number(input.additionalDeductions) || 0);
  const p: PayrollCompanyParams = input.params ?? {};

  const isEducation = !!p.is_education_sector;

  // CCSS obrero
  const ccssRate = isEducation
    ? Number(p.ccss_obrero_education ?? 6.7)
    : Number(p.ccss_obrero_total ?? 10.67);
  const ccssObrero = Math.round(gross * (ccssRate / 100));
  const ccssLabel = isEducation
    ? `CCSS Educación (${ccssRate}%)`
    : `CCSS + B. Popular (${ccssRate}%)`;

  // Magisterio + Póliza (solo educación)
  const magisterioRate = isEducation ? Number(p.magisterio_rate ?? 0) : 0;
  const magisterio = Math.round(gross * (magisterioRate / 100));
  const polizaVida = isEducation ? Number(p.poliza_vida_fija ?? 0) : 0;

  // ISR — sobre el BRUTO
  const isrBreakdown = calcISR(gross, p);
  const isr = isrBreakdown.total;

  const items: DeductionLineItem[] = [
    { code: 'ccss_obrero', label: ccssLabel, rate: ccssRate, amount: ccssObrero },
  ];
  if (magisterio > 0) items.push({ code: 'magisterio', label: `Magisterio (${magisterioRate}%)`, rate: magisterioRate, amount: magisterio });
  if (polizaVida > 0) items.push({ code: 'poliza_vida', label: 'Póliza de Vida', amount: polizaVida });
  if (isr > 0)        items.push({ code: 'isr', label: 'Impuesto sobre la Renta', amount: isr });
  if (loan > 0)       items.push({ code: 'loan', label: 'Préstamos', amount: loan });
  if (additional > 0) items.push({ code: 'otros', label: 'Otros descuentos', amount: additional });

  const totalDeducciones = ccssObrero + magisterio + polizaVida + isr + loan + additional;
  const netPay = gross - totalDeducciones;

  return {
    baseImponible: gross,
    ccssObrero,
    ccssRate,
    ccssLabel,
    magisterio,
    polizaVida,
    isr,
    isrBreakdown,
    loan,
    additional,
    items,
    totalDeducciones,
    netPay,
  };
}
