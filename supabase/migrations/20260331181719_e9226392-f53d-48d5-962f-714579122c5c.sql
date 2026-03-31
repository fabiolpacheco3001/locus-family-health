
-- Allow a user who just created a family_groups row to insert themselves into family_group_members
CREATE POLICY "Creator can self-insert into group"
ON public.family_group_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = auth_user_id
  AND EXISTS (
    SELECT 1 FROM public.family_groups
    WHERE id = family_group_members.group_id
      AND created_by = auth.uid()
  )
);
