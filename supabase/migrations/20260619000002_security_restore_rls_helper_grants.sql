-- =============================================================================
-- Rollback: Restaurar EXECUTE em helpers RLS para authenticated
-- Sessão 24 (19/06/2026)
--
-- Contexto:
--   Migration 000003 revogou EXECUTE de authenticated nas 4 helpers RLS.
--   Isso causou "permission denied for function" em qualquer query em tabelas
--   cujas RLS policies invocam essas funções (ex: group_invites, family_group_members).
--
-- Causa raiz confirmada:
--   PostgreSQL exige que o role do caller tenha EXECUTE na função invocada dentro
--   de uma RLS policy, MESMO que a função seja SECURITY DEFINER. O SECURITY DEFINER
--   controla o contexto de execução interno da função, não a permissão de invocação.
--   Referência: documentação Supabase de RLS helpers (has_role pattern).
--
-- Decisão arquitetural (definitiva):
--   Helpers RLS SECURITY DEFINER que retornam apenas boolean (true/false) SEM PII
--   DEVEM ter EXECUTE para authenticated. O risco real é baixo:
--   - Apenas revelam "usuário é membro do grupo X?" — informação já implícita nas policies
--   - Não aceitam input arbitrário, não fazem mutação, não retornam dados sensíveis
--   - É o padrão oficial recomendado pela documentação Supabase
--   O WARN do linter para essas 4 funções é ACEITO e marcado como falso-positivo.
--
-- Funções afetadas:
--   is_super_admin(uuid)        — verifica role de plataforma
--   is_group_admin(uuid, uuid)  — verifica admin do grupo familiar
--   is_group_member(uuid, uuid) — verifica membro do grupo familiar
--   check_group_access(uuid)    — verifica acesso via auth.uid()
-- =============================================================================

-- Restaurar EXECUTE para authenticated nas 4 helpers RLS
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_group_access(uuid)    TO authenticated;

-- service_role mantém EXECUTE (já garantido pelas migrations anteriores)
-- anon continua sem EXECUTE (REVOKE mantido das migrations 000002 e 000003)

-- Nota: O linter voltará a marcar estas 4 funções como WARN.
-- Isso é esperado e aceito — registrar como ignore no scanner com justificativa acima.
