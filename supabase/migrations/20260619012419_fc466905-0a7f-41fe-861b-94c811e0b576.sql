-- B: pet_routines — split ALL into per-cmd policies and enforce auth.uid() = user_id on INSERT
DROP POLICY IF EXISTS "Group members can manage pet routines" ON public.pet_routines;

CREATE POLICY "pet_routines_select_group"
  ON public.pet_routines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      JOIN family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = pet_routines.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin'::app_role OR fm.id = ANY (fgm.managed_profiles))
    )
  );

CREATE POLICY "pet_routines_insert_owner"
  ON public.pet_routines FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM family_members fm
      JOIN family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = pet_routines.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin'::app_role OR fm.id = ANY (fgm.managed_profiles))
    )
  );

CREATE POLICY "pet_routines_update_group"
  ON public.pet_routines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      JOIN family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = pet_routines.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin'::app_role OR fm.id = ANY (fgm.managed_profiles))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_members fm
      JOIN family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = pet_routines.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin'::app_role OR fm.id = ANY (fgm.managed_profiles))
    )
  );

CREATE POLICY "pet_routines_delete_group"
  ON public.pet_routines FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      JOIN family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = pet_routines.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin'::app_role OR fm.id = ANY (fgm.managed_profiles))
    )
  );

-- C: Narrow role target on email policies (condition already checks service_role; remove anon surface)
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;

CREATE POLICY "Service role can insert tokens"
  ON public.email_unsubscribe_tokens FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can mark tokens as used"
  ON public.email_unsubscribe_tokens FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can read tokens"
  ON public.email_unsubscribe_tokens FOR SELECT TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;

CREATE POLICY "Service role can insert suppressed emails"
  ON public.suppressed_emails FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can read suppressed emails"
  ON public.suppressed_emails FOR SELECT TO service_role
  USING (true);