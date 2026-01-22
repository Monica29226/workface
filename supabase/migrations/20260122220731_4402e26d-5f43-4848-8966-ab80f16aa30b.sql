
-- =============================================================================
-- FIX: Extend simplified RLS policies to payroll tables for Client roles
-- Uses direct EXISTS pattern to avoid circular dependency issues
-- =============================================================================

-- ============= PAYROLL_LINES =============
DROP POLICY IF EXISTS "Company managers can view their company payroll lines" ON payroll_lines;
DROP POLICY IF EXISTS "Admins and managers can manage payroll lines" ON payroll_lines;

-- SELECT policy for all users with company access
CREATE POLICY "Users can view payroll lines of their companies"
ON payroll_lines FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
  OR (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()))
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() AND cu.company_id = payroll_lines.company_id
  )
);

-- Management policy for admins and managers
CREATE POLICY "Admins and managers can manage payroll lines"
ON payroll_lines FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() 
      AND cu.company_id = payroll_lines.company_id
      AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
  )
);

-- ============= PAYROLL_BATCHES =============
DROP POLICY IF EXISTS "Users can view payroll batches for their company" ON payroll_batches;
DROP POLICY IF EXISTS "Admins and managers can manage payroll batches" ON payroll_batches;

-- SELECT policy
CREATE POLICY "Users can view payroll batches of their companies"
ON payroll_batches FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() AND cu.company_id = payroll_batches.company_id
  )
);

-- Management policy
CREATE POLICY "Admins and managers can manage payroll batches"
ON payroll_batches FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() 
      AND cu.company_id = payroll_batches.company_id
      AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
  )
);

-- ============= PROJECTS =============
DROP POLICY IF EXISTS "Company managers can view their company projects" ON projects;
DROP POLICY IF EXISTS "Admins and managers can manage projects" ON projects;

-- SELECT policy
CREATE POLICY "Users can view projects of their companies"
ON projects FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR has_role(auth.uid(), 'ACL_PayrollSpecialist'::app_role)
  OR has_role(auth.uid(), 'ACL_Auditor'::app_role)
  OR (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() AND cu.company_id = projects.company_id
  )
);

-- Management policy
CREATE POLICY "Admins and managers can manage projects"
ON projects FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() 
      AND cu.company_id = projects.company_id
      AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
  )
);

-- ============= VACATION_REQUESTS =============
DROP POLICY IF EXISTS "Admins and managers can manage vacation requests" ON vacation_requests;

CREATE POLICY "Admins and managers can manage vacation requests"
ON vacation_requests FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() 
      AND cu.company_id = vacation_requests.company_id
      AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
  )
);

-- ============= EMPLOYEE_VACATIONS =============
DROP POLICY IF EXISTS "Admins and managers can manage employee vacations" ON employee_vacations;

CREATE POLICY "Admins and managers can manage employee vacations"
ON employee_vacations FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() 
      AND cu.company_id = employee_vacations.company_id
      AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
  )
);

-- ============= COST_CENTERS =============
DROP POLICY IF EXISTS "Users can view their company cost centers" ON cost_centers;
DROP POLICY IF EXISTS "Admins and managers can manage cost centers" ON cost_centers;

CREATE POLICY "Users can view cost centers of their companies"
ON cost_centers FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() AND cu.company_id = cost_centers.company_id
  )
);

CREATE POLICY "Admins and managers can manage cost centers"
ON cost_centers FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() 
      AND cu.company_id = cost_centers.company_id
      AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
  )
);

-- ============= COMPANY_PARAMETERS =============
DROP POLICY IF EXISTS "Users can view their company parameters" ON company_parameters;
DROP POLICY IF EXISTS "Admins can manage company parameters" ON company_parameters;

CREATE POLICY "Users can view parameters of their companies"
ON company_parameters FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() AND cu.company_id = company_parameters.company_id
  )
);

CREATE POLICY "Admins and managers can manage company parameters"
ON company_parameters FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
  OR EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid() 
      AND cu.company_id = company_parameters.company_id
      AND cu.role IN ('company_manager', 'Client_Admin')
  )
);
