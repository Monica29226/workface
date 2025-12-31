import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratePayslipsRequest {
  batchId: string;
  accrueVacations?: boolean;  // Flag to trigger vacation accrual
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { batchId, accrueVacations = true }: GeneratePayslipsRequest = await req.json();

    console.log("Generating payslips for batch:", batchId, "with vacation accrual:", accrueVacations);

    // Get batch info
    const { data: batch, error: batchError } = await supabaseClient
      .from('payroll_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      console.error("Batch error:", batchError);
      return new Response(
        JSON.stringify({ error: "Lote de planilla no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if batch is approved or already sent (allow regeneration)
    if (batch.status !== 'aprobado' && batch.status !== 'enviado') {
      return new Response(
        JSON.stringify({ error: "El lote debe estar aprobado para generar colillas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payroll lines with employee info
    const { data: lines, error: linesError } = await supabaseClient
      .from('payroll_lines')
      .select(`
        *,
        employee:employees!inner(
          id,
          employee_id,
          full_name,
          work_email,
          hire_date,
          base_salary,
          vac_balance_days
        )
      `)
      .eq('batch_id', batchId);

    if (linesError || !lines || lines.length === 0) {
      console.error("Lines error:", linesError);
      return new Response(
        JSON.stringify({ error: "No se encontraron líneas de planilla" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const periodStart = new Date(batch.period_start);
    const periodYear = periodStart.getFullYear();
    const periodLabel = `${periodStart.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}`;

    // Check for existing payslips (idempotent)
    const { data: existingPayslips } = await supabaseClient
      .from('payslips')
      .select('employee_id')
      .eq('batch_id', batchId);

    const existingEmployeeIds = new Set(existingPayslips?.map(p => p.employee_id) || []);

    // Create payslip records for employees that don't have one yet
    const newPayslips = lines
      .filter(line => !existingEmployeeIds.has(line.employee_id))
      .map(line => ({
        batch_id: batchId,
        company_id: batch.company_id,
        employee_id: line.employee_id,
        employee_email: line.employee.work_email,
        payslip_id: `PAY-${line.line_id}`,
        period_label: periodLabel,
        pdf_file_path: null,
      }));

    if (newPayslips.length > 0) {
      const { data: createdPayslips, error: payslipsError } = await supabaseClient
        .from('payslips')
        .insert(newPayslips)
        .select();

      if (payslipsError) {
        console.error("Payslips creation error:", payslipsError);
        return new Response(
          JSON.stringify({ error: "Error al crear colillas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Created ${createdPayslips?.length} new payslips`);
    } else {
      console.log("All payslips already exist for this batch");
    }

    // Accrue vacations if flag is set and this is first time generating payslips
    let vacationAccrualResults: any[] = [];
    if (accrueVacations && newPayslips.length > 0) {
      console.log("Processing vacation accrual for", lines.length, "employees");
      
      // Get company parameters
      const { data: params } = await supabaseAdmin
        .from('company_parameters')
        .select('vacation_monthly_accrual, vacation_expiry_months')
        .eq('company_id', batch.company_id)
        .single();

      const monthlyAccrual = Number(params?.vacation_monthly_accrual || 1);
      const expiryMonths = Number(params?.vacation_expiry_months || 12);
      const now = new Date();

      for (const line of lines) {
        const employee = line.employee;
        const vacationDaysToAccrue = Number(line.vacation_accrued_days || monthlyAccrual);
        const dailyRate = Number(employee.base_salary || 0) / 30;
        const accrualStartDate = employee.hire_date || batch.period_start;
        const expiryDate = new Date(accrualStartDate);
        expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

        // Check if vacation record exists for this year
        const { data: existingVacation } = await supabaseAdmin
          .from('employee_vacations')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('year', periodYear)
          .maybeSingle();

        if (existingVacation) {
          const newDaysAccrued = Number(existingVacation.days_accrued) + vacationDaysToAccrue;
          const daysPending = newDaysAccrued - Number(existingVacation.days_taken);

          await supabaseAdmin
            .from('employee_vacations')
            .update({
              days_accrued: newDaysAccrued,
              days_pending: daysPending,
              daily_rate: dailyRate,
              pending_amount: daysPending * dailyRate,
              expiry_date: expiryDate.toISOString().split('T')[0],
              updated_at: now.toISOString(),
              notes: `Acumulado ${vacationDaysToAccrue} días en ${batch.batch_id}`
            })
            .eq('id', existingVacation.id);

          vacationAccrualResults.push({
            employee_id: employee.employee_id,
            days_accrued: vacationDaysToAccrue,
            action: 'updated'
          });
        } else {
          await supabaseAdmin
            .from('employee_vacations')
            .insert({
              employee_id: employee.id,
              company_id: batch.company_id,
              year: periodYear,
              days_accrued: vacationDaysToAccrue,
              days_taken: 0,
              days_pending: vacationDaysToAccrue,
              daily_rate: dailyRate,
              pending_amount: vacationDaysToAccrue * dailyRate,
              accrual_start_date: accrualStartDate,
              expiry_date: expiryDate.toISOString().split('T')[0],
              notes: `Inicio de acumulación ${periodYear}`
            });

          vacationAccrualResults.push({
            employee_id: employee.employee_id,
            days_accrued: vacationDaysToAccrue,
            action: 'created'
          });
        }

        // Update employee's vac_balance_days
        const currentBalance = Number(employee.vac_balance_days || 0);
        await supabaseAdmin
          .from('employees')
          .update({ vac_balance_days: currentBalance + vacationDaysToAccrue })
          .eq('id', employee.id);
      }

      console.log(`Processed vacation accrual for ${vacationAccrualResults.length} employees`);
    }

    // Update batch status to 'enviado' after payslips are generated
    const { error: updateError } = await supabaseClient
      .from('payroll_batches')
      .update({ status: 'enviado' })
      .eq('id', batchId);

    if (updateError) {
      console.error("Batch update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payslipsGenerated: newPayslips.length,
        totalPayslips: lines.length,
        vacationAccrual: vacationAccrualResults.length > 0 ? {
          processed: vacationAccrualResults.length,
          totalDaysAccrued: vacationAccrualResults.reduce((sum, r) => sum + r.days_accrued, 0)
        } : null,
        message: newPayslips.length > 0 
          ? `Se generaron ${newPayslips.length} colillas nuevas${vacationAccrualResults.length > 0 ? ' y se acumularon vacaciones' : ''}` 
          : "Todas las colillas ya fueron generadas previamente"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in generate-payslips function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
