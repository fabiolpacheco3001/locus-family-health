DROP FUNCTION IF EXISTS public.get_admin_clients();

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
    WHERE id   = auth.uid()
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
  WHERE u.id NOT IN (
    SELECT fgm.auth_user_id
    FROM public.family_group_members fgm
    JOIN public.family_groups fg ON fg.id = fgm.group_id
    WHERE fgm.auth_user_id IS NOT NULL
      AND fgm.auth_user_id != fg.created_by
  )
  ORDER BY u.created_at DESC;
END;
$function$;