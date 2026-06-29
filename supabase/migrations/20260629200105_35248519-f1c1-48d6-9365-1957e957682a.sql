-- Optimize get_admin_clients and add admin_set_user_trial RPC

CREATE OR REPLACE FUNCTION public.get_admin_clients()
 RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamp with time zone, status text, plan_type text, next_billing_date text, test_mode boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: admin or super_admin role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    u.id                                        AS user_id,
    u.email::text,
    (u.raw_user_meta_data->>'full_name')::text  AS full_name,
    u.created_at,
    s.status,
    s.plan_type,
    s.next_billing_date::text,
    COALESCE(s.test_mode, false)                AS test_mode
  FROM auth.users u
  LEFT JOIN public.subscriptions s ON u.id = s.user_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.family_group_members fgm
    JOIN public.family_groups fg ON fg.id = fgm.group_id
    WHERE fgm.auth_user_id = u.id
      AND fgm.auth_user_id IS NOT NULL
      AND fgm.auth_user_id <> fg.created_by
  )
  ORDER BY u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_trial(target_user_id uuid, days_remaining integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_trial_end timestamptz := now() + make_interval(days => days_remaining);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = (select auth.uid())
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: admin or super_admin role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.subscriptions (user_id, plan_type, status, trial_end, next_billing_date)
  VALUES (target_user_id, 'trial', 'trialing', v_trial_end, v_trial_end)
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'trialing',
        plan_type = 'trial',
        trial_end = EXCLUDED.trial_end,
        updated_at = now();

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_trial(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_trial(uuid, integer) TO authenticated;