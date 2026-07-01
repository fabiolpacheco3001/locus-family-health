DROP POLICY IF EXISTS "Group members can update surgery_instructions" ON public.surgery_instructions;

CREATE POLICY "Owner or admin can update surgery_instructions"
  ON public.surgery_instructions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      WHERE s.id = surgery_instructions.surgery_id
        AND (
          s.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.family_group_members fgm
            WHERE fgm.group_id = s.group_id
              AND fgm.auth_user_id = (SELECT auth.uid())
              AND fgm.role = 'admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Group members can delete surgery_instructions" ON public.surgery_instructions;

CREATE POLICY "Owner or admin can delete surgery_instructions"
  ON public.surgery_instructions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      WHERE s.id = surgery_instructions.surgery_id
        AND (
          s.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.family_group_members fgm
            WHERE fgm.group_id = s.group_id
              AND fgm.auth_user_id = (SELECT auth.uid())
              AND fgm.role = 'admin'
          )
        )
    )
  );