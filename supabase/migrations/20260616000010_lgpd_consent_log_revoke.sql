-- Migration: 20260616000010_lgpd_consent_log_revoke
-- Objetivo: Adicionar suporte a registro de revogação de consentimento na consent_log
--           para atender LGPD Art. 8 §5 e Art. 18-IX (direito de revogação).
--
-- A tabela consent_log é imutável (sem UPDATE/DELETE via cliente por RLS).
-- A revogação é registrada como um novo registro com consent_type = 'revoked',
-- mantendo o histórico completo: quando consentiu + quando revogou.
--
-- Aplicar via: Supabase Dashboard → SQL Editor → New Query → Run

-- 1. Relaxar a constraint de consent_type para incluir 'revoked'
ALTER TABLE public.consent_log
  DROP CONSTRAINT IF EXISTS consent_log_consent_type_check;

ALTER TABLE public.consent_log
  ADD CONSTRAINT consent_log_consent_type_check
    CHECK (consent_type IN ('privacy_policy', 'health_data', 'revoked'));

-- 2. Índice para buscar revogações eficientemente (ex: "usuário revogou?")
CREATE INDEX IF NOT EXISTS idx_consent_log_user_type
  ON public.consent_log (user_id, consent_type, granted_at DESC);

-- Verificação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'consent_log_consent_type_check'
  ) THEN
    RAISE EXCEPTION 'Constraint consent_log_consent_type_check não encontrada';
  END IF;
  RAISE NOTICE 'Migration 000010 aplicada com sucesso.';
END $$;
