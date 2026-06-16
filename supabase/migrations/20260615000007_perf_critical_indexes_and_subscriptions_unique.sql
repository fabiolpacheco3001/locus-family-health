-- Migration: 20260615000007_perf_critical_indexes_and_subscriptions_unique
--
-- CRÍTICO — C4: family_group_members sem índice em auth_user_id e group_id
--   Toda query autenticada que acessa tabelas clínicas executa:
--   EXISTS (SELECT 1 FROM family_group_members WHERE auth_user_id = auth.uid() ...)
--   Sem índice = full scan em TODA verificação de RLS group-aware.
--
-- CRÍTICO — C5: subscriptions sem UNIQUE constraint em user_id
--   O asaas-webhook faz upsert com onConflict="user_id". Sem UNIQUE constraint,
--   o PostgreSQL não resolve o conflito → risco de linhas duplicadas.
--
-- ALTO — A10: subscriptions sem índice em user_id e asaas_customer_id
--   - user_id: toda verificação de assinatura ativa (useSubscription) faz full scan
--   - asaas_customer_id: webhook fallback faz full scan a cada evento do Asaas

-- ============================================================
-- 1. family_group_members — índices nas colunas de RLS (C4)
-- ============================================================

-- Índice em auth_user_id: usado em TODAS as RLS policies group-aware
-- (medications, consultations, exams, vaccines, diseases, notifications...)
CREATE INDEX IF NOT EXISTS idx_family_group_members_auth_user_id
  ON public.family_group_members (auth_user_id);

-- Índice em group_id: usado em joins de group-aware queries e RLS de grupos
CREATE INDEX IF NOT EXISTS idx_family_group_members_group_id
  ON public.family_group_members (group_id);

-- Índice composto (auth_user_id, group_id): cobre o EXISTS do RLS em uma única
-- busca de índice sem heap fetch na maioria dos casos
CREATE INDEX IF NOT EXISTS idx_family_group_members_auth_user_group
  ON public.family_group_members (auth_user_id, group_id);

-- ============================================================
-- 2. subscriptions — UNIQUE constraint + índices (C5 + A10)
-- ============================================================

-- UNIQUE constraint em user_id: necessária para que o upsert do asaas-webhook
-- com onConflict="user_id" funcione corretamente e não insira duplicatas.
-- Nota: se houver duplicatas existentes, esta migration falhará.
-- Nesse caso, limpar duplicatas primeiro:
--   DELETE FROM subscriptions a USING subscriptions b
--   WHERE a.id > b.id AND a.user_id = b.user_id;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);

-- Índice em user_id: cobre toda verificação de assinatura ativa (useSubscription)
-- O UNIQUE constraint acima cria um índice implícito — esta linha é redundante
-- mas deixada como documentação. O PostgreSQL não criará duplicata se
-- o constraint já existir com o mesmo nome de coluna.
-- CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
--   ON public.subscriptions (user_id);

-- Índice em asaas_customer_id (sem condição parcial — precisa buscar por qualquer status)
-- Cobre o fallback do webhook: WHERE asaas_customer_id = $1
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_customer_id
  ON public.subscriptions (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;

-- Índice parcial para verificações de assinatura ativa (caso de uso mais frequente)
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_user
  ON public.subscriptions (user_id)
  WHERE status = 'active';
