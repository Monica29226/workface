-- Índices de optimización para mejorar rendimiento del Dashboard

-- Índice para búsqueda de empleados por empresa y estado
CREATE INDEX IF NOT EXISTS idx_employees_company_status 
  ON employees(company_id, status);

-- Índice para líneas de planilla por empresa
CREATE INDEX IF NOT EXISTS idx_payroll_lines_company 
  ON payroll_lines(company_id);

-- Índice para búsqueda de planillas por empresa y estado
CREATE INDEX IF NOT EXISTS idx_payroll_batches_company_status 
  ON payroll_batches(company_id, status);

-- Índice para solicitudes de vacaciones por estado y empresa
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status_company 
  ON vacation_requests(status, company_id);

-- Índice para boletas por empresa y estado de envío
CREATE INDEX IF NOT EXISTS idx_payslips_company_sent 
  ON payslips(company_id, sent_at);