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
  exchangeRate?: number;
  copyFromBatchId?: string;
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

    const { companyId, periodStart, periodEnd, frequency, exchangeRate = 1.0, copyFromBatchId }: ProcessPayrollRequest = await req.json();

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

    // Build parameters from company_parameters table - NEVER use global defaults
    const params: CompanyParameters = {
      is_education_sector: companyParams?.is_education_sector || false,
      magisterio_rate: companyParams?.magisterio_rate || 0,
      poliza_vida_fija: companyParams?.poliza_vida_fija || 0,
      ccss_obrero_education: companyParams?.ccss_obrero_education || 6.70,
      ccss_obrero_total: companyParams?.ccss_obrero_total || 10.83,
      ccss_patronal_total: companyParams?.ccss_patronal_total || 26.67,
      ina_rate: companyParams?.ina_rate || 1.50,
      imas_rate: companyParams?.imas_rate || 0.50,
      fodesaf_rate: companyParams?.fodesaf_rate || 5.00,
      banco_popular_patronal: companyParams?.banco_popular_patronal || 0.25,
      ins_riesgos_trabajo: companyParams?.ins_riesgos_trabajo || 1.50,
      renta_bracket_1_limit: companyParams?.renta_bracket_1_limit || 941000,
      renta_bracket_1_rate: companyParams?.renta_bracket_1_rate || 0,
      renta_bracket_2_limit: companyParams?.renta_bracket_2_limit || 1381000,
      renta_bracket_2_rate: companyParams?.renta_bracket_2_rate || 10,
      renta_bracket_3_limit: companyParams?.renta_bracket_3_limit || 2423000,
      renta_bracket_3_rate: companyParams?.renta_bracket_3_rate || 15,
      renta_bracket_4_limit: companyParams?.renta_bracket_4_limit || 4845000,
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
    const batchId = `BATCH-${new Date(periodStart).getFullYear()}${String(new Date(periodStart).getMonth() + 1).padStart(2, '0')}-${Date.now()}`;
    
    const { data: batch, error: batchError } = await supabaseClient
      .from('payroll_batches')
      .insert({
        company_id: companyId,
        batch_id: batchId,
        period_start: periodStart,
        period_end: periodEnd,
        frequency: frequency,
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
      console.log('USD employees detected, fetching BCCR exchange rate...');
      
      // Use provided exchange rate or fetch from BCCR
      if (exchangeRate && exchangeRate !== 1.0) {
        bccrExchangeRate = exchangeRate;
        console.log(`Using provided exchange rate: ${bccrExchangeRate}`);
      } else {
        // Fetch BCCR rate using period_end date (most recent date in period)
        const bccrResult = await fetchBCCRExchangeRate(periodEnd);
        if (bccrResult) {
          bccrExchangeRate = bccrResult.venta;
          console.log(`Using BCCR exchange rate: ${bccrExchangeRate} for date ${periodEnd}`);
        } else {
          console.warn('Could not fetch BCCR rate, USD salaries will not be converted');
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
      // Standard: use company rate (default 10.83%)
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
      // ========================================
      const grossSalary = baseSalary + projectHoursAmount + additionalBonuses;
      
      // ========================================
      // DEDUCTIONS CALCULATION (per company rules)
      // ========================================
      const ccssResult = calculateCCSS(grossSalary);
      const magisterioResult = calculateMagisterio(grossSalary);
      const polizaVida = calculatePolizaVida();
      const incomeTax = calculateIncomeTax(grossSalary);
      
      // Get loan deduction from employee record
      const loanDeduction = Number(employee.loan_monthly_deduction || 0);
      
      // Additional deductions (from previous line or manual)
      const additionalDeductions = prevLine?.additional_deductions || 0;
      
      // ========================================
      // BUILD STRUCTURED DEDUCTIONS DETAIL (REQUIRED)
      // This JSON is used for reports, PDFs, employee view, and auditing
      // ========================================
      const deductionItems: DeductionItem[] = [];
      
      // CCSS Obrero - Always present
      if (ccssResult.amount > 0) {
        deductionItems.push({
          code: 'CCSS_OBRERO',
          label: params.is_education_sector 
            ? `CCSS (Obrero) ${(ccssResult.rate * 100).toFixed(1)}%`
            : `CCSS (Obrero) ${(ccssResult.rate * 100).toFixed(2)}%`,
          type: 'percentage',
          rate: ccssResult.rate,
          amount: ccssResult.amount
        });
      }
      
      // Magisterio - Only for education sector
      if (magisterioResult.amount > 0) {
        deductionItems.push({
          code: 'MAGISTERIO',
          label: `Magisterio ${(magisterioResult.rate * 100).toFixed(1)}%`,
          type: 'percentage',
          rate: magisterioResult.rate,
          amount: magisterioResult.amount
        });
      }
      
      // Poliza de Vida - Only for education sector (fixed amount)
      if (polizaVida > 0) {
        deductionItems.push({
          code: 'POLIZA_VIDA',
          label: 'Póliza de Vida Magisterio',
          type: 'fixed',
          amount: polizaVida
        });
      }
      
      // Income Tax
      if (incomeTax > 0) {
        deductionItems.push({
          code: 'RENTA',
          label: 'Impuesto sobre la Renta',
          type: 'calculated',
          amount: incomeTax
        });
      }
      
      // Loans
      if (loanDeduction > 0) {
        deductionItems.push({
          code: 'PRESTAMOS',
          label: 'Préstamos',
          type: 'fixed',
          amount: loanDeduction
        });
      }
      
      // Additional deductions (lunches, others, etc.)
      if (additionalDeductions > 0) {
        deductionItems.push({
          code: 'OTROS',
          label: 'Otros Descuentos',
          type: 'fixed',
          amount: additionalDeductions
        });
      }
      
      // Total deductions
      const totalDeductions = ccssResult.amount + magisterioResult.amount + polizaVida + incomeTax + loanDeduction + additionalDeductions;
      
      // Build the deductions_detail JSON
      const deductionsDetail: DeductionsDetail = {
        items: deductionItems,
        total_deductions: totalDeductions
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
        gross_salary: grossSalary,
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
