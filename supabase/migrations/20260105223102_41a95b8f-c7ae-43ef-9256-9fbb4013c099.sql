-- Create indexes for frequently used queries to improve performance

-- Employees table indexes
CREATE INDEX IF NOT EXISTS idx_employees_company_status ON public.employees(company_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- Payroll batches indexes  
CREATE INDEX IF NOT EXISTS idx_payroll_batches_company_status ON public.payroll_batches(company_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_batches_company_period ON public.payroll_batches(company_id, period_end DESC);

-- Payroll lines indexes
CREATE INDEX IF NOT EXISTS idx_payroll_lines_batch_id ON public.payroll_lines(batch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_employee_id ON public.payroll_lines(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_company_id ON public.payroll_lines(company_id);

-- Vacation requests indexes
CREATE INDEX IF NOT EXISTS idx_vacation_requests_company_status ON public.vacation_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee_id ON public.vacation_requests(employee_id);

-- Payslips indexes
CREATE INDEX IF NOT EXISTS idx_payslips_company_sent ON public.payslips(company_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_payslips_batch_id ON public.payslips(batch_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee_id ON public.payslips(employee_id);

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON public.time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_project ON public.time_entries(employee_id, project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(entry_date);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_company_status ON public.projects(company_id, status);

-- Company users indexes
CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON public.company_users(company_id);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Email logs indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_company_id ON public.email_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);