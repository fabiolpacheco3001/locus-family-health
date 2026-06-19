-- =============================================================================
-- Security Fix: RAIO-X v2 — REVOKE anon + webauthn_challenges RLS + avatars SELECT
-- Sessão 22 (18/06/2026)
--
-- Findings addressed:
--   DB-WARN-01..05  SECURITY DEFINER functions callable by anon role
--   DB-INFO-01      webauthn_challenges: RLS enabled, zero policies
--   DB-WARN-06      avatars bucket: SELECT policy allows unauthenticated access
--
-- NOTE: Migration 000002 reverts the avatars change (decisão de produto: manter público)
--       and adds explicit REVOKE by role name (REVOKE FROM PUBLIC insufficient).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO A: REVOKE EXECUTE from PUBLIC on SECURITY DEFINER helper functions
-- (Migration 000002 complementa com REVOKE explícito por role)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_group_access(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_group_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO B: webauthn_challenges — RLS enabled but zero policies
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "webauthn_challenges_service_role_only" ON public.webauthn_challenges;

CREATE POLICY "webauthn_challenges_service_role_only"
  ON public.webauthn_challenges
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO C: avatars bucket — SELECT policy temporariamente restrita a authenticated
-- REVERTIDO em 000002 por decisão de produto (avatars devem ser públicos)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
