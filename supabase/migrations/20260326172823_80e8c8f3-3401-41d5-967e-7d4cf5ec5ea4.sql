
CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage group invites"
ON public.group_invites
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE auth_user_id = auth.uid()
      AND group_id = group_invites.group_id
      AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE auth_user_id = auth.uid()
      AND group_id = group_invites.group_id
      AND role = 'admin'
  )
);
