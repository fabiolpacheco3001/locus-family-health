-- Security fix: check_group_access function — NULL safety + unauthenticated access
--
-- Vulnerability (Warning — Lovable scanner):
--   The check_group_access(_group_id) function may silently return TRUE when
--   _group_id is NULL (depending on implementation), allowing unauthenticated
--   or unauthorized users to pass RBAC SELECT policies that rely on it.
--
-- Fix:
--   1. Redefine check_group_access with explicit NULL guard: return FALSE immediately
--      when _group_id IS NULL.
--   2. Add auth.uid() IS NOT NULL guard: unauthenticated callers always get FALSE.
--   3. Mark SECURITY DEFINER + fixed search_path (prevents search_path injection).
--
-- Note: policies that previously used check_group_access have largely been replaced
--   by explicit group-aware policies in earlier migrations (20260328*). This fix
--   ensures any remaining or future usage of check_group_access is safe.

CREATE OR REPLACE FUNCTION public.check_group_access(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Guard: unauthenticated callers and NULL group_id always return FALSE
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN _group_id IS NULL  THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.family_group_members
        WHERE auth_user_id = auth.uid()
          AND group_id     = _group_id
      )
    END;
$$;
