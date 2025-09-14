-- Enable Row Level Security on employee_safe_view
ALTER VIEW public.employee_safe_view SET (security_barrier = true);

-- Create RLS policies for employee_safe_view to match employees table security
CREATE POLICY "HR and Payroll can view all employees via safe view" 
ON public.employee_safe_view 
FOR SELECT 
USING (company_id IN (
  SELECT company_users.company_id
  FROM company_users
  WHERE company_users.user_id = auth.uid() 
  AND company_users.active = true 
  AND company_users.role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
));

CREATE POLICY "Managers can view their supervised employees via safe view" 
ON public.employee_safe_view 
FOR SELECT 
USING (
  manager_id = auth.uid() 
  AND company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid() 
    AND company_users.active = true 
    AND company_users.role::text = 'Manager'
  )
);

CREATE POLICY "Employees can view their own profile via safe view" 
ON public.employee_safe_view 
FOR SELECT 
USING (
  id = auth.uid()
  AND company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid() 
    AND company_users.active = true 
    AND company_users.role::text NOT IN ('Owner', 'Admin', 'Payroll', 'Manager')
  )
);