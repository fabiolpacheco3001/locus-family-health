-- Security fix: ai_usage_logs missing SELECT policy for own rows
--
-- Vulnerability (Warning — Lovable scanner):
--   ai_usage_logs had INSERT policy (users can insert own logs) and
--   SELECT policy (admins only), but no SELECT policy for users to
--   read their own rows. This means users cannot see their own AI
--   usage through the UI (useAiStatus hooks rely on this).
--
-- Fix: add permissive SELECT policy scoped to the user's own rows.

CREATE POLICY "Users can read own AI logs"
ON public.ai_usage_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
