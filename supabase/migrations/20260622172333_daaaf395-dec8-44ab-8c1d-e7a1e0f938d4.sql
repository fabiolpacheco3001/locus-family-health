
REVOKE ALL ON FUNCTION public.cascade_soft_delete_family_member() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cascade_soft_delete_family_member() TO service_role;
