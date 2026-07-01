DROP FUNCTION IF EXISTS public.admin_delete_identity(uuid, uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_identity(
  p_user_id UUID,
  p_identity_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities
    WHERE (id::text = p_identity_id OR provider_id = p_identity_id)
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'identity_not_found';
  END IF;

  DELETE FROM auth.identities
  WHERE (id::text = p_identity_id OR provider_id = p_identity_id)
    AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_identity(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_identity(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_identity(UUID, TEXT) TO service_role;