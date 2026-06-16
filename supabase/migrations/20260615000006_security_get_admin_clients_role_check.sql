-- Migration: 20260615000006_security_get_admin_clients_role_check
--
-- CRÍTICO: get_admin_clients foi criada diretamente no Supabase Dashboard sem
-- verificação de role. Qualquer usuário autenticado podia chamar
-- supabase.rpc("get_admin_clients") e obter nome, email e dados de assinatura
-- de todos os usuários da plataforma (violação de LGPD Art. 46).
--
-- Esta migration:
--   1. Recria a função com verificação de role (admin ou super_admin)
--   2. Adiciona SET search_path para prevenir schema confusion attacks
--   3. Revoga execução de PUBLIC e garante apenas a authenticated
--      (o check interno bloqueia não-admins antes de retornar qualquer dado)

CREATE OR REPLACE FUNCTION public.get_admin_clients()
RETURNS TABLE (
  user_id        uuid,
  email          text,
  full_name      text,
  created_at     timestamptz,
  status         text,
  plan_type      text,
  next_billing_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Verificação de role: apenas admin e super_admin podem executar esta função.
  -- auth.uid() retorna o UUID do usuário autenticado via JWT — não pode ser
  -- falsificado pelo caller. A query bate no banco real via service_role
  -- (SECURITY DEFINER bypassa RLS), tornando a proteção server-side.
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
    s.next_billing_date
  FROM auth.users u
  LEFT JOIN public.subscriptions s ON u.id = s.user_id
  WHERE u.id NOT IN (
    -- Exclui membros de grupo que NÃO são o dono (donos pagam, membros não)
    SELECT fgm.auth_user_id
    FROM public.family_group_members fgm
    JOIN public.family_groups fg ON fg.id = fgm.group_id
    WHERE fgm.auth_user_id IS NOT NULL
      AND fgm.auth_user_id != fg.created_by
  )
  ORDER BY u.created_at DESC;
END;
$$;

-- Revoga execução de PUBLIC (default herdado) e mantém apenas authenticated.
-- O check de role interno bloqueia não-admins antes de qualquer dado ser lido.
REVOKE ALL ON FUNCTION public.get_admin_clients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_clients() TO authenticated;
