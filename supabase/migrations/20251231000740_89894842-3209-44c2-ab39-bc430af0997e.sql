-- Fix: Drop the security definer view and use a regular view
-- The view should rely on RLS of the underlying employees table
DROP VIEW IF EXISTS public.employee_safe_view;

-- Create a simple view that uses the can_access_salary_data function
-- This view will inherit RLS from the employees table
CREATE VIEW public.employee_safe_view 
WITH (security_invoker = true) AS
SELECT 
  e.id,
  e.employee_id,
  e.full_name,
  e.work_email,
  e.company_id,
  e.hire_date,
  e.contract_type,
  e.currency,
  e.status,
  e.user_id,
  e.cost_center_id,
  e.vac_balance_days,
  e.aguinaldo_base_12m,
  e.created_at,
  e.updated_at,
  CASE 
    WHEN public.can_access_salary_data(auth.uid()) 
      OR e.user_id = auth.uid()
    THEN e.base_salary 
    ELSE NULL 
  END as base_salary,
  CASE 
    WHEN public.can_access_salary_data(auth.uid()) 
      OR e.user_id = auth.uid()
    THEN e.hourly_rate 
    ELSE NULL 
  END as hourly_rate
FROM public.employees e;