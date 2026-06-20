-- ─────────────────────────────────────────────────────────────────────────────
-- RX-32 · cron_job_log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cron_job_log (
  id            BIGSERIAL PRIMARY KEY,
  job_name      TEXT NOT NULL,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  detail        TEXT,
  rows_affected INT
);

CREATE INDEX IF NOT EXISTS idx_cron_job_log_job_name_ran_at
  ON public.cron_job_log (job_name, ran_at DESC);

GRANT ALL ON public.cron_job_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cron_job_log_id_seq TO service_role;

ALTER TABLE public.cron_job_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No user access" ON public.cron_job_log
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- TTL automático: limpar logs com mais de 30 dias (3h da manhã)
SELECT cron.schedule(
  'cleanup-cron-job-log',
  '0 3 * * *',
  $$DELETE FROM public.cron_job_log WHERE ran_at < NOW() - INTERVAL '30 days'$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RX-33 · renewal_failures
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.renewal_failures (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT,
  failed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason          TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '4 hours',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'resolved', 'exhausted')),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_renewal_failures_pending
  ON public.renewal_failures (next_retry_at)
  WHERE status = 'pending';

GRANT ALL ON public.renewal_failures TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.renewal_failures_id_seq TO service_role;

ALTER TABLE public.renewal_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No user access" ON public.renewal_failures
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- Agenda retry a cada 4 horas
SELECT cron.schedule(
  'retry-renewal-failures',
  '0 */4 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_functions_url', true) || '/retry-renewal-failures',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  )$$
);
