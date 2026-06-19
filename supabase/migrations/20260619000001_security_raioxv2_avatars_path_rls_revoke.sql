-- =============================================================================
-- Security Fix: RAIO-X v2 — avatars path restriction + REVOKE authenticated de helpers RLS
-- Sessão 24 (19/06/2026)
--
-- Findings addressed:
--   ISSUE-1  avatars bucket: listagem sem path filter → enumeração de UUIDs
--   ISSUE-2..5  is_super_admin, is_group_admin, is_group_member, check_group_access
--               ainda executáveis por authenticated via PostgREST (chamada direta)
--
-- Decisão de produto:
--   - avatars: bucket permanece public=true (URLs diretas continuam funcionando)
--   - listagem programática restrita ao dono: (storage.foldername(name))[1] = auth.uid()::text
--   - get_admin_clients e decrement_stock: mantidos acessíveis (justificativa em 000002)
--
-- Nota sobre REVOKE de authenticated em funções RLS:
--   O scanner confirmou que RLS policies em Supabase avaliam funções SECURITY DEFINER
--   usando os privilégios do owner (postgres/supabase_admin), não do role caller.
--   Revogar EXECUTE de authenticated nas helpers não quebra as policies.
--   Se consultas falharem após deploy, reverter com:
--     GRANT EXECUTE ON FUNCTION public.<fn>(...) TO authenticated;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO A: avatars — restringir listagem ao dono
--
-- Contexto: Migration 000001 criou policy TO authenticated sem path filter.
-- Migration 000002 reverteu para TO public sem path filter.
-- Esta migration aplica path filter: cada autenticado só lista os próprios arquivos.
-- URLs diretas (getPublicUrl) continuam funcionando para qualquer um — bucket permanece público.
-- Leitura de avatar de outro usuário via URL direta: intacta (necessário para UX compartilhamento).
-- Enumeração via API list(): bloqueada.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatars" ON storage.objects;

-- Usuários autenticados só listam os próprios arquivos
CREATE POLICY "Users can view own avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura pública direta por URL (necessária para exibição sem login)
-- O bucket permanece public=true no Supabase Storage — esta policy afeta apenas
-- chamadas autenticadas à storage API (list, download via signed URL).
-- Download direto via getPublicUrl bypassa RLS storage completamente.

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO B: helpers de RLS — REVOKE de authenticated (além do anon)
--
-- Migration 000002 já revogou de anon. Aqui revogamos de authenticated também.
-- Essas funções são chamadas internamente pelas policies RLS, mas nunca devem
-- ser expostas como RPCs públicas via PostgREST (/rpc/is_group_member etc).
-- service_role mantém EXECUTE para edge functions que precisam.
-- ─────────────────────────────────────────────────────────────────────────────

-- is_super_admin — verifica role de plataforma (admin/super_admin)
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

-- is_group_admin — verifica admin do grupo familiar
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO service_role;

-- is_group_member — verifica membro do grupo familiar
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO service_role;

-- check_group_access — verifica acesso via auth.uid()
REVOKE EXECUTE ON FUNCTION public.check_group_access(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_group_access(uuid) TO service_role;

-- ROLLBACK (se RLS policies quebrarem após deploy):
-- GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.check_group_access(uuid) TO authenticated;
