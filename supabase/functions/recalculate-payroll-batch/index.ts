// AUREON Payroll Recalculation - Multi-company with per-company deduction rules
// IMPORTANT: All deductions are calculated from company_parameters using company_id
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecalculateRequest {
  batchId: string;
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader || '' },
      },
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { batchId }: RecalculateRequest = await req.json();

    console.log('Recalculating payroll batch:', batchId);

    // Get batch info
    const { data: batch, error: batchError } = await supabase
      .from('payroll_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ error: "Lote de planilla no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow recalculation if batch is in 'calculado' or 'borrador' status
    if (batch.status !== 'calculado' && batch.status !== 'borrador') {
      return new Response(
        JSON.stringify({ error: `No se puede recalcular una planilla en estado: ${batch.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Get company parameters - ALL deductions are company-specific
    const { data: companyParams, error: paramsError } = await supabase
      .from('company_parameters')
      .select('*')
      .eq('company_id', batch.company_id)
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

    // Build parameters - ALWAYS use 2026 official ISR brackets as defaults
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

    console.log('Company parameters loaded:', { 
      companyId: batch.company_id,
      isEducation: params.is_education_sector, 
      magisterio: params.magisterio_rate,
      poliza: params.poliza_vida_fija,
      ccssObrero: params.is_education_sector ? params.ccss_obrero_education : params.ccss_obrero_total
    });

    // Get all payroll lines with employee data
    const { data: lines, error: linesError } = await supabase
      .from('payroll_lines')
      .select('*, employees!inner(*)')
      .eq('batch_id', batchId);

    if (linesError) {
      console.error('Error fetching payroll lines:', linesError);
      return new Response(
        JSON.stringify({ error: "Error al obtener líneas de planilla" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // DEDUCTION CALCULATION FUNCTIONS
    // All read from company_parameters
    // ========================================
    
    const calculateCCSS = (salary: number): { amount: number; rate: number } => {
      if (params.is_education_sector) {
        const rate = params.ccss_obrero_education / 100;
        return { amount: salary * rate, rate };
      }
      const rate = params.ccss_obrero_total / 100;
      return { amount: salary * rate, rate };
    };

    const calculateMagisterio = (salary: number): { amount: number; rate: number } => {
      if (params.is_education_sector && params.magisterio_rate > 0) {
        const rate = params.magisterio_rate / 100;
        return { amount: salary * rate, rate };
      }
      return { amount: 0, rate: 0 };
    };

    const calculatePolizaVida = (): number => {
      if (params.is_education_sector && params.poliza_vida_fija > 0) {
        return params.poliza_vida_fija;
      }
      return 0;
    };

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

    const calculateEmployerContributions = (salary: number): number => {
      const ccssPatronal = salary * (params.ccss_patronal_total / 100);
      const ina = salary * (params.ina_rate / 100);
      const imas = salary * (params.imas_rate / 100);
      const fodesaf = salary * (params.fodesaf_rate / 100);
      const bancoPopular = salary * (params.banco_popular_patronal / 100);
      const insRiesgos = salary * (params.ins_riesgos_trabajo / 100);
      return ccssPatronal + ina + imas + fodesaf + bancoPopular + insRiesgos;
    };

    // Recalculate each line
    const updatedLines = [];
    for (const line of lines) {
      const employee = (line as any).employees;

      const isUSD = (line.currency === 'USD') || (employee.currency === 'USD');
      const exchangeRate = isUSD ? (Number(line.exchange_rate_to_base) || 1) : 1;

      
      // Calculate gross salary based on contract type and manual adjustments
      let grossSalary = 0;
      
      // Get hours data from payroll line
      const regularHours = Number(line.regular_hours || 0);
      const overtimeHours = Number(line.overtime_hours || 0);  // 1.5x rate
      const mixedOvertimeHours = Number(line.mixed_overtime_hours || 0);  // 2x rate
      
      // Calculate hourly rate from employee data
      const hourlyRate = employee.hourly_rate || (employee.base_salary / 240); // 240 = 30 days * 8 hours
      
      if (employee.contract_type === 'mensual') {
        // Start with base monthly salary
        grossSalary = employee.base_salary;
        
        // Add overtime pay for monthly employees (extra hours on top of base)
        // Horas Extra (1.5x) - tiempo y medio
        const overtimePay = overtimeHours * hourlyRate * 1.5;
        // Horas Dobles (2x) - tiempo doble
        const doubleTimePay = mixedOvertimeHours * hourlyRate * 2.0;
        
        grossSalary += overtimePay + doubleTimePay;
        
        console.log(`Monthly employee ${employee.full_name}: Base=${employee.base_salary}, OT Hours=${overtimeHours}, OT Pay=${overtimePay}, DT Hours=${mixedOvertimeHours}, DT Pay=${doubleTimePay}`);
        
      } else if (employee.contract_type === 'por_horas') {
        // Hourly workers: regular + overtime + double time
        const regularPay = regularHours * hourlyRate;
        const overtimePay = overtimeHours * hourlyRate * 1.5;
        const doubleTimePay = mixedOvertimeHours * hourlyRate * 2.0;
        
        grossSalary = regularPay + overtimePay + doubleTimePay;
        
        console.log(`Hourly employee ${employee.full_name}: Regular=${regularPay}, OT=${overtimePay}, DT=${doubleTimePay}`);
      }

      // Add bonuses and project hours
      grossSalary += (line.additional_bonuses || 0);
      grossSalary += (line.project_hours_amount || 0);

      // Subtract absences (unpaid days)
      const absenceDays = line.absence_days || 0;
      const dailyRate = employee.base_salary / 30;
      grossSalary -= (absenceDays * dailyRate);
      
      // Store overtime amounts for reference
      const overtimeAmount = overtimeHours * hourlyRate * 1.5;
      const mixedOvertimeAmount = mixedOvertimeHours * hourlyRate * 2.0;

      // ========================================
      // DEDUCTIONS CALCULATION (per company rules)
      // ========================================
      const ccssResult = calculateCCSS(grossSalary);
      const magisterioResult = calculateMagisterio(grossSalary);
      const polizaVida = calculatePolizaVida();
      const incomeTax = calculateIncomeTax(grossSalary);
      
      // Get loan deduction from employee record
      const loanDeduction = Number(employee.loan_monthly_deduction || 0);
      
      // Other additional deductions
      const additionalDeductions = line.additional_deductions || 0;
      
      // ========================================
      // BUILD STRUCTURED DEDUCTIONS DETAIL (REQUIRED)
      // ========================================
      const deductionItems: DeductionItem[] = [];
      
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
      
      if (magisterioResult.amount > 0) {
        deductionItems.push({
          code: 'MAGISTERIO',
          label: `Magisterio ${(magisterioResult.rate * 100).toFixed(1)}%`,
          type: 'percentage',
          rate: magisterioResult.rate,
          amount: magisterioResult.amount
        });
      }
      
      if (polizaVida > 0) {
        deductionItems.push({
          code: 'POLIZA_VIDA',
          label: 'Póliza de Vida Magisterio',
          type: 'fixed',
          amount: polizaVida
        });
      }
      
      if (incomeTax > 0) {
        deductionItems.push({
          code: 'RENTA',
          label: 'Impuesto sobre la Renta',
          type: 'calculated',
          amount: incomeTax
        });
      }
      
      if (loanDeduction > 0) {
        deductionItems.push({
          code: 'PRESTAMOS',
          label: 'Préstamos',
          type: 'fixed',
          amount: loanDeduction
        });
      }
      
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

      const deductionsDetail: DeductionsDetail = {
        items: deductionItems,
        total_deductions: totalDeductions
      };

      // Calculate net pay
      const netPay = grossSalary - totalDeductions;
      
      // Total to pay
      const totalToPay = netPay;

      // Calculate employer contributions
      const employerContrib = calculateEmployerContributions(grossSalary);

      // Calculate accruals
      const aguinaldoAccrued = grossSalary / 12;
      const vacationAccruedDays = (line.vacation_days_taken || 0) > 0 ? 0 : 1.25;

      // Build notes with summary
      const deductionSummary = deductionItems.map(d => `${d.code}: ₡${d.amount.toFixed(0)}`).join(' | ');

      updatedLines.push({
        id: line.id,
        gross_salary: grossSalary,
        overtime: overtimeAmount,
        mixed_overtime_amount: mixedOvertimeAmount,
        deductions: totalDeductions,
        deductions_detail: deductionsDetail,
        net_pay: netPay,
        total_to_pay: totalToPay,
        employer_contrib: employerContrib,
        aguinaldo_accrued: aguinaldoAccrued,
        vacation_accrued_days: vacationAccruedDays,
        notes: deductionSummary || line.notes,
        manual_adjustments: {
          ...(line.manual_adjustments || {}),
          magisterio: magisterioResult.amount,
          poliza_vida: polizaVida,
          ccss: ccssResult.amount,
          income_tax: incomeTax,
          loan_deduction: loanDeduction,
          overtime_hours: overtimeHours,
          overtime_amount: overtimeAmount,
          mixed_overtime_hours: mixedOvertimeHours,
          mixed_overtime_amount: mixedOvertimeAmount,
          hourly_rate_used: hourlyRate
        }
      });
    }

    // Update all lines
    for (const update of updatedLines) {
      const { error: updateError } = await supabase
        .from('payroll_lines')
        .update(update)
        .eq('id', update.id);

      if (updateError) {
        console.error('Error updating line:', update.id, updateError);
      }
    }

    console.log('Batch recalculated successfully, updated', updatedLines.length, 'lines with structured deductions');

    return new Response(
      JSON.stringify({ 
        success: true, 
        lines_updated: updatedLines.length,
        is_education_sector: params.is_education_sector,
        isrValidationWarnings: isrValidationWarnings.length > 0 ? isrValidationWarnings : undefined,
        isrBracketsUsed: {
          bracket_1: params.renta_bracket_1_limit,
          bracket_2: params.renta_bracket_2_limit,
          bracket_3: params.renta_bracket_3_limit,
          bracket_4: params.renta_bracket_4_limit,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('Error in recalculate-payroll-batch function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
