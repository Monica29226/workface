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

    const { companyId, periodStart, periodEnd, frequency, exchangeRate = 1.0 }: ProcessPayrollRequest = await req.json();

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

    // Calculate CCSS deduction (10.5% for employee)
    const calculateCCSS = (salary: number) => salary * 0.105;

    // Calculate income tax (simplified - Costa Rica progressive rates)
    const calculateIncomeTax = (salary: number) => {
      if (salary <= 941000) return 0;
      if (salary <= 1381000) return (salary - 941000) * 0.10;
      if (salary <= 2423000) return 44000 + (salary - 1381000) * 0.15;
      if (salary <= 4845000) return 200300 + (salary - 2423000) * 0.20;
      return 684700 + (salary - 4845000) * 0.25;
    };

    // Calculate monthly aguinaldo accrual (1/12 of annual salary)
    const calculateAguinaldo = (salary: number) => salary / 12;

    // Calculate vacation days accrued (1.25 days per month for mensual)
    const calculateVacationDays = (frequency: string) => {
      if (frequency === 'mensual') return 1.25;
      if (frequency === 'quincenal') return 0.625;
      return 0.3125; // semanal
    };

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
      const baseSalary = Number(employee.base_salary);
      const hourlyRate = Number(employee.hourly_rate || 0);
      const projectHours = timeByEmployee[employee.id] || 0;
      const projectHoursAmount = hourlyRate > 0 ? projectHours * hourlyRate : 0;
      
      const grossSalary = baseSalary + projectHoursAmount;
      const ccss = calculateCCSS(grossSalary);
      const incomeTax = calculateIncomeTax(grossSalary);
      const totalDeductions = ccss + incomeTax;
      const netPay = grossSalary - totalDeductions;
      
      // Employer contributions (26% approx: CCSS 26.17%)
      const employerContrib = grossSalary * 0.2617;
      
      const aguinaldoAccrued = calculateAguinaldo(baseSalary);
      const vacationDays = calculateVacationDays(frequency);

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
        notes: projectHours > 0 ? `${projectHours} horas de proyecto` : null
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

    return new Response(
      JSON.stringify({
        success: true,
        batch: batch,
        linesCreated: lines?.length || 0,
        totalGross: lines?.reduce((sum, line) => sum + Number(line.gross_salary), 0) || 0,
        totalNet: lines?.reduce((sum, line) => sum + Number(line.net_pay), 0) || 0,
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
