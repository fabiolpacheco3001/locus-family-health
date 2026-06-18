-- =============================================================================
-- Security Fix: RAIO-X v2 — REVOKE anon + webauthn_challenges RLS + avatars SELECT
-- Sessão 22 (18/06/2026)
--
-- Findings addressed:
--   DB-WARN-01..05  SECURITY DEFINER functions callable by anon role
--   DB-INFO-01      webauthn_challenges: RLS enabled, zero policies
--   DB-WARN-06      avatars bucket: SELECT policy allows unauthenticated access
--
-- Rollback plan (if needed — apply manually via Supabase SQL editor):
--   GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid,uuid) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.is_group_member(uuid,uuid) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.check_group_access(uuid) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid,integer) TO PUBLIC;
--   DROP POLICY IF EXISTS "webauthn_challenges_service_role_only" ON public.webauthn_challenges;
--   DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
--   CREATE POLICY "Anyone can view avatars"
--     ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO A: REVOKE EXECUTE from PUBLIC on SECURITY DEFINER helper functions
--
-- By default Postgres grants EXECUTE to PUBLIC on new functions.
-- These helpers are SECURITY DEFINER (run as table owner) and should NOT be
-- callable by unauthenticated (anon) users directly via the PostgREST API.
--
-- RLS policies that call these functions execute them in the context of the
-- calling role. After REVOKE FROM PUBLIC + GRANT TO authenticated:
--   • anon     → cannot call these functions
--   • authenticated → can still call (required for RLS policy evaluation)
--   • service_role  → always bypasses, unaffected
-- ─────────────────────────────────────────────────────────────────────────────

-- is_super_admin(_user_id uuid) — used in admin RLS policies
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- is_group_admin(_user_id uuid, _group_id uuid) — used in family group RLS
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;

-- is_group_member(_user_id uuid, _group_id uuid) — used in family group RLS
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

-- check_group_access(_group_id uuid) — called in RLS policies on clinical tables
REVOKE EXECUTE ON FUNCTION public.check_group_access(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_group_access(uuid) TO authenticated;

-- decrement_stock(med_id uuid, amount integer) — called directly by authenticated
-- users from the frontend (medication intake flow); must NOT be accessible by anon
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.decrement_stock(uuid, integer) TO authenticated;

-- Note: enqueue_email, read_email_batch, delete_email, move_to_dlq already have
-- REVOKE FROM PUBLIC + GRANT TO service_role (migration 20260327205549_email_infra.sql)
-- get_admin_clients() already has GRANT TO authenticated (migration 20260615000006)

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO B: webauthn_challenges — RLS enabled but zero policies
--
-- This table is accessed ONLY by Edge Functions via the service_role client,
-- which bypasses RLS entirely. No authenticated/anon user should ever query
-- this table directly. Adding an explicit restrictive policy documents intent
-- and silences the Supabase linter warning.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "webauthn_challenges_service_role_only" ON public.webauthn_challenges;

-- Explicit deny for all roles except service_role (which bypasses RLS)
CREATE POLICY "webauthn_challenges_service_role_only"
  ON public.webauthn_challenges
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCO C: avatars bucket — SELECT policy allows unauthenticated (public) access
--
-- "Anyone can view avatars" uses TO public, meaning the internet can enumerate
-- and download profile pictures without authentication.
-- Fix: restrict to authenticated users only.
-- Family members can still see each other's avatars (authenticated) but
-- unauthenticated crawlers and bots cannot.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
