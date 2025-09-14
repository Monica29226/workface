-- Sistema de Planillas Multi-Compañía Costa Rica
-- Crear todas las tablas principales del sistema

-- Tabla de compañías (multi-tenant)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  juridical_id VARCHAR(50) NOT NULL,
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#0B2B4C',
  accent_color VARCHAR(7) DEFAULT '#2A9D8F', 
  light_color VARCHAR(7) DEFAULT '#F5EFE6',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  language VARCHAR(2) DEFAULT 'es',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de roles por compañía (RBAC)
CREATE TABLE IF NOT EXISTS public.company_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Owner', 'Admin', 'Payroll', 'Manager', 'Viewer', 'Employee')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Tabla de empleados
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  cedula VARCHAR(20) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  birth_date DATE,
  nss_ccss VARCHAR(50),
  civil_status VARCHAR(50),
  children_count INTEGER DEFAULT 0,
  iban VARCHAR(100),
  payment_currency VARCHAR(3) DEFAULT 'CRC',
  cost_center VARCHAR(255),
  department VARCHAR(255),
  manager_id UUID REFERENCES public.employees(id),
  hire_date DATE NOT NULL,
  termination_date DATE,
  has_garnishment BOOLEAN DEFAULT false,
  has_pension BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, cedula)
);

-- Tabla de contratos
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type VARCHAR(50) NOT NULL DEFAULT 'indefinido',
  payment_period VARCHAR(50) NOT NULL DEFAULT 'mensual',
  workday_type VARCHAR(50) NOT NULL DEFAULT 'diurna',
  max_weekly_hours INTEGER DEFAULT 48,
  schedule_text TEXT,
  base_salary DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CRC',
  start_date DATE NOT NULL,
  end_date DATE,
  overtime_rate DECIMAL(5,2) DEFAULT 1.50,
  night_rate DECIMAL(5,2) DEFAULT 1.25,
  holiday_rate DECIMAL(5,2) DEFAULT 2.00,
  commissions DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de períodos de planilla
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  exchange_rate DECIMAL(10,4) DEFAULT 510.27,
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Review', 'Approved', 'Closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de timesheets (distribución de jornada)
CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  activity VARCHAR(255) NOT NULL,
  project VARCHAR(255),
  cost_center VARCHAR(255) NOT NULL,
  hours DECIMAL(4,2) NOT NULL,
  description TEXT,
  is_weekend BOOLEAN DEFAULT false,
  is_holiday BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de planillas generadas
CREATE TABLE IF NOT EXISTS public.payrolls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  period_id UUID REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  gross_salary DECIMAL(12,2) NOT NULL,
  social_charges DECIMAL(12,2) DEFAULT 0,
  salary_retention DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) NOT NULL,
  aguinaldo DECIMAL(12,2) DEFAULT 0,
  vacations_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de parámetros del sistema
CREATE TABLE IF NOT EXISTS public.system_parameters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  vacation_days_per_month DECIMAL(4,2) DEFAULT 1.25,
  overtime_rate DECIMAL(5,2) DEFAULT 1.50,
  night_rate DECIMAL(5,2) DEFAULT 1.25,
  holiday_rate DECIMAL(5,2) DEFAULT 2.00,
  saturday_multiplier DECIMAL(5,2) DEFAULT 1.00,
  sunday_multiplier DECIMAL(5,2) DEFAULT 1.50,
  workweek VARCHAR(20) DEFAULT 'Mon-Fri',
  ccss_employee_rate DECIMAL(5,4) DEFAULT 0.10,
  ccss_employer_rate DECIMAL(5,4) DEFAULT 0.26,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, year)
);

-- Tabla de centros de costo
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee_id ON public.contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_company_id ON public.timesheets(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_id ON public.timesheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON public.timesheets(date);
CREATE INDEX IF NOT EXISTS idx_payrolls_company_id ON public.payrolls(company_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_period_id ON public.payrolls(period_id);

-- Habilitar Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (usuarios autenticados pueden ver sus datos de compañía)
CREATE POLICY "Users can view companies they belong to" ON public.companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view company users for their companies" ON public.company_users
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Políticas para empleados (filtrado por compañía)
CREATE POLICY "Users can view employees from their companies" ON public.employees
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can manage employees in their companies" ON public.employees
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
      AND role IN ('Owner', 'Admin', 'Payroll')
    )
  );

-- Políticas similares para otras tablas
CREATE POLICY "Users can view contracts from their companies" ON public.contracts
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can view timesheets from their companies" ON public.timesheets
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can view payrolls from their companies" ON public.payrolls
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar timestamps
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar datos demo
INSERT INTO public.companies (id, name, legal_name, juridical_id, primary_color, accent_color, light_color) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'Horizonte Positivo', 'Asociación Horizonte Positivo', '3-002-674691', '#0B2B4C', '#2A9D8F', '#F5EFE6'),
  ('550e8400-e29b-41d4-a716-446655440001', 'Alturas de Tenorio', 'Alturas de Tenorio S.A.', '3-101-555555', '#0B2B4C', '#2A9D8F', '#F5EFE6');

INSERT INTO public.cost_centers (company_id, name, code) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'Administración', 'ADM'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Programas', 'PROG'),
  ('550e8400-e29b-41d4-a716-446655440001', 'Operaciones', 'OPS'),
  ('550e8400-e29b-41d4-a716-446655440001', 'Administración', 'ADM');

INSERT INTO public.system_parameters (company_id, year) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 2025),
  ('550e8400-e29b-41d4-a716-446655440001', 2025);