
-- =============================================================================
-- FIX: Update employees RLS policies to include Client roles
-- =============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Company managers can view their company employees" ON employees;
DROP POLICY IF EXISTS "Admins and managers can manage employees" ON employees;

-- Create new SELECT policy that includes all client roles
CREATE POLICY "Users can view employees of their companies"
ON employees FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() AND cu.company_id = employees.company_id
  )
);

-- Create management policy for admins and managers
CREATE POLICY "Admins and managers can manage employees"
ON employees FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() 
      AND cu.company_id = employees.company_id
      AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
  )
);
