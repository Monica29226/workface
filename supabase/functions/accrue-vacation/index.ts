import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccrueVacationRequest {
  batchId: string;
  companyId: string;
}

/**
 * Función para acumular vacaciones automáticamente según Código de Trabajo de Costa Rica
 * - 1 día por mes laborado (trabajadores regulares)
 * - 1.25 días por mes (servicio doméstico según vacation_domestic_monthly_accrual)
 * - Por cada 50 semanas continuas = 2 semanas de vacaciones mínimo
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { batchId, companyId }: AccrueVacationRequest = await req.json();

    console.log("Processing vacation accrual for batch:", batchId);

    // Get company parameters
    const { data: params, error: paramsError } = await supabase
      .from('company_parameters')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (paramsError) {
      console.error("Parameters error:", paramsError);
      return new Response(
        JSON.stringify({ error: "Parámetros de empresa no encontrados" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get payroll lines with employee info
    const { data: lines, error: linesError } = await supabase
      .from('payroll_lines')
      .select(`
        *,
        employee:employees!inner(
          id,
          employee_id,
          full_name,
          hire_date,
          contract_type,
          base_salary,
          vac_balance_days
        )
      `)
      .eq('batch_id', batchId);

    if (linesError || !lines || lines.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se encontraron líneas de planilla" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const periodYear = new Date(batch.period_start).getFullYear();
    const periodMonth = new Date(batch.period_start).getMonth() + 1;
    const now = new Date();
    const accrualResults: any[] = [];

    // Process vacation accrual for each employee
    for (const line of lines) {
      const employee = line.employee;
      
      // Calculate vacation days to accrue based on contract type
      // Servicio doméstico gets 1.25 days/month, others get 1 day/month
      const monthlyAccrual = params.vacation_monthly_accrual || 1.0;
      const vacationDaysToAccrue = Number(line.vacation_accrued_days || monthlyAccrual);
      
      // Calculate daily rate for monetary value
      const baseSalary = Number(employee.base_salary || 0);
      const dailyRate = baseSalary / 30;

      // Check if vacation record exists for this year
      const { data: existingVacation, error: vacError } = await supabase
        .from('employee_vacations')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('year', periodYear)
        .maybeSingle();

      if (vacError) {
        console.error("Error fetching vacation record:", vacError);
        continue;
      }

      // Calculate expiry date (12 months from accrual start per Código de Trabajo)
      const expiryMonths = Number(params.vacation_expiry_months || 12);
      const accrualStartDate = employee.hire_date || batch.period_start;
      const expiryDate = new Date(accrualStartDate);
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      if (existingVacation) {
        // Update existing record - increment days_accrued
        const newDaysAccrued = Number(existingVacation.days_accrued) + vacationDaysToAccrue;
        const daysPending = newDaysAccrued - Number(existingVacation.days_taken);
        const pendingAmount = daysPending * dailyRate;

        const { error: updateError } = await supabase
          .from('employee_vacations')
          .update({
            days_accrued: newDaysAccrued,
            days_pending: daysPending,
            daily_rate: dailyRate,
            pending_amount: pendingAmount,
            expiry_date: expiryDate.toISOString().split('T')[0],
            updated_at: now.toISOString(),
            notes: `Acumulado ${vacationDaysToAccrue} días en ${batch.batch_id}`
          })
          .eq('id', existingVacation.id);

        if (updateError) {
          console.error("Error updating vacation record:", updateError);
          continue;
        }

        accrualResults.push({
          employee_id: employee.employee_id,
          employee_name: employee.full_name,
          days_accrued: vacationDaysToAccrue,
          total_accrued: newDaysAccrued,
          days_pending: daysPending,
          action: 'updated'
        });
      } else {
        // Create new vacation record for this year
        const { error: insertError } = await supabase
          .from('employee_vacations')
          .insert({
            employee_id: employee.id,
            company_id: companyId,
            year: periodYear,
            days_accrued: vacationDaysToAccrue,
            days_taken: 0,
            days_pending: vacationDaysToAccrue,
            daily_rate: dailyRate,
            pending_amount: vacationDaysToAccrue * dailyRate,
            accrual_start_date: accrualStartDate,
            expiry_date: expiryDate.toISOString().split('T')[0],
            notes: `Inicio de acumulación ${periodYear} - ${batch.batch_id}`
          });

        if (insertError) {
          console.error("Error creating vacation record:", insertError);
          continue;
        }

        accrualResults.push({
          employee_id: employee.employee_id,
          employee_name: employee.full_name,
          days_accrued: vacationDaysToAccrue,
          total_accrued: vacationDaysToAccrue,
          days_pending: vacationDaysToAccrue,
          action: 'created'
        });
      }

      // Also update the employee's vac_balance_days for quick reference
      const currentBalance = Number(employee.vac_balance_days || 0);
      await supabase
        .from('employees')
        .update({ vac_balance_days: currentBalance + vacationDaysToAccrue })
        .eq('id', employee.id);
    }

    console.log(`Processed vacation accrual for ${accrualResults.length} employees`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Vacaciones acumuladas para ${accrualResults.length} empleados`,
        results: accrualResults,
        totalDaysAccrued: accrualResults.reduce((sum, r) => sum + r.days_accrued, 0)
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in accrue-vacation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
