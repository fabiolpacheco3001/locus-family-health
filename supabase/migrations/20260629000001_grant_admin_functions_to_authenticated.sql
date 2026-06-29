-- Migration: Grant EXECUTE on admin RPC functions to authenticated role
-- Rationale: PostgREST requires explicit EXECUTE grants for the 'authenticated' role
-- to call functions via supabase.rpc(). Without this, the RPC returns permission denied
-- even though the functions have internal RBAC (check user_roles before returning data).
-- Security: granting to 'authenticated' is safe — non-admin users are rejected by the
-- RBAC check inside each function (RAISE EXCEPTION 'insufficient_privilege').

GRANT EXECUTE ON FUNCTION public.get_admin_clients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_test_mode(uuid, boolean) TO authenticated;
