-- Update RLS policy for payroll_batches SELECT to include Client roles
DROP POLICY IF EXISTS "Users can view payroll batches of their companies" ON public.payroll_batches;
CREATE POLICY "Users can view payroll batches of their companies"
ON public.payroll_batches
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role) 
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role) 
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
  OR has_role(auth.uid(), 'Client_Admin'::app_role)
  OR has_role(auth.uid(), 'Client_HR'::app_role)
  OR has_role(auth.uid(), 'Client_Viewer'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu 
    WHERE cu.user_id = auth.uid() 
    AND cu.company_id = payroll_batches.company_id
  )
);

-- Update RLS policy for payroll_lines SELECT to include Client roles
DROP POLICY IF EXISTS "Users can view payroll lines of their companies" ON public.payroll_lines;
CREATE POLICY "Users can view payroll lines of their companies"
ON public.payroll_lines
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role) 
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role) 
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
  OR has_role(auth.uid(), 'Client_Admin'::app_role)
  OR has_role(auth.uid(), 'Client_HR'::app_role)
  OR has_role(auth.uid(), 'Client_Viewer'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu 
    WHERE cu.user_id = auth.uid() 
    AND cu.company_id = payroll_lines.company_id
  )
);