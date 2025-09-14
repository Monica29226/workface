-- Remove the employee_safe_view that's causing security definer issues
-- The employees table already has proper RLS policies for the same security controls
DROP VIEW IF EXISTS public.employee_safe_view;