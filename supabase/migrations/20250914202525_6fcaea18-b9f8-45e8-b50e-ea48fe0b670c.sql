-- First, drop the existing view if it exists
DROP VIEW IF EXISTS public.employee_safe_view;

-- Recreate the employee_safe_view with proper security barrier to ensure RLS is enforced
CREATE VIEW public.employee_safe_view WITH (security_barrier = true) AS
SELECT 
  e.id,
  e.company_id,
  e.first_name,
  e.last_name,
  CASE 
    WHEN public.can_access_sensitive_employee_data() THEN e.cedula
    ELSE CONCAT(LEFT(e.cedula, 3), 'XXXXX')
  END as cedula,
  CASE 
    WHEN public.can_access_sensitive_employee_data() THEN e.email
    ELSE CONCAT(LEFT(SPLIT_PART(e.email, '@', 1), 2), 'XXX@', SPLIT_PART(e.email, '@', 2))
  END as email,
  CASE 
    WHEN public.can_access_sensitive_employee_data() THEN e.phone
    ELSE CONCAT(LEFT(e.phone, 4), 'XXXX')
  END as phone,
  CASE 
    WHEN public.can_access_sensitive_employee_data() THEN e.iban
    ELSE 'XXXXXXXXXXXXXXXX'
  END as iban,
  CASE 
    WHEN public.can_access_sensitive_employee_data() THEN e.nss_ccss
    ELSE 'XXXXXXXXX'
  END as nss_ccss,
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