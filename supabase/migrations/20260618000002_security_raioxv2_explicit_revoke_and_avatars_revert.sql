-- =============================================================================
-- Security Fix: RAIO-X v2 — REVOKE explícito por role + reversão avatars
-- Sessão 23 (18/06/2026)
--
-- Contexto:
--   Migration 000001 revogou via FROM PUBLIC, mas o Supabase cria grants
--   explícitos para anon/authenticated ao publicar funções no schema public.
--   REVOKE FROM PUBLIC não retira grants nomeados → esta migration revoga
--   explicitamente de cada role por nome.
--
-- Decisões do produto:
--   - avatars: manter bucket público (qualquer um pode ver fotos via URL)
--   - get_admin_clients: aceitar WARN (tem guard RAISE EXCEPTION interno)
--   - /seguranca: criar página pública (feito em src/pages/Seguranca.tsx)
--
-- Findings cobertos: B1, B2(revert), B3, B4
--
-- Rollback plan (aplicar no SQL editor do Supabase se necessário):
--   GRANT EXECUTE ON FUNCTION public.cascade_soft_delete_family_member() TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT,JSONB) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT,INT,INT) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.delete_email(TEXT,BIGINT) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT,TEXT,BIGINT,JSONB) TO authenticated;
--   DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
--   CREATE POLICY "Anyone can view avatars"
--     ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO A: Reverter policy de avatars → TO public (decisão de produto)
--
-- Avaliação: avatares são dados de UI (fotos de perfil), não clínicos.
-- A listagem pública de UUIDs é um trade-off aceito para garantir que
-- fotos apareçam sem autenticação (compartilhamento de links, apps externos).
-- Migration 000001 alterou para TO authenticated — revertendo aqui.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');
-- NOTE: bucket avatars é intencionalmente público (fotos de perfil).
-- Linter WARN aceito como risco de produto documentado.

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO B: REVOKE EXECUTE explícito por role (não só FROM PUBLIC)
--
-- O Supabase/PostgREST cria grants explícitos para anon e authenticated
-- em funções publicadas no schema public. REVOKE FROM PUBLIC não retira
-- esses grants nomeados. Necessário revogar role por role.
--
-- Categorias:
--   (1) Trigger functions  → REVOKE de todos os roles (trigger usa privilégio do owner)
--   (2) Funções de fila    → REVOKE de anon + authenticated; apenas service_role
--   (3) Helpers de RLS     → REVOKE de anon; manter authenticated (necessário p/ policies)
--   (4) decrement_stock    → REVOKE de anon; manter authenticated (chamada do frontend)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── (1) Trigger function — cascade_soft_delete_family_member() ───────────────
-- É executada pelo mecanismo de trigger (com privilégio do owner da tabela),
-- nunca chamada diretamente por roles de API.
DO $$ BEGIN
  REVOKE ALL ON FUNCTION public.cascade_soft_delete_family_member()
    FROM anon, authenticated, PUBLIC;
  GRANT EXECUTE ON FUNCTION public.cascade_soft_delete_family_member()
    TO service_role;
EXCEPTION WHEN undefined_function THEN
  -- Função pode não existir nas migrations (criada pelo Lovable diretamente no DB)
  RAISE NOTICE 'cascade_soft_delete_family_member: função não encontrada, ignorando.';
END $$;

-- ── (2) Funções de fila de e-mail — apenas service_role ──────────────────────
-- Chamadas pela edge function process-email-queue via service_role.
-- anon e authenticated não devem ter acesso.

REVOKE ALL ON FUNCTION public.enqueue_email(TEXT, JSONB)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB)
  TO service_role;

REVOKE ALL ON FUNCTION public.read_email_batch(TEXT, INT, INT)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT)
  TO service_role;

REVOKE ALL ON FUNCTION public.delete_email(TEXT, BIGINT)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT)
  TO service_role;

REVOKE ALL ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB)
  TO service_role;

-- ── (3) Helpers de RLS — REVOKE de anon; manter authenticated ────────────────
-- authenticated precisa de EXECUTE para que as policies de RLS funcionem
-- quando um usuário logado executa queries em tabelas com essas policies.
-- anon nunca deve chamar essas funções.

-- is_super_admin — verifica se user tem role admin/super_admin
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

-- is_group_admin — verifica se user é admin do grupo familiar
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated, service_role;

-- is_group_member — verifica se user é membro do grupo familiar
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, service_role;

-- check_group_access — verifica acesso ao grupo via auth.uid()
REVOKE EXECUTE ON FUNCTION public.check_group_access(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_group_access(uuid) TO authenticated, service_role;

-- ── (4) decrement_stock — REVOKE de anon; manter authenticated ───────────────
-- Chamada pelo frontend (fluxo de marcação de dose tomada).
-- anon não pode chamar; authenticated é intencional.

REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO authenticated, service_role;

-- ── (5) get_admin_clients — aceitar WARN (decisão de produto) ────────────────
-- Função já tem guard interno (RAISE EXCEPTION se caller não é admin).
-- Manter GRANT TO authenticated; linter WARN marcado como aceito.
-- Sem alteração aqui.

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO C: webauthn_challenges — reforço de REVOKE além da policy USING(false)
--
-- Migration 000001 criou policy USING(false) para anon+authenticated.
-- Aqui revogamos também via GRANT TABLE para defesa em profundidade.
-- Service_role bypassa RLS e continua com acesso total.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON TABLE public.webauthn_challenges FROM anon, authenticated;
-- service_role mantém acesso implícito por bypass de RLS.
-- Comentário explícito: tabela acessada EXCLUSIVAMENTE via service_role
-- pelas edge functions webauthn-challenge e webauthn-verify.
COMMENT ON TABLE public.webauthn_challenges IS
  'Tokens de desafio WebAuthn de curta duração (TTL ~5 min). '
  'Acesso exclusivo via service_role (edge functions). '
  'Nenhum role anon/authenticated deve acessar diretamente.';
