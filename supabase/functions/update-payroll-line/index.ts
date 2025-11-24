import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdatePayrollLineRequest {
  lineId: string;
  updates: {
    regular_hours?: number;
    overtime_hours?: number;
    absence_days?: number;
    vacation_days_taken?: number;
    sick_leave_days?: number;
    additional_bonuses?: number;
    additional_deductions?: number;
    notes?: string;
  };
  reason?: string;
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

    const { lineId, updates, reason }: UpdatePayrollLineRequest = await req.json();

    console.log('Updating payroll line:', lineId, 'with updates:', updates);

    // Get the current line to check batch status and record changes
    const { data: currentLine, error: fetchError } = await supabase
      .from('payroll_lines')
      .select('*, payroll_batches!inner(status)')
      .eq('id', lineId)
      .single();

    if (fetchError || !currentLine) {
      return new Response(
        JSON.stringify({ error: "Línea de planilla no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow editing if batch is in 'calculado' or 'borrador' status
    const batchStatus = (currentLine as any).payroll_batches.status;
    if (batchStatus !== 'calculado' && batchStatus !== 'borrador') {
      return new Response(
        JSON.stringify({ error: `No se puede editar una planilla en estado: ${batchStatus}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record changes in audit table
    const changeRecords = [];
    for (const [field, newValue] of Object.entries(updates)) {
      if (newValue !== undefined && newValue !== (currentLine as any)[field]) {
        changeRecords.push({
          payroll_line_id: lineId,
          changed_by: user.id,
          field_name: field,
          old_value: (currentLine as any)[field],
          new_value: newValue,
          reason: reason || null,
        });
      }
    }

    if (changeRecords.length > 0) {
      const { error: auditError } = await supabase
        .from('payroll_line_changes')
        .insert(changeRecords);

      if (auditError) {
        console.error('Error recording changes:', auditError);
      }
    }

    // Update the payroll line
    const { data: updatedLine, error: updateError } = await supabase
      .from('payroll_lines')
      .update(updates)
      .eq('id', lineId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payroll line:', updateError);
      return new Response(
        JSON.stringify({ error: "Error al actualizar la línea de planilla" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Payroll line updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        line: updatedLine,
        changes_recorded: changeRecords.length 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('Error in update-payroll-line function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});