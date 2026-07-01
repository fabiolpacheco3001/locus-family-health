CREATE OR REPLACE FUNCTION public.admin_delete_identity(
  p_user_id UUID,
  p_identity_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities
    WHERE id = p_identity_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'identity_not_found';
  END IF;

  DELETE FROM auth.identities
  WHERE id = p_identity_id
    AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_identity(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_identity(UUID, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_identity(UUID, UUID) TO service_role;