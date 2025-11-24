import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratePayslipsRequest {
  batchId: string;
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

    const { batchId }: GeneratePayslipsRequest = await req.json();

    console.log("Generating payslips for batch:", batchId);

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
          work_email
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
        pdf_file_path: null, // PDFs will be generated on-demand
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
        message: newPayslips.length > 0 
          ? `Se generaron ${newPayslips.length} colillas nuevas` 
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
