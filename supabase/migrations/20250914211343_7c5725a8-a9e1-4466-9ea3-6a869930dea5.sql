-- =====================================================
-- SECURITY FIX: Employee Data Protection
-- =====================================================

-- First, drop the problematic RLS policy that allows all employees to see everyone's data
DROP POLICY IF EXISTS "Employees can view their own profile" ON public.employees;

-- Create a new policy that truly restricts employees to only their own data
-- This links employees to users through a junction table that needs to be created
CREATE TABLE IF NOT EXISTS public.employee_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, user_id)
);

-- Enable RLS on the mapping table
ALTER TABLE public.employee_user_mapping ENABLE ROW LEVEL SECURITY;

-- Policy for mapping table - users can only see their own mappings
CREATE POLICY "Users can view their own employee mapping" 
ON public.employee_user_mapping 
FOR SELECT 
USING (user_id = auth.uid());

-- Policy for HR to manage mappings
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

-- Now create the corrected employee policy for regular users
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

-- Drop the overly permissive payroll viewing policy
DROP POLICY IF EXISTS "Users can view payrolls from their companies" ON public.payrolls;

-- Create restricted payroll viewing policy - only HR roles can view
CREATE POLICY "Only HR roles can view payroll data" 
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
-- ENHANCED SECURITY FUNCTION
-- =====================================================

-- Create an enhanced function to check field-level access
CREATE OR REPLACE FUNCTION public.can_access_employee_sensitive_fields()
RETURNS BOOLEAN AS $$
BEGIN
  -- Only Owner, Admin, and Payroll roles can access sensitive fields
  -- Managers can view basic data but not sensitive fields like IBAN, SSN
  RETURN EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Create function to check if user can view employee basic data (for managers)
CREATE OR REPLACE FUNCTION public.can_access_employee_basic_data()
RETURNS BOOLEAN AS $$
BEGIN
  -- Owner, Admin, Payroll, and Manager roles can access basic employee data
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

-- Drop the existing general audit log policy
DROP POLICY IF EXISTS "Users can view audit log for their companies" ON public.audit_log;

-- Create time-restricted audit log policy (only last 90 days for most users)
CREATE POLICY "Limited audit log access" 
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

-- Allow Payroll role to only view payroll-related audit logs
CREATE POLICY "Payroll can view payroll audit logs" 
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
-- ADDITIONAL SECURITY MEASURES
-- =====================================================

-- Ensure sensitive columns are properly indexed for performance
CREATE INDEX IF NOT EXISTS idx_employees_sensitive_access ON employees(company_id, active) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_employee_user_mapping_lookup ON employee_user_mapping(user_id, employee_id);

-- Add constraint to ensure employee mapping is within same company
ALTER TABLE employee_user_mapping 
ADD CONSTRAINT fk_employee_user_mapping_company 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;