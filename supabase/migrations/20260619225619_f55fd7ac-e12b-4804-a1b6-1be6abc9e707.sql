-- Lock down plaintext-email admin tables. Only service_role (Edge Functions) should touch them.
-- anon/authenticated currently hold full table privileges from legacy defaults — revoke entirely.

REVOKE ALL ON public.email_unsubscribe_tokens FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.suppressed_emails        FROM anon, authenticated, PUBLIC;

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
GRANT ALL ON public.suppressed_emails        TO service_role;

-- Defense-in-depth: explicit restrictive policies blocking any access from anon/authenticated,
-- in case future GRANTs are added by mistake.
DROP POLICY IF EXISTS "Block client access to unsubscribe tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Block client access to unsubscribe tokens"
  ON public.email_unsubscribe_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block client access to suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Block client access to suppressed emails"
  ON public.suppressed_emails
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);