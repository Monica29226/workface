import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecalculateRequest {
  batchId: string;
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

    // Get batch and all lines
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

    // Helper functions for calculations
    const calculateCCSS = (grossSalary: number) => {
      const ivmEmployee = grossSalary * 0.0417; // 4.17%
      const invalidezEmployee = grossSalary * 0.005; // 0.5%
      const healthEmployee = grossSalary * 0.055; // 5.5%
      return ivmEmployee + invalidezEmployee + healthEmployee;
    };

    const calculateIncomeTax = (monthlySalary: number) => {
      if (monthlySalary <= 941000) return 0;
      if (monthlySalary <= 1403000) return (monthlySalary - 941000) * 0.10;
      if (monthlySalary <= 2571000) return 46200 + (monthlySalary - 1403000) * 0.15;
      if (monthlySalary <= 5142000) return 221400 + (monthlySalary - 2571000) * 0.20;
      return 735600 + (monthlySalary - 5142000) * 0.25;
    };

    // Recalculate each line
    const updatedLines = [];
    for (const line of lines) {
      const employee = (line as any).employees;
      
      // Calculate gross salary based on contract type and manual adjustments
      let grossSalary = 0;
      
      if (employee.contract_type === 'mensual') {
        grossSalary = employee.base_salary;
      } else if (employee.contract_type === 'por_horas') {
        const regularHours = line.regular_hours || 0;
        const overtimeHours = line.overtime_hours || 0;
        grossSalary = (regularHours * employee.hourly_rate) + (overtimeHours * employee.hourly_rate * 1.5);
      }

      // Add bonuses and project hours
      grossSalary += (line.additional_bonuses || 0);
      grossSalary += (line.project_hours_amount || 0);

      // Subtract absences (unpaid days)
      const absenceDays = line.absence_days || 0;
      const dailyRate = employee.base_salary / 30;
      grossSalary -= (absenceDays * dailyRate);

      // Calculate deductions
      const ccssDeductions = calculateCCSS(grossSalary);
      const incomeTax = calculateIncomeTax(grossSalary);
      const additionalDeductions = line.additional_deductions || 0;
      const totalDeductions = ccssDeductions + incomeTax + additionalDeductions;

      // Calculate net pay
      const netPay = grossSalary - totalDeductions;

      // Calculate employer contributions
      const employerCCSS = grossSalary * 0.2667; // 26.67%
      const employerINS = grossSalary * 0.0150; // 1.50%
      const employerContrib = employerCCSS + employerINS;

      // Calculate accruals
      const aguinaldoAccrued = grossSalary / 12;
      const vacationAccruedDays = (line.vacation_days_taken || 0) > 0 ? 0 : 1.25; // 1.25 days per month

      updatedLines.push({
        id: line.id,
        gross_salary: grossSalary,
        deductions: totalDeductions,
        net_pay: netPay,
        employer_contrib: employerContrib,
        aguinaldo_accrued: aguinaldoAccrued,
        vacation_accrued_days: vacationAccruedDays,
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

    console.log('Batch recalculated successfully, updated', updatedLines.length, 'lines');

    return new Response(
      JSON.stringify({ 
        success: true, 
        lines_updated: updatedLines.length 
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