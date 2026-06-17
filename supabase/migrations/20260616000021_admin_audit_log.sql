-- M8: Audit log para ações administrativas em manage-admins
--
-- Registra toda ação sensível executada por super_admins:
--   promote, revoke, create, list-emails
--
-- RLS: super_admins podem SELECT; ninguém pode UPDATE/DELETE via cliente.
-- Retenção: coberta pelo TTL pg_cron se necessário no futuro (baixo volume).

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by UUID NOT NULL,              -- user_id do super_admin que executou
  action      TEXT NOT NULL,               -- 'promote' | 'revoke' | 'create' | 'list-emails'
  target_id   UUID,                        -- user_id alvo (nullable para list-emails)
  target_email TEXT,                       -- email alvo (para facilitate debugging)
  metadata    JSONB,                       -- dados extras (ex: role atribuído)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_performed_by
  ON public.admin_audit_log (performed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON public.admin_audit_log (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_id
  ON public.admin_audit_log (target_id)
  WHERE target_id IS NOT NULL;

-- RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Super admins podem ler todo o log
CREATE POLICY "super_admin_can_read_audit_log"
  ON public.admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Nenhum cliente pode inserir diretamente — somente via Edge Function com service_role
-- (sem policy de INSERT: service_role bypassa RLS por definição)

-- Nenhum cliente pode UPDATE ou DELETE
-- (sem policies de UPDATE/DELETE: acesso bloqueado por padrão com RLS ativo)

COMMENT ON TABLE public.admin_audit_log IS
  'M8: Registro imutável de ações administrativas sensíveis. Apenas leitura via super_admin. Escrita exclusiva via Edge Function manage-admins com service_role key.';
