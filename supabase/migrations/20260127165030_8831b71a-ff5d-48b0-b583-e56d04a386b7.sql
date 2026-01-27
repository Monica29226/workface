
-- Allow authenticated users to create new companies
-- This is needed for the "Create Company" workflow
CREATE POLICY "Authenticated users can create companies"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users with Client_Admin or ACL_SuperAdmin role to manage their companies
CREATE POLICY "Client admins can manage their companies"
ON companies
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR (
    public.has_role(auth.uid(), 'Client_Admin'::app_role)
    AND public.user_belongs_to_company(auth.uid(), id)
  )
);

-- Also need to ensure company_users INSERT works for the creating user
-- Allow authenticated users to assign themselves to a company they just created
CREATE POLICY "Users can assign themselves to companies"
ON company_users
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
);
