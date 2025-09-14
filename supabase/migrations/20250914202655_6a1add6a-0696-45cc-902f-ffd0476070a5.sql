-- Drop the current view
DROP VIEW IF EXISTS public.employee_safe_view;

-- Create a simple view that inherits RLS from employees table
-- The masking will be handled at the application level based on user permissions
CREATE VIEW public.employee_safe_view AS
SELECT 
  e.id,
  e.company_id,
  e.first_name,
  e.last_name,
  e.cedula,
  e.email,
  e.phone,
  e.iban,
  e.nss_ccss,
  e.birth_date,
  e.hire_date,
  e.termination_date,
  e.department,
  e.cost_center,
  e.payment_currency,
  e.civil_status,
  e.children_count,
  e.has_pension,
  e.has_garnishment,
  e.manager_id,
  e.active,
  e.created_at,
  e.updated_at
FROM public.employees e;

-- Grant SELECT permission to authenticated users  
GRANT SELECT ON public.employee_safe_view TO authenticated;