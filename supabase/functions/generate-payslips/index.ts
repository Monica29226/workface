import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratePayslipsRequest {
  batchId: string;
  accrueVacations?: boolean;  // Flag to trigger vacation accrual
  sendEmails?: boolean;
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

    const { batchId, accrueVacations = true, sendEmails = false }: GeneratePayslipsRequest = await req.json();

    console.log("Generating payslips for batch:", batchId, "with vacation accrual:", accrueVacations, "and sendEmails:", sendEmails);

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
    const linesToAutoSend = lines
      .filter(line => !existingEmployeeIds.has(line.employee_id));

    const newPayslips = linesToAutoSend
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

    // Accrue vacations via single source of truth (recalculate_vacation_accruals)
    let vacationAccrualResults: any[] = [];
    if (accrueVacations && newPayslips.length > 0) {
      console.log("Recalculating vacation accruals for company:", batch.company_id);
      const { data: processed, error: rpcError } = await supabaseAdmin.rpc(
        'recalculate_vacation_accruals',
        { p_company_id: batch.company_id, p_year: periodYear }
      );
      if (rpcError) {
        console.error("Vacation accrual RPC error:", rpcError);
      } else {
        vacationAccrualResults = Array(Number(processed) || 0).fill({ action: 'recalculated' });
        console.log(`Recalculated vacation accruals for ${processed} employees`);
      }
    }

    // Update batch status to 'enviado' after payslips are generated
    const { error: updateError } = await supabaseClient
      .from('payroll_batches')
      .update({ status: 'enviado' })
      .eq('id', batchId);

    if (updateError) {
      console.error("Batch update error:", updateError);
    }

    // ── AUTO-SEND PAYSLIP EMAILS ──
    const emailResults: { employee_id: string; status: string; error?: string }[] = [];

    if (sendEmails && newPayslips.length > 0) {
      console.log("Auto-sending payslip emails for", linesToAutoSend.length, "employees");

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const authHeader = req.headers.get("Authorization") || "";

      for (const line of linesToAutoSend) {
        const employee = line.employee;

        // Skip employees without email
        if (!employee.work_email) {
          console.warn(`Employee ${employee.employee_id} has no email, skipping auto-send`);

          // Log the failure in email_logs
          await supabaseAdmin.from("email_logs").insert({
            company_id: batch.company_id,
            recipient_email: "sin_correo@n-a.com",
            recipient_name: employee.full_name,
            subject: `[AUTO] Boleta de Pago - ${periodLabel}`,
            status: "failed",
            error_message: "Colaborador sin correo electrónico registrado",
          });

          emailResults.push({
            employee_id: employee.employee_id,
            status: "failed",
            error: "Sin correo registrado",
          });
          continue;
        }

        try {
          // Call send-payslip-email edge function via HTTP
          const sendResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-payslip-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
                apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
              },
              body: JSON.stringify({
                payrollLineId: line.id,
                companyId: batch.company_id,
              }),
            }
          );

          const sendResult = await sendResponse.json();

          if (sendResponse.ok && sendResult.success) {
            emailResults.push({
              employee_id: employee.employee_id,
              status: "sent",
            });
          } else {
            console.error(`Failed to send email to ${employee.work_email}:`, sendResult.error);
            emailResults.push({
              employee_id: employee.employee_id,
              status: "failed",
              error: sendResult.error || "Error desconocido",
            });
          }
        } catch (emailError: any) {
          console.error(`Error sending email to ${employee.work_email}:`, emailError.message);
          emailResults.push({
            employee_id: employee.employee_id,
            status: "failed",
            error: emailError.message,
          });
        }
      }

      console.log(`Auto-send complete: ${emailResults.filter(r => r.status === 'sent').length} sent, ${emailResults.filter(r => r.status === 'failed').length} failed`);
    }

    const emailsSent = emailResults.filter(r => r.status === "sent").length;
    const emailsFailed = emailResults.filter(r => r.status === "failed").length;

    return new Response(
      JSON.stringify({
        success: true,
        payslipsGenerated: newPayslips.length,
        totalPayslips: lines.length,
        emailsSent,
        emailsFailed,
        emailResults,
        vacationAccrual: vacationAccrualResults.length > 0 ? {
          processed: vacationAccrualResults.length,
          totalDaysAccrued: vacationAccrualResults.reduce((sum, r) => sum + r.days_accrued, 0)
        } : null,
        message: newPayslips.length > 0 
          ? `Se generaron ${newPayslips.length} colillas${sendEmails ? ` y se enviaron ${emailsSent} correos${emailsFailed > 0 ? ` (${emailsFailed} fallidos)` : ''}` : ' sin envio automatico'}${vacationAccrualResults.length > 0 ? ' + vacaciones acumuladas' : ''}` 
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
