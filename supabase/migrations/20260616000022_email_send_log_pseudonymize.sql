-- M13: Pseudonimização de recipient_email em email_send_log (LGPD)
--
-- Estratégia:
--   1. Adicionar coluna recipient_email_hash TEXT (SHA-256 + salt via Edge Function)
--   2. Tornar recipient_email nullable (será NULLado após 24h)
--   3. pg_cron job que anonimiza registros com > 24h mantendo apenas o hash
--
-- Após a migration:
--   - Inserts: Edge Function grava recipient_email + recipient_email_hash simultaneamente
--   - Após 24h: pg_cron NULL-a recipient_email; apenas hash fica permanente
--   - Análise posterior: usa recipient_email_hash (pseudônimo consistente por salt)
--
-- Secret necessário: EMAIL_HASH_SALT no Supabase Dashboard
--   Supabase Dashboard → Edge Functions → Secrets → Adicionar EMAIL_HASH_SALT=<random_string>

-- 1. Adicionar coluna de hash
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS recipient_email_hash TEXT;

-- 2. Tornar recipient_email nullable (será NULLado após 24h)
ALTER TABLE public.email_send_log
  ALTER COLUMN recipient_email DROP NOT NULL;

-- 3. Índice para o job de anonimização (WHERE recipient_email IS NOT NULL AND created_at < ...)
CREATE INDEX IF NOT EXISTS idx_email_send_log_anonymize
  ON public.email_send_log (created_at)
  WHERE recipient_email IS NOT NULL;

-- 4. pg_cron job: anonimiza registros com > 24h — roda a cada hora
SELECT cron.schedule(
  'anonymize_email_send_log',
  '0 * * * *',  -- A cada hora (00 de cada hora UTC)
  $$UPDATE public.email_send_log
    SET recipient_email = NULL
    WHERE recipient_email IS NOT NULL
      AND created_at < now() - interval '24 hours'$$
);

COMMENT ON COLUMN public.email_send_log.recipient_email IS
  'M13 LGPD: Email completo mantido por 24h; NULLado por pg_cron após esse prazo. Usar recipient_email_hash para análises posteriores.';

COMMENT ON COLUMN public.email_send_log.recipient_email_hash IS
  'M13 LGPD: SHA-256(email_normalizado + EMAIL_HASH_SALT). Pseudônimo permanente para correlação de logs sem expor o email real.';
