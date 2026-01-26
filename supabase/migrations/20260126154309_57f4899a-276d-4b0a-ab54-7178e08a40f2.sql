-- Add job_title column to employees table for Horizonte Positivo payslips
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Add lpt_banco_popular column to payroll_lines for fixed LPT deduction per employee
ALTER TABLE public.payroll_lines 
ADD COLUMN IF NOT EXISTS lpt_banco_popular NUMERIC DEFAULT 0;

-- Add mixed_overtime_hours column for "Horas Mixtas" field
ALTER TABLE public.payroll_lines 
ADD COLUMN IF NOT EXISTS mixed_overtime_hours NUMERIC DEFAULT 0;

-- Add mixed_overtime_amount column for calculated "Horas Mixtas" amount
ALTER TABLE public.payroll_lines 
ADD COLUMN IF NOT EXISTS mixed_overtime_amount NUMERIC DEFAULT 0;

-- Add ccss_disability_hours column for "Horas Incapacidad CCSS"
ALTER TABLE public.payroll_lines 
ADD COLUMN IF NOT EXISTS ccss_disability_hours NUMERIC DEFAULT 0;

-- Add ins_disability_hours column for "Horas Incapacidad INS"
ALTER TABLE public.payroll_lines 
ADD COLUMN IF NOT EXISTS ins_disability_hours NUMERIC DEFAULT 0;

-- Add location field to payroll_batches for "Ubicación" info
ALTER TABLE public.payroll_batches 
ADD COLUMN IF NOT EXISTS payment_location TEXT DEFAULT 'San José, WeWork Escazú';

-- Add payment_date field to payroll_batches
ALTER TABLE public.payroll_batches 
ADD COLUMN IF NOT EXISTS payment_date DATE;

-- Update Horizonte Positivo employees with sample job titles
UPDATE public.employees SET job_title = 'Director Ejecutivo' WHERE id = 'ca5a8352-8705-404c-9669-b0e0bcb249e1';
UPDATE public.employees SET job_title = 'Coordinadora de Proyectos' WHERE id = '71dce56e-e296-4d1e-82fc-70cf068a15f6';
UPDATE public.employees SET job_title = 'Desarrollador Senior' WHERE id = 'd2524f99-251f-4d0f-a39a-e99d2fb3b344';
UPDATE public.employees SET job_title = 'Analista de Datos' WHERE id = 'b825f2b3-0716-480f-b06e-121a106ca175';
UPDATE public.employees SET job_title = 'Especialista en Comunicación' WHERE id = 'ec42dcc0-045d-4caf-9132-a8dc098ff32c';

-- Update company_parameters for Horizonte Positivo with quincenal deduction rates
-- SEM: 5.5% of biweekly salary, IVM: 4.17% of biweekly salary (as per PDFs)
UPDATE public.company_parameters 
SET 
  ccss_obrero_sem = 5.50,
  ccss_obrero_ivm = 4.17,
  ccss_obrero_total = 9.67
WHERE company_id = '550e8400-e29b-41d4-a716-446655440000';

-- Comment on new columns
COMMENT ON COLUMN public.employees.job_title IS 'Job title/position for payslip display (e.g., Director Ejecutivo)';
COMMENT ON COLUMN public.payroll_lines.lpt_banco_popular IS 'Fixed LPT Banco Popular deduction amount per employee (configurable)';
COMMENT ON COLUMN public.payroll_lines.mixed_overtime_hours IS 'Mixed overtime hours (Horas Mixtas)';
COMMENT ON COLUMN public.payroll_lines.mixed_overtime_amount IS 'Calculated amount for mixed overtime hours';
COMMENT ON COLUMN public.payroll_lines.ccss_disability_hours IS 'CCSS disability hours for the period';
COMMENT ON COLUMN public.payroll_lines.ins_disability_hours IS 'INS disability hours for the period';
COMMENT ON COLUMN public.payroll_batches.payment_location IS 'Location where payment is processed (e.g., San José, WeWork Escazú)';
COMMENT ON COLUMN public.payroll_batches.payment_date IS 'Actual payment date for the batch';