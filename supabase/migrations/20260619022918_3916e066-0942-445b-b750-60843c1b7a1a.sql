CREATE OR REPLACE FUNCTION public.set_user_test_mode(target_user_id uuid, enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: admin or super_admin role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.subscriptions
  SET test_mode = enabled, updated_at = now()
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (user_id, plan_type, status, test_mode)
    VALUES (target_user_id, 'monthly', 'trialing', enabled);
  END IF;

  RETURN enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_test_mode(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_test_mode(uuid, boolean) TO authenticated;