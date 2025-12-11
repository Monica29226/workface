-- Create company_parameters table for payroll settings
CREATE TABLE public.company_parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- CCSS Patronal rates
  ccss_patronal_sem NUMERIC NOT NULL DEFAULT 9.25,
  ccss_patronal_ivm NUMERIC NOT NULL DEFAULT 5.25,
  ccss_patronal_total NUMERIC NOT NULL DEFAULT 14.50,
  
  -- CCSS Employee rates
  ccss_obrero_sem NUMERIC NOT NULL DEFAULT 5.50,
  ccss_obrero_ivm NUMERIC NOT NULL DEFAULT 4.00,
  ccss_obrero_total NUMERIC NOT NULL DEFAULT 9.50,
  
  -- Other employer contributions
  ina_rate NUMERIC NOT NULL DEFAULT 1.50,
  imas_rate NUMERIC NOT NULL DEFAULT 0.50,
  fodesaf_rate NUMERIC NOT NULL DEFAULT 5.00,
  banco_popular_patronal NUMERIC NOT NULL DEFAULT 0.25,
  banco_popular_obrero NUMERIC NOT NULL DEFAULT 1.00,
  ins_riesgos_trabajo NUMERIC NOT NULL DEFAULT 1.50,
  
  -- Prestaciones rates
  aguinaldo_rate NUMERIC NOT NULL DEFAULT 8.33,
  cesantia_rate NUMERIC NOT NULL DEFAULT 8.33,
  vacaciones_rate NUMERIC NOT NULL DEFAULT 4.17,
  
  -- Income tax brackets (Costa Rica 2025)
  renta_bracket_1_limit NUMERIC NOT NULL DEFAULT 941000,
  renta_bracket_1_rate NUMERIC NOT NULL DEFAULT 0,
  renta_bracket_2_limit NUMERIC NOT NULL DEFAULT 1381000,
  renta_bracket_2_rate NUMERIC NOT NULL DEFAULT 10,
  renta_bracket_3_limit NUMERIC NOT NULL DEFAULT 2423000,
  renta_bracket_3_rate NUMERIC NOT NULL DEFAULT 15,
  renta_bracket_4_limit NUMERIC NOT NULL DEFAULT 4845000,
  renta_bracket_4_rate NUMERIC NOT NULL DEFAULT 20,
  renta_bracket_5_rate NUMERIC NOT NULL DEFAULT 25,
  
  -- Minimum wage reference
  salario_minimo_referencia NUMERIC NOT NULL DEFAULT 12236.95,
  
  -- Vacation settings
  vacation_days_standard NUMERIC NOT NULL DEFAULT 10,
  vacation_days_domestic NUMERIC NOT NULL DEFAULT 15,
  vacation_weeks_required NUMERIC NOT NULL DEFAULT 50,
  vacation_monthly_accrual NUMERIC NOT NULL DEFAULT 1,
  vacation_domestic_monthly_accrual NUMERIC NOT NULL DEFAULT 1.25,
  vacation_expiry_months NUMERIC NOT NULL DEFAULT 12,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_company_parameters UNIQUE (company_id)
);

-- Enable RLS
ALTER TABLE public.company_parameters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage company parameters"
ON public.company_parameters
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR 
       (has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), company_id)));

CREATE POLICY "Users can view their company parameters"
ON public.company_parameters
FOR SELECT
USING (has_company_access(auth.uid(), company_id));

-- Create trigger for updated_at
CREATE TRIGGER update_company_parameters_updated_at
BEFORE UPDATE ON public.company_parameters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create employee_vacations table for tracking vacation balances
CREATE TABLE public.employee_vacations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Vacation tracking
  year INTEGER NOT NULL,
  days_accrued NUMERIC NOT NULL DEFAULT 0,
  days_taken NUMERIC NOT NULL DEFAULT 0,
  days_pending NUMERIC GENERATED ALWAYS AS (days_accrued - days_taken) STORED,
  
  -- Expiry tracking
  accrual_start_date DATE,
  expiry_date DATE,
  
  -- Financial value
  daily_rate NUMERIC,
  pending_amount NUMERIC GENERATED ALWAYS AS ((days_accrued - days_taken) * COALESCE(daily_rate, 0)) STORED,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_employee_vacation_year UNIQUE (employee_id, year)
);

-- Enable RLS
ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and managers can manage employee vacations"
ON public.employee_vacations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR 
       (has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), company_id)));

CREATE POLICY "Employees can view their own vacation records"
ON public.employee_vacations
FOR SELECT
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_employee_vacations_updated_at
BEFORE UPDATE ON public.employee_vacations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create cost_centers table
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_cost_center_code UNIQUE (company_id, code)
);

-- Enable RLS
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and managers can manage cost centers"
ON public.cost_centers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR 
       (has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), company_id)));

CREATE POLICY "Users can view their company cost centers"
ON public.cost_centers
FOR SELECT
USING (has_company_access(auth.uid(), company_id));

-- Create trigger for updated_at
CREATE TRIGGER update_cost_centers_updated_at
BEFORE UPDATE ON public.cost_centers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add cost_center_id to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id);

-- Add cost_center_id to payroll_lines table
ALTER TABLE public.payroll_lines ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id);