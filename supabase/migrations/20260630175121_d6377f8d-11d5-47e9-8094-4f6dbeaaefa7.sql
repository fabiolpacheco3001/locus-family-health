-- Fix A: surgeries UPDATE/DELETE ownership check
DROP POLICY IF EXISTS "Group members can update surgeries" ON public.surgeries;
DROP POLICY IF EXISTS "Group members can delete surgeries" ON public.surgeries;

CREATE POLICY "Owners and admins can update surgeries" ON public.surgeries
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.is_group_admin((select auth.uid()), group_id)
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR public.is_group_admin((select auth.uid()), group_id)
  );

CREATE POLICY "Owners and admins can delete surgeries" ON public.surgeries
  FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.is_group_admin((select auth.uid()), group_id)
  );

-- Fix B: revoke PGMQ wrappers from public roles
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, int, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;

-- Defense in depth: revoke anon from RLS helpers
REVOKE EXECUTE ON FUNCTION public.check_group_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM anon;