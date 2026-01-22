-- Update vacation_requests SELECT policy to include Client roles
DROP POLICY IF EXISTS "Users can view vacation requests of their companies" ON public.vacation_requests;
CREATE POLICY "Users can view vacation requests of their companies"
ON public.vacation_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role) 
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role) 
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
  OR has_role(auth.uid(), 'Client_Admin'::app_role)
  OR has_role(auth.uid(), 'Client_HR'::app_role)
  OR has_role(auth.uid(), 'Client_Viewer'::app_role)
  OR (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()))
  OR EXISTS (
    SELECT 1 FROM company_users cu 
    WHERE cu.user_id = auth.uid() 
    AND cu.company_id = vacation_requests.company_id
  )
);