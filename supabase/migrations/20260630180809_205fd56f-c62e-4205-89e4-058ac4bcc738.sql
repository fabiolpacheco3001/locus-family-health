DROP POLICY IF EXISTS "Owners and admins can update surgeries" ON public.surgeries;
DROP POLICY IF EXISTS "Owners and admins can delete surgeries" ON public.surgeries;

CREATE POLICY "Owners can update own surgeries" ON public.surgeries
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Owners can delete own surgeries" ON public.surgeries
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));