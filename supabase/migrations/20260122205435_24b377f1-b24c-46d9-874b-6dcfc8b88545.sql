
-- =============================================================================
-- FIX: Add RLS policies for new Client roles (Client_Admin, Client_HR, Client_Viewer)
-- These roles should have access similar to company_manager for their companies
-- =============================================================================

-- Helper function to check if user has any client admin role
CREATE OR REPLACE FUNCTION public.has_client_access_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('Client_Admin', 'Client_HR', 'Client_Viewer', 'ACL_SuperAdmin', 'ACL_PayrollSpecialist', 'ACL_Auditor')
  )
$$;

-- Helper function to check if user has any admin-level role
CREATE OR REPLACE FUNCTION public.has_admin_level_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'ACL_SuperAdmin')
  )
$$;

-- Helper function to check if user has manager-level access (for companies they have access to)
CREATE OR REPLACE FUNCTION public.has_manager_level_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('company_manager', 'Client_Admin', 'Client_HR', 'ACL_PayrollSpecialist')
  )
$$;

-- Drop and recreate company_users SELECT policies to include new roles
DROP POLICY IF EXISTS "Company managers can view their company assignments" ON company_users;
DROP POLICY IF EXISTS "Client users can view their company assignments" ON company_users;

CREATE POLICY "Company managers and clients can view their company assignments"
ON company_users FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), company_id)
  OR has_role(auth.uid(), 'Client_Admin'::app_role) AND has_company_access(auth.uid(), company_id)
  OR has_role(auth.uid(), 'Client_HR'::app_role) AND has_company_access(auth.uid(), company_id)
  OR has_role(auth.uid(), 'Client_Viewer'::app_role) AND has_company_access(auth.uid(), company_id)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role) AND has_company_access(auth.uid(), company_id)
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role) AND has_company_access(auth.uid(), company_id)
  OR user_id = auth.uid()
);

-- Drop and recreate companies SELECT policies to include new roles  
DROP POLICY IF EXISTS "Company managers can view their companies" ON companies;
DROP POLICY IF EXISTS "Client users can view their companies" ON companies;

CREATE POLICY "Company managers and clients can view their companies"
ON companies FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), id)
  OR has_role(auth.uid(), 'Client_Admin'::app_role) AND has_company_access(auth.uid(), id)
  OR has_role(auth.uid(), 'Client_HR'::app_role) AND has_company_access(auth.uid(), id)
  OR has_role(auth.uid(), 'Client_Viewer'::app_role) AND has_company_access(auth.uid(), id)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role) AND has_company_access(auth.uid(), id)
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role) AND has_company_access(auth.uid(), id)
);
