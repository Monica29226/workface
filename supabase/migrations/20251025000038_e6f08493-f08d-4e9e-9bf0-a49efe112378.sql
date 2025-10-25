-- ACL Payroll CR - Políticas RLS adicionales para tablas faltantes

-- ============================================================================
-- POLÍTICAS PARA USER_ROLES
-- ============================================================================

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- POLÍTICAS PARA COMPANY_USERS
-- ============================================================================

CREATE POLICY "Users can view their company assignments"
  ON public.company_users FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all company user assignments"
  ON public.company_users FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company managers can view their company assignments"
  ON public.company_users FOR SELECT
  USING (
    public.has_role(auth.uid(), 'company_manager') AND
    public.has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Admins can manage company user assignments"
  ON public.company_users FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- POLÍTICAS PARA PROJECTS
-- ============================================================================

CREATE POLICY "Admins can view all projects"
  ON public.projects FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company managers can view their company projects"
  ON public.projects FOR SELECT
  USING (
    public.has_role(auth.uid(), 'company_manager') AND
    public.has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Employees can view projects for their company"
  ON public.projects FOR SELECT
  USING (
    public.has_role(auth.uid(), 'employee') AND
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can manage projects"
  ON public.projects FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'company_manager') AND public.has_company_access(auth.uid(), company_id))
  );

-- ============================================================================
-- POLÍTICAS PARA PAYROLL_LINES
-- ============================================================================

CREATE POLICY "Admins can view all payroll lines"
  ON public.payroll_lines FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Company managers can view their company payroll lines"
  ON public.payroll_lines FOR SELECT
  USING (
    public.has_role(auth.uid(), 'company_manager') AND
    public.has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Employees can view their own payroll lines"
  ON public.payroll_lines FOR SELECT
  USING (
    public.has_role(auth.uid(), 'employee') AND
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins and managers can manage payroll lines"
  ON public.payroll_lines FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'company_manager') AND public.has_company_access(auth.uid(), company_id))
  );