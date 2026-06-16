-- Migration: 20260616000009_lgpd_consent_log
--
-- LGPD Art. 7 + Art. 11 — Registro de consentimento para tratamento de dados
-- pessoais de saúde. Toda conta criada no Locus Vita deve ter um registro nesta
-- tabela confirmando que o titular consentiu com a Política de Privacidade.
--
-- Campos:
--   user_id       → titular dos dados (ON DELETE CASCADE — remove junto com a conta)
--   consent_type  → tipo de consentimento ('privacy_policy', 'health_data')
--   policy_version → versão da política aceita (semver string, ex: '1.0')
--   user_agent    → navegador/dispositivo no momento do aceite (max 500 chars)
--   granted_at    → timestamp com fuso UTC do aceite

CREATE TABLE IF NOT EXISTS public.consent_log (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type   text        NOT NULL CHECK (consent_type IN ('privacy_policy', 'health_data')),
  policy_version text        NOT NULL DEFAULT '1.0',
  user_agent     text        CHECK (char_length(user_agent) <= 500),
  granted_at     timestamptz NOT NULL DEFAULT now()
);

-- Índice para consulta dos próprios consentimentos e para auditoria
CREATE INDEX IF NOT EXISTS idx_consent_log_user_id
  ON public.consent_log (user_id, granted_at DESC);

-- RLS
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

-- Usuários podem ler apenas seus próprios registros de consentimento
CREATE POLICY "consent_log_select_own"
  ON public.consent_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Usuários podem inserir apenas consentimentos com seu próprio user_id
-- (o INSERT ocorre logo após o signUp, enquanto a sessão está ativa)
CREATE POLICY "consent_log_insert_own"
  ON public.consent_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Ninguém pode atualizar ou deletar registros de consentimento via cliente
-- (deleção ocorre via cascade quando a conta é excluída — delete-user-account)
-- Sem políticas UPDATE e DELETE = nenhum acesso por padrão (RLS nega)

COMMENT ON TABLE public.consent_log IS
  'LGPD Art. 7/11 — Registro auditável de consentimentos dos titulares. '
  'Imutável via cliente: apenas leitura própria e inserção no momento do cadastro. '
  'Deleção ocorre via CASCADE ao excluir a conta (delete-user-account Edge Function).';
