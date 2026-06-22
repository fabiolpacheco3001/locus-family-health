-- ─────────────────────────────────────────────────────────────────────────────
-- BK-01: Web Push Notifications Infrastructure
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Cria:
--   1. Tabela push_subscriptions — armazena endpoints VAPID por dispositivo/usuário
--   2. Índices de performance
--   3. RLS policies (usuário vê e gerencia apenas suas subscriptions)
--   4. pg_cron jobs para lembretes de medicamentos (5min) e compromissos (diário 8h BRT)
--
-- PRÉ-REQUISITOS no Supabase Dashboard:
--   - pg_cron habilitado (já habilitado desde migration 20260616000019)
--   - pg_net habilitado (já habilitado desde migration 20260327205549)
--
-- SECRETS a configurar em Supabase Dashboard → Edge Functions → Secrets:
--   VAPID_PUBLIC_KEY  = <ver src/lib/pushConfig.ts — não versionar aqui>
--   VAPID_PRIVATE_KEY = <apenas no Supabase Dashboard → Secrets — NUNCA versionar>
--   VAPID_SUBJECT     = mailto:suporte@locustech.com.br
--   CRON_SECRET       = <gere com: openssl rand -hex 32>
--
-- APÓS APLICAR ESTA MIGRATION, execute no SQL Editor do Supabase:
--   ALTER DATABASE postgres SET app.settings.cron_secret = '<mesmo valor do CRON_SECRET acima>';
--   SELECT pg_reload_conf();
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabela push_subscriptions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,                    -- Push service URL (APNs/FCM/Mozilla)
  p256dh      TEXT NOT NULL,                    -- Client public key (base64url)
  auth        TEXT NOT NULL,                    -- Auth secret (base64url)
  user_agent  TEXT,                             -- For debugging (iOS/Android/Desktop)
  is_active   BOOLEAN NOT NULL DEFAULT true,    -- false = expired, 410 from push service
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One subscription per (user, endpoint): upsert on conflict
  CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint)
);

COMMENT ON TABLE public.push_subscriptions IS
  'Armazena endpoints Web Push (VAPID) por dispositivo. '
  'Cada linha representa um dispositivo inscrito para receber push notifications.';

-- ── 2. Índices ────────────────────────────────────────────────────────────────
-- Lookup por user_id (mais comum: enviar para todos os dispositivos de um usuário)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON public.push_subscriptions (user_id)
  WHERE is_active = true;

-- Cleanup de expiradas
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_inactive
  ON public.push_subscriptions (updated_at)
  WHERE is_active = false;

-- ── 3. Updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 4. Permissões de service_role ─────────────────────────────────────────────
GRANT ALL ON public.push_subscriptions TO service_role;

-- ── 5. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas suas próprias subscriptions
DROP POLICY IF EXISTS "User sees own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "User sees own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuário insere subscriptions para si mesmo
DROP POLICY IF EXISTS "User inserts own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "User inserts own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuário atualiza suas próprias subscriptions (ex: marcar is_active = false)
DROP POLICY IF EXISTS "User updates own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "User updates own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuário deleta suas próprias subscriptions (unsubscribe)
DROP POLICY IF EXISTS "User deletes own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "User deletes own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 6. TTL: limpeza de subscriptions inativas (> 30 dias) ────────────────────
SELECT cron.schedule(
  'ttl_push_subscriptions_inactive',
  '0 4 * * 0',  -- Todo domingo às 4h UTC
  $$DELETE FROM public.push_subscriptions WHERE is_active = false AND updated_at < now() - interval '30 days'$$
);

-- ── 7. pg_cron: lembretes de medicamentos a cada 5 minutos ───────────────────
--
-- ATENÇÃO: Substitua <SUPABASE_PROJECT_REF> pelo ID real do projeto
-- (visível em Supabase Dashboard → Settings → General → Reference ID)
-- e <CRON_SECRET> pelo mesmo valor configurado no Supabase Secret.
--
-- Para ativar após configurar os secrets, execute no SQL Editor:
--   SELECT cron.schedule(
--     'send-medication-reminders',
--     '*/5 * * * *',
--     $$SELECT net.http_post(
--       url := 'https://xazlrdwdkafhzwkezfxz.supabase.co/functions/v1/send-medication-reminders',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
--       ),
--       body := '{}'::jsonb
--     )$$
--   );
--
--   SELECT cron.schedule(
--     'send-appointment-reminders',
--     '0 11 * * *',   -- 11h UTC = 8h BRT (América/São_Paulo)
--     $$SELECT net.http_post(
--       url := 'https://xazlrdwdkafhzwkezfxz.supabase.co/functions/v1/send-appointment-reminders',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
--       ),
--       body := '{}'::jsonb
--     )$$
--   );
--
-- Ou use a seção de instruções de ativação em docs/INFRASTRUCTURE.md.
-- ─────────────────────────────────────────────────────────────────────────────
