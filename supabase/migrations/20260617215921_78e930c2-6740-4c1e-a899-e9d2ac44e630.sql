GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_company(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_level_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_manager_level_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_client_access_role(uuid) TO authenticated;