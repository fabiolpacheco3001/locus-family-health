
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their group"
ON public.family_groups FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE auth_user_id = auth.uid() AND group_id = family_groups.id
  )
);

CREATE POLICY "Admins can update their group"
ON public.family_groups FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE auth_user_id = auth.uid() AND group_id = family_groups.id AND role = 'admin'
  )
);

ALTER TABLE public.family_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group members"
ON public.family_group_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.family_group_members gm2
    WHERE gm2.auth_user_id = auth.uid() AND gm2.group_id = family_group_members.group_id
  )
);

CREATE POLICY "Admins can manage group members"
ON public.family_group_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.family_group_members gm2
    WHERE gm2.auth_user_id = auth.uid() AND gm2.group_id = family_group_members.group_id AND gm2.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.family_group_members gm2
    WHERE gm2.auth_user_id = auth.uid() AND gm2.group_id = family_group_members.group_id AND gm2.role = 'admin'
  )
);
