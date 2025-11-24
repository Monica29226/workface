-- Create user_company_permissions table for granular per-company permissions
CREATE TABLE IF NOT EXISTS public.user_company_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  permission_level text NOT NULL CHECK (permission_level IN ('Admin', 'Completo', 'Solo lectura')),
  can_manage_employees boolean DEFAULT false,
  can_manage_projects boolean DEFAULT false,
  can_manage_payroll boolean DEFAULT false,
  can_view_reports boolean DEFAULT true,
  can_manage_parameters boolean DEFAULT false,
  project_scope text DEFAULT 'all' CHECK (project_scope IN ('all', 'specific')),
  project_ids uuid[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Enable RLS on user_company_permissions
ALTER TABLE public.user_company_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all permissions
CREATE POLICY "Admins can manage user company permissions"
ON public.user_company_permissions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
);

-- Policy: Users can view their own permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_company_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_company_permissions_user ON public.user_company_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_company_permissions_company ON public.user_company_permissions(company_id);

-- Update trigger for updated_at
CREATE TRIGGER update_user_company_permissions_updated_at
  BEFORE UPDATE ON public.user_company_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();