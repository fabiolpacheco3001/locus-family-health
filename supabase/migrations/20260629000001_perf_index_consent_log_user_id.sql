-- =================================================================
-- ID-012: Índice btree em consent_log.user_id
--
-- Problema: a RLS policy de consent_log faz seq scan em toda a
-- tabela para filtrar por user_id — cresce com cada evento LGPD.
-- Fix: btree index padrão para lookup direto por usuário.
-- =================================================================

CREATE INDEX IF NOT EXISTS idx_consent_log_user_id
  ON public.consent_log (user_id);
