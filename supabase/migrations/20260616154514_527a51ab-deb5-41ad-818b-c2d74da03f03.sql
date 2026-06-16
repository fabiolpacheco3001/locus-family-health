DROP POLICY IF EXISTS "Allow invitees to join group" ON public.family_group_members;

CREATE POLICY "Allow invitees to join group"
ON public.family_group_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth_user_id = auth.uid()
  AND role = 'user'::app_role
  AND EXISTS (
    SELECT 1 FROM public.group_invites gi
    WHERE gi.group_id = family_group_members.group_id
      AND gi.email = (auth.jwt() ->> 'email')
      AND gi.accepted_at IS NULL
  )
);