
-- Fix infinite recursion by creating a security definer function
-- that bypasses RLS when checking company membership

-- Create a function that checks if a user belongs to a specific company
-- This function uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
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

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own and same-company assignments" ON company_users;

-- Create a simpler policy that uses the security definer function
CREATE POLICY "Users can view company assignments"
ON company_users
FOR SELECT
USING (
  -- User can always see their own assignments
  user_id = auth.uid()
  -- OR user is admin/superadmin
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  -- OR user has manager role and belongs to the same company (using security definer function)
  OR (
    public.has_manager_level_role(auth.uid())
    AND public.user_belongs_to_company(auth.uid(), company_id)
  )
);
