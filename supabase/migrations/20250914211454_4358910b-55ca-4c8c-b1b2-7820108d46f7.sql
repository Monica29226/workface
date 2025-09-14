-- =====================================================
-- SECURITY FIX: Employee Data Protection (Fixed Version)
-- =====================================================

-- Drop problematic policies safely if they exist
DO $$
BEGIN
    -- Drop the problematic employee policy
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'Employees can view their own profile') THEN
        DROP POLICY "Employees can view their own profile" ON public.employees;
    END IF;

    -- Drop overly permissive payroll policy
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payrolls' AND policyname = 'Users can view payrolls from their companies') THEN
        DROP POLICY "Users can view payrolls from their companies" ON public.payrolls;
    END IF;

    -- Drop general audit log policy
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'Users can view audit log for their companies') THEN
        DROP POLICY "Users can view audit log for their companies" ON public.audit_log;
    END IF;
END
$$;

-- Create employee-user mapping table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.employee_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, user_id)
);

-- Enable RLS on the mapping table
ALTER TABLE public.employee_user_mapping ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on mapping table if they exist and recreate
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_user_mapping' AND policyname = 'Users can view their own employee mapping') THEN
        DROP POLICY "Users can view their own employee mapping" ON public.employee_user_mapping;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_user_mapping' AND policyname = 'HR can manage employee mappings') THEN
        DROP POLICY "HR can manage employee mappings" ON public.employee_user_mapping;
    END IF;
END
$$;

-- Create mapping table policies
CREATE POLICY "Users can view their own employee mapping" 
ON public.employee_user_mapping 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "HR can manage employee mappings" 
ON public.employee_user_mapping 
FOR ALL 
USING (
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid() 
    AND company_users.active = true 
    AND company_users.role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
  )
);

-- Create the corrected employee policy for regular users (only their own data)
CREATE POLICY "Employees can only view their own profile" 
ON public.employees 
FOR SELECT 
USING (
  id IN (
    SELECT employee_user_mapping.employee_id 
    FROM employee_user_mapping 
    WHERE employee_user_mapping.user_id = auth.uid()
  )
);

-- =====================================================
-- PAYROLL DATA PROTECTION
-- =====================================================

-- Create restricted payroll viewing policy - only HR roles can view all data
CREATE POLICY "Only HR roles can view all payroll data" 
ON public.payrolls 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid() 
    AND company_users.active = true 
    AND company_users.role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
  )
);

-- Allow employees to view only their own payroll records
CREATE POLICY "Employees can view their own payroll" 
ON public.payrolls 
FOR SELECT 
USING (
  employee_id IN (
    SELECT employee_user_mapping.employee_id 
    FROM employee_user_mapping 
    WHERE employee_user_mapping.user_id = auth.uid()
  )
);

-- =====================================================
-- ENHANCED SECURITY FUNCTIONS
-- =====================================================

-- Enhanced function for sensitive field access
CREATE OR REPLACE FUNCTION public.can_access_employee_sensitive_fields()
RETURNS BOOLEAN AS $$
BEGIN
  -- Only Owner, Admin, and Payroll roles can access sensitive fields like IBAN, SSN
  RETURN EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function for basic employee data access (managers can see names, departments, etc.)
CREATE OR REPLACE FUNCTION public.can_access_employee_basic_data()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll', 'Manager'])
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- =====================================================
-- AUDIT LOG SECURITY ENHANCEMENT
-- =====================================================

-- Time-restricted audit log access for Owners and Admins (90 days)
CREATE POLICY "Limited audit log access for admins" 
ON public.audit_log 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid() 
    AND company_users.active = true 
    AND company_users.role::text = ANY (ARRAY['Owner', 'Admin'])
  )
  AND created_at >= NOW() - INTERVAL '90 days'
);

-- Limited audit log access for Payroll role (30 days, specific entities only)
CREATE POLICY "Payroll limited audit access" 
ON public.audit_log 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid() 
    AND company_users.active = true 
    AND company_users.role::text = 'Payroll'
  )
  AND entidad IN ('payrolls', 'employees', 'contracts')
  AND created_at >= NOW() - INTERVAL '30 days'
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Indexes for better performance on security queries
CREATE INDEX IF NOT EXISTS idx_employees_company_active ON employees(company_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_employee_user_mapping_lookup ON employee_user_mapping(user_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_company_users_role_lookup ON company_users(user_id, role, active) WHERE active = true;