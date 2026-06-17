CREATE OR REPLACE FUNCTION public.user_can_hr_manage_time_off(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role IN ('admin', 'ACL_SuperAdmin', 'ACL_PayrollSpecialist')
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = _user_id
        AND cu.company_id = _company_id
        AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_hr_manage_time_off(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_hr_manage_time_off(uuid, uuid) TO authenticated;
