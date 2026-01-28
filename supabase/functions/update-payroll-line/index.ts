import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdatePayrollLineRequest {
  lineId: string;
  updates: {
    gross_salary?: number;
    regular_hours?: number;
    overtime_hours?: number;
    mixed_overtime_hours?: number;
    absence_days?: number;
    vacation_days_taken?: number;
    sick_leave_days?: number;
    additional_bonuses?: number;
    additional_deductions?: number;
    notes?: string;
  };
  reason?: string;
  autoRecalculate?: boolean; // Default true - recalculate deductions after update
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

// ========================================
// 2026 COSTA RICA ISR BRACKETS (OFFICIAL)
// ========================================
const ISR_2026_BRACKETS = {
  bracket_1_limit: 918000,
  bracket_2_limit: 1347000,
  bracket_3_limit: 2364000,
  bracket_4_limit: 4727000,
};

serve(async (req) => {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { lineId, updates, reason, autoRecalculate = true }: UpdatePayrollLineRequest = await req.json();

    console.log('Updating payroll line:', lineId, 'with updates:', updates, 'autoRecalculate:', autoRecalculate);

    // Get the current line with employee and batch data
    const { data: currentLine, error: fetchError } = await supabase
      .from('payroll_lines')
      .select('*, payroll_batches!inner(status, company_id, frequency), employees!inner(*)')
      .eq('id', lineId)
      .single();

    if (fetchError || !currentLine) {
      return new Response(
        JSON.stringify({ error: "Linea de planilla no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batchStatus = (currentLine as any).payroll_batches.status;
    if (batchStatus !== 'calculado' && batchStatus !== 'borrador') {
      return new Response(
        JSON.stringify({ error: `No se puede editar una planilla en estado: ${batchStatus}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = (currentLine as any).payroll_batches.company_id;
    const employee = (currentLine as any).employees;

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

    // Determine the new gross salary
    const newGrossSalary = updates.gross_salary !== undefined 
      ? updates.gross_salary 
      : currentLine.gross_salary;

    // If autoRecalculate is enabled, calculate deductions
    let calculatedFields = {};
    
    if (autoRecalculate && (updates.gross_salary !== undefined || 
        updates.additional_bonuses !== undefined || 
        updates.additional_deductions !== undefined ||
        updates.overtime_hours !== undefined ||
        updates.mixed_overtime_hours !== undefined)) {
      
      console.log('Auto-recalculating deductions for line:', lineId);

      // Get company parameters
      const { data: companyParams, error: paramsError } = await supabase
        .from('company_parameters')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (paramsError) {
        console.warn("Company parameters not found, using defaults:", paramsError);
      }

      // Build parameters with 2026 ISR defaults
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

      // Calculate CCSS
      const calculateCCSS = (salary: number): { amount: number; rate: number } => {
        if (params.is_education_sector) {
          const rate = params.ccss_obrero_education / 100;
          return { amount: salary * rate, rate };
        }
        const rate = params.ccss_obrero_total / 100;
        return { amount: salary * rate, rate };
      };

      // Calculate Magisterio (education sector only)
      const calculateMagisterio = (salary: number): { amount: number; rate: number } => {
        if (params.is_education_sector && params.magisterio_rate > 0) {
          const rate = params.magisterio_rate / 100;
          return { amount: salary * rate, rate };
        }
        return { amount: 0, rate: 0 };
      };

      // Calculate Poliza Vida (education sector only)
      const calculatePolizaVida = (): number => {
        if (params.is_education_sector && params.poliza_vida_fija > 0) {
          return params.poliza_vida_fija;
        }
        return 0;
      };

      // Calculate income tax
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

      // Get updated values
      const overtimeHours = updates.overtime_hours !== undefined 
        ? updates.overtime_hours 
        : (currentLine.overtime_hours || 0);
      const mixedOvertimeHours = updates.mixed_overtime_hours !== undefined 
        ? updates.mixed_overtime_hours 
        : (currentLine.mixed_overtime_hours || 0);
      const additionalDeductions = updates.additional_deductions !== undefined 
        ? updates.additional_deductions 
        : (currentLine.additional_deductions || 0);

      // Calculate hourly rate
      const hourlyRate = employee.hourly_rate || (employee.base_salary / 240);
      
      // Calculate overtime amounts
      const overtimeAmount = overtimeHours * hourlyRate * 1.5;
      const mixedOvertimeAmount = mixedOvertimeHours * hourlyRate * 2.0;

      // Calculate deductions based on gross salary
      const ccssResult = calculateCCSS(newGrossSalary);
      const magisterioResult = calculateMagisterio(newGrossSalary);
      const polizaVida = calculatePolizaVida();
      const incomeTax = calculateIncomeTax(newGrossSalary);
      const loanDeduction = Number(employee.loan_monthly_deduction || 0);

      // Build deduction items
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
          label: 'Poliza de Vida Magisterio',
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
          label: 'Prestamos',
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

      // Calculate totals
      const totalDeductions = ccssResult.amount + magisterioResult.amount + polizaVida + incomeTax + loanDeduction + additionalDeductions;
      const netPay = newGrossSalary - totalDeductions;
      const employerContrib = calculateEmployerContributions(newGrossSalary);

      const deductionsDetail: DeductionsDetail = {
        items: deductionItems,
        total_deductions: totalDeductions
      };

      const deductionSummary = deductionItems.map(d => `${d.code}: ₡${d.amount.toFixed(0)}`).join(' | ');

      calculatedFields = {
        deductions: totalDeductions,
        deductions_detail: deductionsDetail,
        net_pay: netPay,
        total_to_pay: netPay,
        employer_contrib: employerContrib,
        aguinaldo_accrued: newGrossSalary / 12,
        overtime: overtimeAmount,
        mixed_overtime_amount: mixedOvertimeAmount,
        manual_adjustments: {
          ...(currentLine.manual_adjustments || {}),
          magisterio: magisterioResult.amount,
          poliza_vida: polizaVida,
          ccss: ccssResult.amount,
          income_tax: incomeTax,
          loan_deduction: loanDeduction,
          auto_recalculated: true,
          recalculated_at: new Date().toISOString()
        },
        notes: deductionSummary
      };

      console.log('Calculated fields:', {
        grossSalary: newGrossSalary,
        totalDeductions,
        netPay,
        employerContrib
      });
    }

    // Update the payroll line
    const { data: updatedLine, error: updateError } = await supabase
      .from('payroll_lines')
      .update({
        ...updates,
        ...calculatedFields,
        updated_at: new Date().toISOString()
      })
      .eq('id', lineId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payroll line:', updateError);
      return new Response(
        JSON.stringify({ error: "Error al actualizar la linea de planilla" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Payroll line updated successfully with auto-recalculation');

    return new Response(
      JSON.stringify({ 
        success: true, 
        line: updatedLine,
        changes_recorded: changeRecords.length,
        auto_recalculated: autoRecalculate && Object.keys(calculatedFields).length > 0
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
