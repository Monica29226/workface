-- ACL Payroll CR Database Schema
-- Sistema multi-empresa y multi-moneda para gestión de planillas en Costa Rica

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

-- Roles de usuario
CREATE TYPE public.app_role AS ENUM ('admin', 'company_manager', 'employee');

-- Monedas soportadas
CREATE TYPE public.currency_type AS ENUM ('CRC', 'USD', 'EUR', 'GBP');

-- Estados de empleado
CREATE TYPE public.employee_status AS ENUM ('activo', 'inactivo');

-- Tipos de contrato
CREATE TYPE public.contract_type AS ENUM ('mensual', 'por_horas');

-- Frecuencia de planilla
CREATE TYPE public.payroll_frequency AS ENUM ('semanal', 'quincenal', 'mensual');

-- Estados de lote de planilla
CREATE TYPE public.payroll_batch_status AS ENUM ('borrador', 'calculado', 'aprobado', 'enviado');

-- Estados de proyecto
CREATE TYPE public.project_status AS ENUM ('activo', 'cerrado');

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- Tabla de Empresas (Multi-empresa)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  tax_id TEXT,
  iban TEXT,
  payroll_email_from TEXT,
  base_currency currency_type NOT NULL DEFAULT 'CRC',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de Perfiles de Usuario (extiende auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de Roles de Usuario (por empresa)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, role)
);

-- Tabla de Usuarios por Empresa (para gestión de acceso multi-empresa)
CREATE TABLE public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Tabla de Empleados
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  base_salary DECIMAL(15,2) NOT NULL,
  hourly_rate DECIMAL(10,2),
  hire_date DATE,
  contract_type contract_type NOT NULL,
  vac_balance_days DECIMAL(10,2) DEFAULT 0,
  aguinaldo_base_12m DECIMAL(15,2) DEFAULT 0,
  currency currency_type NOT NULL DEFAULT 'CRC',
  status employee_status NOT NULL DEFAULT 'activo',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de Proyectos
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  internal_code TEXT,
  hourly_rate DECIMAL(10,2),
  currency currency_type NOT NULL DEFAULT 'CRC',
  status project_status DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de Entradas de Tiempo (Time Tracking)
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  hours DECIMAL(10,2) NOT NULL,
  approved BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de Lotes de Planilla
CREATE TABLE public.payroll_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  frequency payroll_frequency NOT NULL,
  base_currency currency_type NOT NULL DEFAULT 'CRC',
  status payroll_batch_status DEFAULT 'borrador',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de Líneas de Planilla (Detalle por Empleado)
CREATE TABLE public.payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id TEXT UNIQUE NOT NULL,
  batch_id UUID REFERENCES public.payroll_batches(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  gross_salary DECIMAL(15,2) NOT NULL,
  overtime DECIMAL(15,2) DEFAULT 0,
  project_hours_amount DECIMAL(15,2) DEFAULT 0,
  deductions DECIMAL(15,2) DEFAULT 0,
  employer_contrib DECIMAL(15,2) DEFAULT 0,
  aguinaldo_accrued DECIMAL(15,2) DEFAULT 0,
  vacation_accrued_days DECIMAL(10,2) DEFAULT 0,
  net_pay DECIMAL(15,2) NOT NULL,
  currency currency_type NOT NULL DEFAULT 'CRC',
  exchange_rate_to_base DECIMAL(10,4) DEFAULT 1.0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de Boletas de Pago (PaySlips)
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id TEXT UNIQUE NOT NULL,
  batch_id UUID REFERENCES public.payroll_batches(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  employee_email TEXT NOT NULL,
  period_label TEXT NOT NULL,
  pdf_file_path TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de Log de Auditoría
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id TEXT UNIQUE NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_email TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  details TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_employees_user ON public.employees(user_id);
CREATE INDEX idx_projects_company ON public.projects(company_id);
CREATE INDEX idx_time_entries_employee ON public.time_entries(employee_id);
CREATE INDEX idx_time_entries_project ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_company ON public.time_entries(company_id);
CREATE INDEX idx_time_entries_date ON public.time_entries(entry_date);
CREATE INDEX idx_payroll_batches_company ON public.payroll_batches(company_id);
CREATE INDEX idx_payroll_lines_batch ON public.payroll_lines(batch_id);
CREATE INDEX idx_payroll_lines_employee ON public.payroll_lines(employee_id);
CREATE INDEX idx_payslips_batch ON public.payslips(batch_id);
CREATE INDEX idx_payslips_employee ON public.payslips(employee_id);
CREATE INDEX idx_company_users_user ON public.company_users(user_id);
CREATE INDEX idx_company_users_company ON public.company_users(company_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Función para verificar si un usuario tiene un rol específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Función para verificar si un usuario tiene acceso a una empresa
CREATE OR REPLACE FUNCTION public.has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = _user_id
      AND company_id = _company_id
  )
$$;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Función para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Triggers para updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_users_updated_at BEFORE UPDATE ON public.company_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_batches_updated_at BEFORE UPDATE ON public.payroll_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_lines_updated_at BEFORE UPDATE ON public.payroll_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payslips_updated_at BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para crear perfil automáticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas para PROFILES
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Políticas para COMPANIES
CREATE POLICY "Admins can view all companies"
  ON public.companies FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company managers can view their companies"
  ON public.companies FOR SELECT
  USING (
    public.has_role(auth.uid(), 'company_manager') AND
    public.has_company_access(auth.uid(), id)
  );

CREATE POLICY "Employees can view their company"
  ON public.companies FOR SELECT
  USING (
    public.has_role(auth.uid(), 'employee') AND
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.user_id = auth.uid()
        AND employees.company_id = companies.id
    )
  );

CREATE POLICY "Admins can manage companies"
  ON public.companies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para EMPLOYEES
CREATE POLICY "Admins can view all employees"
  ON public.employees FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company managers can view their company employees"
  ON public.employees FOR SELECT
  USING (
    public.has_role(auth.uid(), 'company_manager') AND
    public.has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Employees can view their own record"
  ON public.employees FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins and managers can manage employees"
  ON public.employees FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'company_manager') AND public.has_company_access(auth.uid(), company_id))
  );

-- Políticas para TIME_ENTRIES
CREATE POLICY "Users can view time entries for their company"
  ON public.time_entries FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'company_manager') AND public.has_company_access(auth.uid(), company_id)) OR
    (public.has_role(auth.uid(), 'employee') AND employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Employees can create their own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers and admins can manage time entries"
  ON public.time_entries FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'company_manager') AND public.has_company_access(auth.uid(), company_id))
  );

-- Políticas para PAYROLL_BATCHES
CREATE POLICY "Users can view payroll batches for their company"
  ON public.payroll_batches FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'company_manager') AND public.has_company_access(auth.uid(), company_id))
  );

CREATE POLICY "Admins and managers can manage payroll batches"
  ON public.payroll_batches FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'company_manager') AND public.has_company_access(auth.uid(), company_id))
  );

-- Políticas para PAYSLIPS
CREATE POLICY "Users can view payslips for their company or their own"
  ON public.payslips FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'company_manager') AND public.has_company_access(auth.uid(), company_id)) OR
    (public.has_role(auth.uid(), 'employee') AND employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    ))
  );

-- Políticas para AUDIT_LOG
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);