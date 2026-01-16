// Updated: Support for education sector (Magisterio + Poliza de Vida)
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

    // Get company parameters (for education sector settings)
    const { data: companyParams, error: paramsError } = await supabaseClient
      .from('company_parameters')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (paramsError) {
      console.warn("Company parameters not found, using defaults:", paramsError);
    }

    const params: CompanyParameters = {
      is_education_sector: companyParams?.is_education_sector || false,
      magisterio_rate: companyParams?.magisterio_rate || 0,
      poliza_vida_fija: companyParams?.poliza_vida_fija || 0,
      ccss_obrero_education: companyParams?.ccss_obrero_education || 6.70,
      ccss_obrero_total: companyParams?.ccss_obrero_total || 10.83,
      renta_bracket_1_limit: companyParams?.renta_bracket_1_limit || 918000,
      renta_bracket_1_rate: companyParams?.renta_bracket_1_rate || 0,
      renta_bracket_2_limit: companyParams?.renta_bracket_2_limit || 1347000,
      renta_bracket_2_rate: companyParams?.renta_bracket_2_rate || 10,
      renta_bracket_3_limit: companyParams?.renta_bracket_3_limit || 2364000,
      renta_bracket_3_rate: companyParams?.renta_bracket_3_rate || 15,
      renta_bracket_4_limit: companyParams?.renta_bracket_4_limit || 4727000,
      renta_bracket_4_rate: companyParams?.renta_bracket_4_rate || 20,
      renta_bracket_5_rate: companyParams?.renta_bracket_5_rate || 25,
    };

    console.log("Company parameters:", { 
      isEducation: params.is_education_sector, 
      magisterio: params.magisterio_rate,
      poliza: params.poliza_vida_fija 
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

    // Calculate CCSS deduction based on sector
    const calculateCCSS = (salary: number) => {
      if (params.is_education_sector) {
        // Sector educación: 6.70% (Retención C.C.S.S)
        return salary * (params.ccss_obrero_education / 100);
      }
      // Standard: 10.83% (SEM 5.50% + IVM 4.33% + BP 1.00%)
      return salary * (params.ccss_obrero_total / 100);
    };

    // Calculate Magisterio deduction (only for education sector)
    const calculateMagisterio = (salary: number) => {
      if (params.is_education_sector && params.magisterio_rate > 0) {
        return salary * (params.magisterio_rate / 100);
      }
      return 0;
    };

    // Calculate Poliza de Vida (fixed amount for education sector)
    const calculatePolizaVida = () => {
      if (params.is_education_sector && params.poliza_vida_fija > 0) {
        return params.poliza_vida_fija;
      }
      return 0;
    };

    // Calculate income tax using company parameters
    const calculateIncomeTax = (salary: number) => {
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
      const baseSalary = Number(employee.base_salary);
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
      
      const grossSalary = baseSalary + projectHoursAmount + additionalBonuses;
      
      // Calculate all deductions
      const ccss = calculateCCSS(grossSalary);
      const magisterio = calculateMagisterio(grossSalary);
      const polizaVida = calculatePolizaVida();
      const incomeTax = calculateIncomeTax(grossSalary);
      
      // Get loan deduction from employee record
      const loanDeduction = Number(employee.loan_monthly_deduction || 0);
      
      // Additional deductions (from previous line or manual)
      const additionalDeductions = prevLine?.additional_deductions || 0;
      
      // Total deductions include all components
      const totalDeductions = ccss + magisterio + polizaVida + incomeTax + loanDeduction + additionalDeductions;
      const netPay = grossSalary - totalDeductions;
      
      // Employer contributions (26.17% for standard, may vary for education)
      const employerContrib = grossSalary * 0.2617;
      
      const aguinaldoAccrued = calculateAguinaldo(baseSalary);
      const vacationDays = calculateVacationDays(frequency);

      // Build notes with breakdown for education sector
      let notes = '';
      if (params.is_education_sector) {
        const deductionDetails = [];
        if (ccss > 0) deductionDetails.push(`CCSS: ₡${ccss.toFixed(0)}`);
        if (magisterio > 0) deductionDetails.push(`Magisterio: ₡${magisterio.toFixed(0)}`);
        if (polizaVida > 0) deductionDetails.push(`Póliza: ₡${polizaVida.toFixed(0)}`);
        if (incomeTax > 0) deductionDetails.push(`ISR: ₡${incomeTax.toFixed(0)}`);
        if (loanDeduction > 0) deductionDetails.push(`Préstamo: ₡${loanDeduction.toFixed(0)}`);
        notes = deductionDetails.join(' | ');
      } else if (projectHours > 0) {
        notes = `${projectHours} horas de proyecto`;
      }

      return {
        batch_id: batch.id,
        company_id: companyId,
        employee_id: employee.id,
        line_id: `LINE-${employee.employee_id}-${batchId}`,
        gross_salary: grossSalary,
        overtime: 0,
        project_hours_amount: projectHoursAmount,
        deductions: totalDeductions,
        net_pay: netPay,
        employer_contrib: employerContrib,
        aguinaldo_accrued: aguinaldoAccrued,
        vacation_accrued_days: vacationDays,
        currency: employee.currency,
        exchange_rate_to_base: employee.currency === company.base_currency ? 1.0 : exchangeRate,
        notes: notes || null,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        absence_days: absenceDays,
        vacation_days_taken: vacationDaysTaken,
        sick_leave_days: sickLeaveDays,
        additional_bonuses: additionalBonuses,
        additional_deductions: additionalDeductions + loanDeduction,
        manual_adjustments: {
          ...(prevLine?.manual_adjustments || {}),
          magisterio: magisterio,
          poliza_vida: polizaVida,
          ccss: ccss,
          income_tax: incomeTax,
          loan_deduction: loanDeduction
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

    console.log(`Created ${lines?.length} payroll lines`);

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
