-- ============================================================
-- Fix 1: subscriptions.credit_card_token — column-level grants
-- ============================================================
-- Problema: a policy de leitura para familiares (Tenant Billing) expõe
-- credit_card_token via SELECT *. Solução: revogar SELECT na tabela e
-- re-conceder apenas nas colunas não-sensíveis. credit_card_token passa
-- a ser acessível apenas via service_role (Edge Functions).
REVOKE SELECT ON public.subscriptions FROM authenticated;
REVOKE SELECT ON public.subscriptions FROM anon;

GRANT SELECT (
  id,
  user_id,
  asaas_customer_id,
  plan_type,
  status,
  trial_end,
  next_billing_date,
  created_at,
  updated_at,
  asaas_subscription_id,
  test_mode,
  asaas_payment_id
) ON public.subscriptions TO authenticated;

-- service_role mantém acesso total (já coberto por GRANT ALL anterior, reforço idempotente)
GRANT ALL ON public.subscriptions TO service_role;

-- ============================================================
-- Fix 2: admin_audit_log — bloquear INSERT direto de authenticated
-- ============================================================
-- Gravações legítimas vêm exclusivamente de Edge Functions via service_role,
-- que bypassa RLS. Esta policy torna explícito que nenhum usuário autenticado
-- pode inserir registros forjados no log de auditoria.
DROP POLICY IF EXISTS "Block direct insert on admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "Block direct insert on admin_audit_log"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- ============================================================
-- Fix 3: passkeys — bloquear INSERT direto de authenticated
-- ============================================================
-- Registro de passkeys ocorre via Edge Function webauthn-register (service_role).
-- Esta policy torna explícito que nenhum cliente pode inserir passkeys diretamente.
DROP POLICY IF EXISTS "Block direct insert on passkeys" ON public.passkeys;
CREATE POLICY "Block direct insert on passkeys"
ON public.passkeys
FOR INSERT
TO authenticated
WITH CHECK (false);