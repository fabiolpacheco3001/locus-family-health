-- =============================================================================
-- Security Fix: SECURITY DEFINER search_path + RLS always-true policies
-- Issues: #11 (SECURITY DEFINER sem search_path), #13/#14 (search_path),
--         #16 (RLS always true em family_groups)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #14: Set search_path on all SECURITY DEFINER functions without it
-- Prevents search_path injection attacks (CVE class: schema confusion)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  sig TEXT;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname NOT IN ('pg_catalog','information_schema','extensions','vault','pgbouncer')
      AND p.proconfig IS NULL
  LOOP
    sig := format('%I.%I(%s)', r.nspname, r.proname, r.args);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', sig);
    RAISE NOTICE 'Fixed search_path: %', sig;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #16: Remove overly permissive INSERT policy on family_groups
-- The stricter policy "Authenticated users can create groups"
-- (WITH CHECK auth.uid() = created_by) already exists from migration
-- 20260326174515_4674a488-5fc3-4bc0-ab90-3c728505ee59.sql
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permitir criação de grupos familiares" ON public.family_groups;
