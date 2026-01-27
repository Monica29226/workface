
-- Fix circular dependency in company_users RLS policy
-- Drop the problematic policy and replace with a simpler, non-circular one

-- First, drop the policy that has circular dependency
DROP POLICY IF EXISTS "Company managers and clients can view their company assignments" ON company_users;

-- Create a simpler policy that allows users to see their own assignments
-- This policy only uses user_id = auth.uid() without calling has_company_access
CREATE POLICY "Users can view own and same-company assignments"
ON company_users
FOR SELECT
USING (
  -- User can always see their own assignment
  user_id = auth.uid()
  -- OR user is admin/superadmin (no circular dependency)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  -- OR user has a client/manager role and is in the same company (direct EXISTS check, no function call)
  OR (
    (
      public.has_role(auth.uid(), 'Client_Admin'::app_role)
      OR public.has_role(auth.uid(), 'Client_HR'::app_role)
      OR public.has_role(auth.uid(), 'company_manager'::app_role)
      OR public.has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
    )
    AND EXISTS (
      SELECT 1 FROM company_users cu2 
      WHERE cu2.user_id = auth.uid() 
      AND cu2.company_id = company_users.company_id
    )
  )
);
