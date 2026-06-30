ALTER POLICY "Users can insert own family members" ON public.family_members
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (
      group_id IS NULL
      OR group_id IN (
        SELECT group_id
        FROM public.family_group_members
        WHERE auth_user_id = (select auth.uid())
      )
    )
  );