-- PHASE 1: Security Fixes

-- Create function to check if user can access salary data
CREATE OR REPLACE FUNCTION public.can_access_salary_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'ACL_SuperAdmin')
    OR public.has_role(_user_id, 'ACL_PayrollSpecialist')
$$;

-- Create secure view for employees that masks sensitive data
CREATE OR REPLACE VIEW public.employee_safe_view AS
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

-- PHASE 2: User Invitations Table
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  invited_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Enable RLS on user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_invitations
CREATE POLICY "Admins can manage all invitations"
ON public.user_invitations
FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'ACL_SuperAdmin'));

CREATE POLICY "Company managers can view their company invitations"
ON public.user_invitations
FOR SELECT
USING (
  public.has_role(auth.uid(), 'company_manager') 
  AND public.has_company_access(auth.uid(), company_id)
);

CREATE POLICY "Company managers can create invitations for their company"
ON public.user_invitations
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'company_manager') 
  AND public.has_company_access(auth.uid(), company_id)
);

-- PHASE 3: Vacation Requests Table
CREATE TABLE public.vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested NUMERIC NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on vacation_requests
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vacation_requests
CREATE POLICY "Employees can view their own vacation requests"
ON public.vacation_requests
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Employees can create their own vacation requests"
ON public.vacation_requests
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Employees can cancel their own pending vacation requests"
ON public.vacation_requests
FOR UPDATE
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
  AND status = 'pending'
);

CREATE POLICY "Admins and managers can manage vacation requests"
ON public.vacation_requests
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'ACL_SuperAdmin')
  OR (
    public.has_role(auth.uid(), 'company_manager')
    AND public.has_company_access(auth.uid(), company_id)
  )
);

-- Create trigger for updated_at on vacation_requests
CREATE TRIGGER update_vacation_requests_updated_at
BEFORE UPDATE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();