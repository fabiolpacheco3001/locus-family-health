REVOKE EXECUTE ON FUNCTION public.get_admin_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_clients() TO authenticated;