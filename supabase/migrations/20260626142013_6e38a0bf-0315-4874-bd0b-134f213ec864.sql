
-- =========================
-- 1) EMPLOYEES: scope role-based view by company membership
-- =========================
DROP POLICY IF EXISTS "Users can view employees of their companies" ON public.employees;
CREATE POLICY "Users can view employees of their companies"
ON public.employees
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR (user_id = auth.uid())
  OR (
    (
      has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
      OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
      OR has_role(auth.uid(), 'Client_Admin'::app_role)
      OR has_role(auth.uid(), 'Client_HR'::app_role)
      OR has_role(auth.uid(), 'Client_Viewer'::app_role)
      OR has_role(auth.uid(), 'company_manager'::app_role)
    )
    AND public.has_company_access(auth.uid(), employees.company_id)
  )
);

-- =========================
-- 2) PAYROLL_BATCHES: scope role-based view by company membership
-- =========================
DROP POLICY IF EXISTS "Users can view payroll batches of their companies" ON public.payroll_batches;
CREATE POLICY "Users can view payroll batches of their companies"
ON public.payroll_batches
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
      OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
      OR has_role(auth.uid(), 'Client_Admin'::app_role)
      OR has_role(auth.uid(), 'Client_HR'::app_role)
      OR has_role(auth.uid(), 'Client_Viewer'::app_role)
      OR has_role(auth.uid(), 'company_manager'::app_role)
    )
    AND public.has_company_access(auth.uid(), payroll_batches.company_id)
  )
);

-- =========================
-- 3) PAYROLL_LINES: scope role-based view by company membership
-- =========================
DROP POLICY IF EXISTS "Users can view payroll lines of their companies" ON public.payroll_lines;
CREATE POLICY "Users can view payroll lines of their companies"
ON public.payroll_lines
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
      OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
      OR has_role(auth.uid(), 'Client_Admin'::app_role)
      OR has_role(auth.uid(), 'Client_HR'::app_role)
      OR has_role(auth.uid(), 'Client_Viewer'::app_role)
      OR has_role(auth.uid(), 'company_manager'::app_role)
    )
    AND public.has_company_access(auth.uid(), payroll_lines.company_id)
  )
);

-- =========================
-- 4) VACATION_REQUESTS: scope role-based view by company membership
-- =========================
DROP POLICY IF EXISTS "Users can view vacation requests of their companies" ON public.vacation_requests;
CREATE POLICY "Users can view vacation requests of their companies"
ON public.vacation_requests
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
  OR (
    (
      has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
      OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
      OR has_role(auth.uid(), 'Client_Admin'::app_role)
      OR has_role(auth.uid(), 'Client_HR'::app_role)
      OR has_role(auth.uid(), 'Client_Viewer'::app_role)
      OR has_role(auth.uid(), 'company_manager'::app_role)
    )
    AND public.has_company_access(auth.uid(), vacation_requests.company_id)
  )
);

-- =========================
-- 5) USER_ROLES: lock down writes to admins; explicit restrictive policies
-- =========================
DROP POLICY IF EXISTS "Admins can manage all user roles" ON public.user_roles;

CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role));

CREATE POLICY "Only admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role));

CREATE POLICY "Only admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role));

CREATE POLICY "Only admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role));

-- =========================
-- 6) AUDIT_LOG: include ACL_SuperAdmin
-- =========================
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
CREATE POLICY "Admins can view all audit logs"
ON public.audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role));

-- =========================
-- 7) EMAIL_TEMPLATES: extend controlled access to Client_Admin/Client_HR with company scope
-- =========================
DROP POLICY IF EXISTS "Users can view templates for their company" ON public.email_templates;
CREATE POLICY "Users can view templates for their company"
ON public.email_templates
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'company_manager'::app_role)
      OR has_role(auth.uid(), 'Client_Admin'::app_role)
      OR has_role(auth.uid(), 'Client_HR'::app_role)
    )
    AND public.has_company_access(auth.uid(), email_templates.company_id)
  )
);

-- =========================
-- 8) Harden SECURITY DEFINER email-queue functions: search_path + revoke public EXECUTE
-- =========================
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
