-- A12 + M11: TTL automático via pg_cron
--
-- Jobs criados:
--   ttl_medication_doses   → deleta doses com scheduled_for < agora - 2 anos  (domingos 3h UTC)
--   ttl_notifications_read → deleta notificações lidas com > 30 dias           (diário 2h UTC)
--   ttl_ai_usage_logs      → deleta logs de IA com > 90 dias                   (segundas 2h UTC)
--   ttl_email_send_log     → deleta logs de e-mail com > 90 dias               (segundas 2:30h UTC)
--
-- PRÉ-REQUISITO: pg_cron deve estar habilitado no projeto.
--   Se esta migration falhar, habilite primeiro em:
--   Supabase Dashboard → Database → Extensions → pg_cron → Enable
--   Depois re-execute via SQL Editor.
--
-- NOTA: pg_cron roda como superuser (postgres), contornando RLS —
--   isso é intencional para operações de manutenção de dados.

-- 1. Habilitar extensão pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. medication_doses — retenção de 2 anos
-- Garante que dados históricos de aderência recentes fiquem disponíveis
-- sem deixar a tabela crescer indefinidamente (~5M rows/ano com 1k usuários)
SELECT cron.schedule(
  'ttl_medication_doses',
  '0 3 * * 0',  -- Todo domingo às 3h UTC
  $$DELETE FROM public.medication_doses WHERE scheduled_for < now() - interval '2 years'$$
);

-- 3. notifications — retenção de 30 dias para lidas
-- Não lidas são mantidas indefinidamente (usuário ainda não viu)
SELECT cron.schedule(
  'ttl_notifications_read',
  '0 2 * * *',  -- Diariamente às 2h UTC
  $$DELETE FROM public.notifications WHERE is_read = true AND created_at < now() - interval '30 days'$$
);

-- 4. ai_usage_logs — retenção de 90 dias
-- Suficiente para auditoria de rate limiting e análise de uso
SELECT cron.schedule(
  'ttl_ai_usage_logs',
  '0 2 * * 1',  -- Toda segunda às 2h UTC
  $$DELETE FROM public.ai_usage_logs WHERE created_at < now() - interval '90 days'$$
);

-- 5. email_send_log — retenção de 90 dias
SELECT cron.schedule(
  'ttl_email_send_log',
  '30 2 * * 1',  -- Toda segunda às 2:30h UTC
  $$DELETE FROM public.email_send_log WHERE created_at < now() - interval '90 days'$$
);
