-- Enable RLS on payslips table (if not already enabled)
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view payslips for their companies" ON public.payslips;
DROP POLICY IF EXISTS "Users can insert payslips for their companies" ON public.payslips;
DROP POLICY IF EXISTS "Users can update payslips for their companies" ON public.payslips;

-- Policy: Allow users to view payslips for companies they have access to
CREATE POLICY "Users can view payslips for their companies"
ON public.payslips
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_users.company_id = payslips.company_id
    AND company_users.user_id = auth.uid()
  )
);

-- Policy: Allow users to insert payslips for companies they have access to
CREATE POLICY "Users can insert payslips for their companies"
ON public.payslips
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_users.company_id = payslips.company_id
    AND company_users.user_id = auth.uid()
  )
);

-- Policy: Allow users to update payslips for companies they have access to
CREATE POLICY "Users can update payslips for their companies"
ON public.payslips
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_users.company_id = payslips.company_id
    AND company_users.user_id = auth.uid()
  )
);