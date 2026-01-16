-- Agregar campos para sector educación (Magisterio) a company_parameters
ALTER TABLE public.company_parameters
ADD COLUMN IF NOT EXISTS is_education_sector boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS magisterio_rate numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS poliza_vida_fija numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ccss_obrero_education numeric NOT NULL DEFAULT 6.70;

-- Agregar campo de préstamos activos a employees
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS loan_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS loan_monthly_deduction numeric DEFAULT 0;

-- Crear tabla para manejar préstamos de empleados con historial
CREATE TABLE IF NOT EXISTS public.employee_loans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  loan_type text NOT NULL DEFAULT 'personal',
  original_amount numeric NOT NULL DEFAULT 0,
  remaining_balance numeric NOT NULL DEFAULT 0,
  monthly_deduction numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on employee_loans
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;

-- RLS policies for employee_loans
CREATE POLICY "Admins and managers can manage employee loans"
ON public.employee_loans
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Employees can view their own loans"
ON public.employee_loans
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
);

-- Comentarios para documentación
COMMENT ON COLUMN public.company_parameters.is_education_sector IS 'Indica si es empresa del sector educación (aplica Magisterio)';
COMMENT ON COLUMN public.company_parameters.magisterio_rate IS 'Tasa de retención del Magisterio (ej: 8.50 para 8.5%)';
COMMENT ON COLUMN public.company_parameters.poliza_vida_fija IS 'Monto fijo de póliza de vida mensual';
COMMENT ON COLUMN public.company_parameters.ccss_obrero_education IS 'Tasa CCSS obrero para sector educación (ej: 6.70 para 6.7%)';