
-- 1. audit_log: restrict INSERT to service_role
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2. email_logs: restrict INSERT/UPDATE to service_role
DROP POLICY IF EXISTS "System can insert email logs" ON public.email_logs;
DROP POLICY IF EXISTS "System can update email logs" ON public.email_logs;
CREATE POLICY "Service role can insert email logs"
  ON public.email_logs FOR INSERT
  TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update email logs"
  ON public.email_logs FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- 3. payroll_line_changes: restrict INSERT to service_role, expand SELECT
DROP POLICY IF EXISTS "System can insert payroll line changes" ON public.payroll_line_changes;
DROP POLICY IF EXISTS "Admins and managers can view payroll line changes" ON public.payroll_line_changes;
CREATE POLICY "Service role can insert payroll line changes"
  ON public.payroll_line_changes FOR INSERT
  TO service_role
  WITH CHECK (true);
CREATE POLICY "Authorized users can view payroll line changes"
  ON public.payroll_line_changes FOR SELECT
  TO authenticated
  USING (
    public.has_admin_level_role(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.payroll_lines pl
      WHERE pl.id = payroll_line_changes.payroll_line_id
        AND public.user_belongs_to_company(auth.uid(), pl.company_id)
    )
  );

-- 4. company_users: prevent privilege escalation via self-assignment
DROP POLICY IF EXISTS "Users can assign themselves to companies" ON public.company_users;
CREATE POLICY "Users can self-assign as manager when creating a company"
  ON public.company_users FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_admin_level_role(auth.uid())
    OR (
      user_id = auth.uid()
      AND role = 'company_manager'::app_role
      AND NOT EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.company_id = company_users.company_id
      )
    )
  );

-- 5. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- Policies invoke these as the table owner, so RLS keeps working.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_company(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_admin_level_role(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_manager_level_role(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_client_access_role(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_salary_data(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
