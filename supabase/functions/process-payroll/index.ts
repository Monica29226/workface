// AUREON Payroll Processing - Multi-company with per-company deduction rules
// IMPORTANT: All deductions are calculated from company_parameters using company_id
// USD salaries are converted to CRC using BCCR exchange rate
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessPayrollRequest {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  frequency: 'mensual' | 'quincenal' | 'semanal';
  payrollType?: 'adelanto' | 'segunda' | 'completa';
  copyFromBatchId?: string;
  manualExchangeRate?: number; // si viene, se usa en vez del BCCR
}


interface CompanyParameters {
  is_education_sector: boolean;
  magisterio_rate: number;
  poliza_vida_fija: number;
  ccss_obrero_education: number;
  ccss_obrero_total: number;
  ccss_patronal_total: number;
  ina_rate: number;
  imas_rate: number;
  fodesaf_rate: number;
  banco_popular_patronal: number;
  ins_riesgos_trabajo: number;
  renta_bracket_1_limit: number;
  renta_bracket_1_rate: number;
  renta_bracket_2_limit: number;
  renta_bracket_2_rate: number;
  renta_bracket_3_limit: number;
  renta_bracket_3_rate: number;
  renta_bracket_4_limit: number;
  renta_bracket_4_rate: number;
  renta_bracket_5_rate: number;
}

interface DeductionItem {
  code: string;
  label: string;
  type: 'percentage' | 'fixed' | 'calculated';
  rate?: number;
  amount: number;
}

interface DeductionsDetail {
  items: DeductionItem[];
  total_deductions: number;
  payroll_type?: string;
  is_biweekly?: boolean;
  deduction_multiplier?: number;
}

// Function to fetch BCCR exchange rate
async function fetchBCCRExchangeRate(date: string): Promise<{ venta: number; fecha: string } | null> {
  try {
    const token = Deno.env.get('BCCR_TOKEN');
    const email = Deno.env.get('BCCR_EMAIL');
    const nombre = Deno.env.get('BCCR_NOMBRE') || 'Sistema Planillas';

    if (!token || !email) {
      console.warn('BCCR credentials not configured, cannot fetch exchange rate');
      return null;
    }

    // Convert YYYY-MM-DD to DD/MM/YYYY format required by BCCR
    const [year, month, day] = date.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    console.log(`Fetching BCCR exchange rate for date: ${date} (${formattedDate})`);

    const url = `https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicosXML?Indicador=318&FechaInicio=${formattedDate}&FechaFinal=${formattedDate}&Nombre=${encodeURIComponent(nombre)}&SubNiveles=N&CorreoElectronico=${encodeURIComponent(email)}&Token=${token}`;

    const response = await fetch(url);
    const xmlText = await response.text();

    const valueMatch = xmlText.match(/<NUM_VALOR>([\d.]+)<\/NUM_VALOR>/);
    
    if (!valueMatch) {
      console.error('Could not extract NUM_VALOR from BCCR response');
      return null;
    }

    const venta = parseFloat(valueMatch[1]);
    console.log(`BCCR exchange rate retrieved: ${venta} CRC/USD for ${date}`);
    
    return { venta, fecha: date };
  } catch (error) {
    console.error('Error fetching BCCR exchange rate:', error);
    return null;
  }
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

    const { companyId, periodStart, periodEnd, frequency, payrollType = 'completa', copyFromBatchId, manualExchangeRate }: ProcessPayrollRequest = await req.json();

    
    // Biweekly payroll: adelanto = 50% net with 50% deductions, segunda = remaining 50%
    const isBiweekly = frequency === 'quincenal';
    const deductionMultiplier = isBiweekly ? 0.5 : 1.0;  // Apply 50% of deductions for each half
    const payrollTypeLabel = payrollType === 'adelanto' ? 'Adelanto de Salario' : 
                             payrollType === 'segunda' ? 'Segunda Quincena' : 'Planilla Completa';
    
    console.log(`Processing ${payrollTypeLabel} for company:`, companyId, { frequency, payrollType, deductionMultiplier });

    console.log("Processing payroll for company:", companyId);

    // Get company info
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      console.error("Company error:", companyError);
      return new Response(
        JSON.stringify({ error: "Empresa no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Get company parameters - ALL deductions are company-specific
    const { data: companyParams, error: paramsError } = await supabaseClient
      .from('company_parameters')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (paramsError) {
      console.warn("Company parameters not found, using defaults:", paramsError);
    }

    // ========================================
    // 2026 COSTA RICA ISR BRACKETS (OFFICIAL)
    // Validated against Ministerio de Hacienda
    // ========================================
    const ISR_2026_BRACKETS = {
      bracket_1_limit: 918000,   // 0% up to ₡918,000
      bracket_2_limit: 1347000,  // 10% from ₡918,000 to ₡1,347,000
      bracket_3_limit: 2364000,  // 15% from ₡1,347,000 to ₡2,364,000
      bracket_4_limit: 4727000,  // 20% from ₡2,364,000 to ₡4,727,000
      // 25% above ₡4,727,000
    };

    // Validate company ISR brackets against 2026 official values
    const validateISRBrackets = () => {
      const warnings: string[] = [];
      
      if (companyParams) {
        if (companyParams.renta_bracket_1_limit && companyParams.renta_bracket_1_limit !== ISR_2026_BRACKETS.bracket_1_limit) {
          warnings.push(`ISR Tramo 1: Configurado ₡${companyParams.renta_bracket_1_limit.toLocaleString()}, vigente ₡${ISR_2026_BRACKETS.bracket_1_limit.toLocaleString()}`);
        }
        if (companyParams.renta_bracket_2_limit && companyParams.renta_bracket_2_limit !== ISR_2026_BRACKETS.bracket_2_limit) {
          warnings.push(`ISR Tramo 2: Configurado ₡${companyParams.renta_bracket_2_limit.toLocaleString()}, vigente ₡${ISR_2026_BRACKETS.bracket_2_limit.toLocaleString()}`);
        }
        if (companyParams.renta_bracket_3_limit && companyParams.renta_bracket_3_limit !== ISR_2026_BRACKETS.bracket_3_limit) {
          warnings.push(`ISR Tramo 3: Configurado ₡${companyParams.renta_bracket_3_limit.toLocaleString()}, vigente ₡${ISR_2026_BRACKETS.bracket_3_limit.toLocaleString()}`);
        }
        if (companyParams.renta_bracket_4_limit && companyParams.renta_bracket_4_limit !== ISR_2026_BRACKETS.bracket_4_limit) {
          warnings.push(`ISR Tramo 4: Configurado ₡${companyParams.renta_bracket_4_limit.toLocaleString()}, vigente ₡${ISR_2026_BRACKETS.bracket_4_limit.toLocaleString()}`);
        }
      }
      
      return warnings;
    };

    const isrValidationWarnings = validateISRBrackets();
    if (isrValidationWarnings.length > 0) {
      console.warn('⚠️ ISR BRACKET VALIDATION WARNINGS:', isrValidationWarnings);
    }

    // Build parameters from company_parameters table
    // ALWAYS use 2026 official ISR brackets as defaults
    const params: CompanyParameters = {
      is_education_sector: companyParams?.is_education_sector || false,
      magisterio_rate: companyParams?.magisterio_rate || 0,
      poliza_vida_fija: companyParams?.poliza_vida_fija || 0,
      ccss_obrero_education: companyParams?.ccss_obrero_education || 6.70,
      ccss_obrero_total: companyParams?.ccss_obrero_total || 10.67,
      ccss_patronal_total: companyParams?.ccss_patronal_total || 26.67,
      ina_rate: companyParams?.ina_rate || 1.50,
      imas_rate: companyParams?.imas_rate || 0.50,
      fodesaf_rate: companyParams?.fodesaf_rate || 5.00,
      banco_popular_patronal: companyParams?.banco_popular_patronal || 0.25,
      ins_riesgos_trabajo: companyParams?.ins_riesgos_trabajo || 1.50,
      // 2026 ISR brackets - use official values as defaults
      renta_bracket_1_limit: companyParams?.renta_bracket_1_limit || ISR_2026_BRACKETS.bracket_1_limit,
      renta_bracket_1_rate: companyParams?.renta_bracket_1_rate || 0,
      renta_bracket_2_limit: companyParams?.renta_bracket_2_limit || ISR_2026_BRACKETS.bracket_2_limit,
      renta_bracket_2_rate: companyParams?.renta_bracket_2_rate || 10,
      renta_bracket_3_limit: companyParams?.renta_bracket_3_limit || ISR_2026_BRACKETS.bracket_3_limit,
      renta_bracket_3_rate: companyParams?.renta_bracket_3_rate || 15,
      renta_bracket_4_limit: companyParams?.renta_bracket_4_limit || ISR_2026_BRACKETS.bracket_4_limit,
      renta_bracket_4_rate: companyParams?.renta_bracket_4_rate || 20,
      renta_bracket_5_rate: companyParams?.renta_bracket_5_rate || 25,
    };

    console.log("Company parameters loaded:", { 
      companyId,
      isEducation: params.is_education_sector, 
      magisterio: params.magisterio_rate,
      poliza: params.poliza_vida_fija,
      ccssObrero: params.is_education_sector ? params.ccss_obrero_education : params.ccss_obrero_total
    });

    // Get active employees
    const { data: employees, error: employeesError } = await supabaseClient
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'activo');

    if (employeesError) {
      console.error("Employees error:", employeesError);
      return new Response(
        JSON.stringify({ error: "Error al obtener empleados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay empleados activos para procesar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payroll batch
    const typePrefix = payrollType === 'adelanto' ? 'ADL' : payrollType === 'segunda' ? 'Q2' : 'BATCH';
    const batchId = `${typePrefix}-${new Date(periodStart).getFullYear()}${String(new Date(periodStart).getMonth() + 1).padStart(2, '0')}-${Date.now()}`;
    
    const { data: batch, error: batchError } = await supabaseClient
      .from('payroll_batches')
      .insert({
        company_id: companyId,
        batch_id: batchId,
        period_start: periodStart,
        period_end: periodEnd,
        frequency: frequency,
        payroll_type: payrollType,  // Store the payroll type
        base_currency: company.base_currency,
        status: 'borrador',
        created_by: user.id
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error("Batch creation error:", batchError);
      return new Response(
        JSON.stringify({ error: "Error al crear lote de planilla" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Payroll batch created:", batch.id);

    // ========================================
    // FETCH BCCR EXCHANGE RATE FOR USD EMPLOYEES
    // ========================================
    const hasUSDEmployees = employees.some(e => e.currency === 'USD');
    let bccrExchangeRate: number | null = null;

    if (hasUSDEmployees) {
      if (manualExchangeRate && manualExchangeRate > 0) {
        bccrExchangeRate = Number(manualExchangeRate);
        console.log(`Using MANUAL exchange rate: ${bccrExchangeRate} CRC/USD`);
      } else {
        console.log('USD employees detected, fetching BCCR exchange rate...');
        const bccrResult = await fetchBCCRExchangeRate(periodEnd);
        if (bccrResult) {
          bccrExchangeRate = bccrResult.venta;
          console.log(`Using BCCR exchange rate: ${bccrExchangeRate} for date ${periodEnd}`);
        } else {
          console.error('Could not fetch BCCR rate for USD payroll processing');
          return new Response(
            JSON.stringify({
              error: "No se pudo obtener el tipo de cambio del BCCR para este periodo. Indique un tipo de cambio manual o reintente."
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }


    // ========================================
    // DEDUCTION CALCULATION FUNCTIONS
    // All read from company_parameters
    // ========================================
    
    // Calculate CCSS Obrero deduction based on sector
    const calculateCCSS = (salary: number): { amount: number; rate: number } => {
      if (params.is_education_sector) {
        // Education sector: specific rate (default 6.5%)
        const rate = params.ccss_obrero_education / 100;
        return { amount: salary * rate, rate };
      }
      // Standard: ccss_obrero_total YA INCLUYE Banco Popular obrero 1% (default 10.67%)
      const rate = params.ccss_obrero_total / 100;
      return { amount: salary * rate, rate };
    };

    // Calculate Magisterio deduction (ONLY for education sector)
    const calculateMagisterio = (salary: number): { amount: number; rate: number } => {
      if (params.is_education_sector && params.magisterio_rate > 0) {
        const rate = params.magisterio_rate / 100;
        return { amount: salary * rate, rate };
      }
      return { amount: 0, rate: 0 };
    };

    // Calculate Poliza de Vida (ONLY for education sector - fixed amount)
    const calculatePolizaVida = (): number => {
      if (params.is_education_sector && params.poliza_vida_fija > 0) {
        return params.poliza_vida_fija;
      }
      return 0;
    };

    // Calculate income tax using company parameters
    const calculateIncomeTax = (salary: number): number => {
      const b1 = params.renta_bracket_1_limit;
      const b2 = params.renta_bracket_2_limit;
      const b3 = params.renta_bracket_3_limit;
      const b4 = params.renta_bracket_4_limit;
      const r2 = params.renta_bracket_2_rate / 100;
      const r3 = params.renta_bracket_3_rate / 100;
      const r4 = params.renta_bracket_4_rate / 100;
      const r5 = params.renta_bracket_5_rate / 100;

      if (salary <= b1) return 0;
      if (salary <= b2) return (salary - b1) * r2;
      
      const tax1 = (b2 - b1) * r2;
      if (salary <= b3) return tax1 + (salary - b2) * r3;
      
      const tax2 = tax1 + (b3 - b2) * r3;
      if (salary <= b4) return tax2 + (salary - b3) * r4;
      
      const tax3 = tax2 + (b4 - b3) * r4;
      return tax3 + (salary - b4) * r5;
    };

    // Calculate employer contributions
    const calculateEmployerContributions = (salary: number): number => {
      const ccssPatronal = salary * (params.ccss_patronal_total / 100);
      const ina = salary * (params.ina_rate / 100);
      const imas = salary * (params.imas_rate / 100);
      const fodesaf = salary * (params.fodesaf_rate / 100);
      const bancoPopular = salary * (params.banco_popular_patronal / 100);
      const insRiesgos = salary * (params.ins_riesgos_trabajo / 100);
      return ccssPatronal + ina + imas + fodesaf + bancoPopular + insRiesgos;
    };

    // Calculate monthly aguinaldo accrual (1/12 of annual salary)
    const calculateAguinaldo = (salary: number) => salary / 12;

    // Calculate vacation days accrued
    const calculateVacationDays = (freq: string) => {
      if (freq === 'mensual') return 1.25;
      if (freq === 'quincenal') return 0.625;
      return 0.3125;
    };

    // Check if we should copy from a previous batch
    let previousLines: any[] = [];
    if (copyFromBatchId) {
      console.log('Copying from previous batch:', copyFromBatchId);
      const { data: prevLines, error: prevError } = await supabaseClient
        .from('payroll_lines')
        .select('*')
        .eq('batch_id', copyFromBatchId);

      if (prevError) {
        console.error("Error fetching previous lines:", prevError);
      } else {
        previousLines = prevLines || [];
        console.log('Found', previousLines.length, 'previous lines to copy');
      }
    }

    // Create map of previous line data by employee_id
    const previousLineMap: Record<string, any> = {};
    previousLines.forEach(line => {
      previousLineMap[line.employee_id] = line;
    });

    // Get time entries for this period
    const { data: timeEntries, error: timeError } = await supabaseClient
      .from('time_entries')
      .select('*')
      .eq('company_id', companyId)
      .gte('entry_date', periodStart)
      .lte('entry_date', periodEnd)
      .eq('approved', true);

    if (timeError) {
      console.error("Time entries error:", timeError);
    }

    // Group time entries by employee
    const timeByEmployee: Record<string, number> = {};
    if (timeEntries) {
      timeEntries.forEach(entry => {
        if (!timeByEmployee[entry.employee_id]) {
          timeByEmployee[entry.employee_id] = 0;
        }
        timeByEmployee[entry.employee_id] += Number(entry.hours);
      });
    }

    // Create payroll lines for each employee
    const payrollLines = employees.map(employee => {
      const prevLine = previousLineMap[employee.id];
      const baseSalaryOriginal = Number(employee.base_salary);
      const hourlyRate = Number(employee.hourly_rate || 0);
      const projectHours = timeByEmployee[employee.id] || 0;
      const projectHoursAmount = hourlyRate > 0 ? projectHours * hourlyRate : 0;
      
      // Copy adjustments from previous line if available
      const regularHours = prevLine?.regular_hours || 0;
      const overtimeHours = prevLine?.overtime_hours || 0;
      const additionalBonuses = prevLine?.additional_bonuses || 0;
      const absenceDays = 0;
      const vacationDaysTaken = 0;
      const sickLeaveDays = 0;
      
      // ========================================
      // CURRENCY CONVERSION FOR USD EMPLOYEES
      // ========================================
      const isUSD = employee.currency === 'USD';
      const employeeExchangeRate = isUSD && bccrExchangeRate ? bccrExchangeRate : 1.0;
      
      // Convert base salary to CRC for deduction calculations if employee is in USD
      // All Costa Rican deductions (CCSS, Renta, etc.) are calculated on CRC amounts
      const baseSalary = isUSD && bccrExchangeRate 
        ? baseSalaryOriginal * bccrExchangeRate 
        : baseSalaryOriginal;
      
      if (isUSD) {
        console.log(`Employee ${employee.employee_id}: USD ${baseSalaryOriginal} → CRC ${baseSalary} (rate: ${employeeExchangeRate})`);
      }
      
      // ========================================
      // GROSS SALARY CALCULATION (in CRC for deductions)
      // For biweekly: Calculate 50% of monthly salary
      // ========================================
      const monthlyGrossSalary = baseSalary + projectHoursAmount + additionalBonuses;
      const grossSalary = isBiweekly ? monthlyGrossSalary * 0.5 : monthlyGrossSalary;
      
      // ========================================
      // DEDUCTIONS CALCULATION (per company rules)
      // For biweekly: Apply 50% of each deduction (calculated on full monthly salary, then halved)
      // ========================================
      const ccssResult = calculateCCSS(monthlyGrossSalary);
      const magisterioResult = calculateMagisterio(monthlyGrossSalary);
      const polizaVida = calculatePolizaVida();
      const incomeTaxBruto = calculateIncomeTax(monthlyGrossSalary);
      // Crédito fiscal mensual (hijos + cónyuge). Reduce el ISR sin bajar de 0.
      const monthlyTaxCredit = Math.max(0, Number(employee.tax_credit_monthly || 0));
      const incomeTaxNetoMonthly = Math.max(0, incomeTaxBruto - monthlyTaxCredit);
      // 'incomeTax' (variable canónica) ahora es el ISR neto mensual (después del crédito)
      const incomeTax = incomeTaxNetoMonthly;
      
      // Get loan deduction from employee record (already monthly, apply half for biweekly)
      const monthlyLoanDeduction = Number(employee.loan_monthly_deduction || 0);
      const loanDeduction = monthlyLoanDeduction * deductionMultiplier;
      
      // Additional deductions (from previous line or manual)
      const monthlyAdditionalDeductions = prevLine?.additional_deductions || 0;
      const additionalDeductions = monthlyAdditionalDeductions * deductionMultiplier;
      
      // ========================================
      // BUILD STRUCTURED DEDUCTIONS DETAIL (REQUIRED)
      // This JSON is used for reports, PDFs, employee view, and auditing
      // For biweekly: Each amount is 50% of the monthly deduction
      // ========================================
      const deductionItems: DeductionItem[] = [];
      
      // Apply deduction multiplier (0.5 for biweekly, 1.0 for monthly)
      const ccssAmount = ccssResult.amount * deductionMultiplier;
      const magisterioAmount = magisterioResult.amount * deductionMultiplier;
      const polizaAmount = polizaVida * deductionMultiplier;
      const rentaBrutoAmount = incomeTaxBruto * deductionMultiplier;
      const taxCreditAmount = Math.min(monthlyTaxCredit, incomeTaxBruto) * deductionMultiplier;
      const rentaAmount = incomeTax * deductionMultiplier; // ISR neto
      
      // CCSS Obrero - Always present
      if (ccssAmount > 0) {
        deductionItems.push({
          code: 'CCSS_OBRERO',
          label: params.is_education_sector 
            ? `CCSS (Obrero) ${(ccssResult.rate * 100).toFixed(1)}%`
            : `CCSS (Obrero) ${(ccssResult.rate * 100).toFixed(2)}%`,
          type: 'percentage',
          rate: ccssResult.rate,
          amount: ccssAmount
        });
      }
      
      // Magisterio - Only for education sector
      if (magisterioAmount > 0) {
        deductionItems.push({
          code: 'MAGISTERIO',
          label: `Magisterio ${(magisterioResult.rate * 100).toFixed(1)}%`,
          type: 'percentage',
          rate: magisterioResult.rate,
          amount: magisterioAmount
        });
      }
      
      // Poliza de Vida - Only for education sector (fixed amount, halved for biweekly)
      if (polizaAmount > 0) {
        deductionItems.push({
          code: 'POLIZA_VIDA',
          label: 'Póliza de Vida Magisterio',
          type: 'fixed',
          amount: polizaAmount
        });
      }
      
      // Income Tax NETO (after tax credit, halved for biweekly)
      if (rentaAmount > 0) {
        deductionItems.push({
          code: 'RENTA',
          label: 'Impuesto sobre la Renta',
          type: 'calculated',
          amount: rentaAmount
        });
      }
      
      // Loans (already halved above)
      if (loanDeduction > 0) {
        deductionItems.push({
          code: 'PRESTAMOS',
          label: 'Préstamos',
          type: 'fixed',
          amount: loanDeduction
        });
      }
      
      // Additional deductions (lunches, others, etc.) - already halved
      if (additionalDeductions > 0) {
        deductionItems.push({
          code: 'OTROS',
          label: 'Otros Descuentos',
          type: 'fixed',
          amount: additionalDeductions
        });
      }
      
      // Total deductions (all amounts already adjusted for biweekly)
      const totalDeductions = ccssAmount + magisterioAmount + polizaAmount + rentaAmount + loanDeduction + additionalDeductions;
      
      // Build the deductions_detail JSON
      const deductionsDetail: any = {
        items: deductionItems,
        total_deductions: totalDeductions,
        payroll_type: payrollType,
        is_biweekly: isBiweekly,
        deduction_multiplier: deductionMultiplier,
        // ISR transparency
        isr_bruto: rentaBrutoAmount,
        isr_credito: taxCreditAmount,
        isr_neto: rentaAmount,
        tax_credit_monthly: monthlyTaxCredit,
        // Estandariza nombres usados por el frontend
        ccss_obrero: ccssAmount,
        ccss_rate: ccssResult.rate * 100,
        magisterio: magisterioAmount,
        poliza_vida: polizaAmount,
        loan_deduction: loanDeduction,
        base_imponible_crc: monthlyGrossSalary,
      };

      
      // ========================================
      // NET PAY = GROSS - ALL DEDUCTIONS
      // ========================================
      const netPay = grossSalary - totalDeductions;
      
      // ========================================
      // TOTAL TO PAY (for future use with independent payments)
      // Currently equals net_pay, can be extended for lunch, etc.
      // ========================================
      const totalToPay = netPay;
      
      // Employer contributions
      const employerContrib = calculateEmployerContributions(grossSalary);
      
      const aguinaldoAccrued = calculateAguinaldo(baseSalary);
      const vacationDays = calculateVacationDays(frequency);

      // Build notes with summary
      const deductionSummary = deductionItems.map(d => `${d.code}: ₡${d.amount.toFixed(0)}`).join(' | ');

      return {
        batch_id: batch.id,
        company_id: companyId,
        employee_id: employee.id,
        line_id: `LINE-${employee.employee_id}-${batchId}`,
        // gross_salary se almacena en la MONEDA ORIGINAL del empleado.
        // El resto del sistema multiplica gross_salary * exchange_rate_to_base
        // para obtener colones, por lo que guardar el valor ya convertido
        // causaba doble conversión. El valor en CRC queda en deductions_detail.base_imponible_crc.
        gross_salary: employeeExchangeRate > 0 ? grossSalary / employeeExchangeRate : grossSalary,
        overtime: 0,
        project_hours_amount: projectHoursAmount,
        deductions: totalDeductions,
        deductions_detail: deductionsDetail,
        net_pay: netPay,
        total_to_pay: totalToPay,
        employer_contrib: employerContrib,
        aguinaldo_accrued: aguinaldoAccrued,
        vacation_accrued_days: vacationDays,
        currency: employee.currency,
        exchange_rate_to_base: employeeExchangeRate,
        notes: deductionSummary || null,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        absence_days: absenceDays,
        vacation_days_taken: vacationDaysTaken,
        sick_leave_days: sickLeaveDays,
        additional_bonuses: additionalBonuses,
        additional_deductions: additionalDeductions + loanDeduction,
        manual_adjustments: {
          ...(prevLine?.manual_adjustments || {}),
          magisterio: magisterioResult.amount,
          poliza_vida: polizaVida,
          ccss: ccssResult.amount,
          income_tax: incomeTax,
          loan_deduction: loanDeduction,
          original_currency: employee.currency,
          original_salary: baseSalaryOriginal,
          exchange_rate_applied: employeeExchangeRate
        }
      };
    });

    const { data: lines, error: linesError } = await supabaseClient
      .from('payroll_lines')
      .insert(payrollLines)
      .select();

    if (linesError) {
      console.error("Lines creation error:", linesError);
      return new Response(
        JSON.stringify({ error: "Error al crear líneas de planilla" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created ${lines?.length} payroll lines with structured deductions`);

    // Update batch status to 'calculado'
    const { error: updateError } = await supabaseClient
      .from('payroll_batches')
      .update({ status: 'calculado' })
      .eq('id', batch.id);

    if (updateError) {
      console.error("Batch update error:", updateError);
    }

    // Calculate totals for response
    const totals = {
      totalGross: lines?.reduce((sum, line) => sum + Number(line.gross_salary), 0) || 0,
      totalDeductions: lines?.reduce((sum, line) => sum + Number(line.deductions), 0) || 0,
      totalNet: lines?.reduce((sum, line) => sum + Number(line.net_pay), 0) || 0,
      totalEmployerContrib: lines?.reduce((sum, line) => sum + Number(line.employer_contrib), 0) || 0,
    };

    return new Response(
      JSON.stringify({
        success: true,
        batch: batch,
        linesCreated: lines?.length || 0,
        isEducationSector: params.is_education_sector,
        isrValidationWarnings: isrValidationWarnings.length > 0 ? isrValidationWarnings : undefined,
        isrBracketsUsed: {
          bracket_1: params.renta_bracket_1_limit,
          bracket_2: params.renta_bracket_2_limit,
          bracket_3: params.renta_bracket_3_limit,
          bracket_4: params.renta_bracket_4_limit,
        },
        ...totals
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in process-payroll function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
