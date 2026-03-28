-- Drop the two existing UPDATE policies
DROP POLICY "Users can update own family members" ON public.family_members;
DROP POLICY "Users can update permitted profiles" ON public.family_members;

-- Create a single consolidated UPDATE policy
CREATE POLICY "Group members can update family members"
ON public.family_members FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE auth_user_id = auth.uid()
      AND group_id = family_members.group_id
      AND role = 'admin'
  )
  OR
  id = (
    SELECT family_member_id FROM public.family_group_members
    WHERE auth_user_id = auth.uid() LIMIT 1
  )
  OR
  id IN (
    SELECT unnest(managed_profiles) FROM public.family_group_members
    WHERE auth_user_id = auth.uid()
  )
);