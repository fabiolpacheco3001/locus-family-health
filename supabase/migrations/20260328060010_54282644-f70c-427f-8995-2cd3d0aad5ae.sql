
-- Drop the old SELECT policy and replace with group-aware one matching medications pattern
DROP POLICY IF EXISTS "RBAC_Select_Notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;

-- Group-aware SELECT: same logic as medications
CREATE POLICY "Group members can view notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = notifications.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (
        fgm.role = 'admin'::app_role
        OR fm.id = fgm.family_member_id
        OR fm.id = ANY(fgm.managed_profiles)
      )
  )
  OR (notifications.family_member_id IS NULL AND auth.uid() = notifications.user_id)
);

-- Keep INSERT for own notifications
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Keep UPDATE for own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Keep DELETE for own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
