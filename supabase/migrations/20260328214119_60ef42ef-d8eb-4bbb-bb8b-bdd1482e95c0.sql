
-- =============================================
-- PHASE 220: Group-Aware DELETE & UPDATE policies
-- =============================================

-- Helper: reusable check for owner OR admin OR managed_profiles
-- Already have is_group_admin function, we'll use inline checks similar to medications pattern

-- ============ CONSULTATIONS ============

-- Drop old owner-only policies
DROP POLICY IF EXISTS "Users can delete own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Users can update own consultations" ON public.consultations;

-- New group-aware DELETE
CREATE POLICY "Group members can delete consultations"
ON public.consultations FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = consultations.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
  )
);

-- New group-aware UPDATE
CREATE POLICY "Group members can update consultations"
ON public.consultations FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = consultations.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
  )
);

-- ============ EXAMS ============

DROP POLICY IF EXISTS "Users can delete own exams" ON public.exams;
DROP POLICY IF EXISTS "Users can update own exams" ON public.exams;

CREATE POLICY "Group members can delete exams"
ON public.exams FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = exams.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
  )
);

CREATE POLICY "Group members can update exams"
ON public.exams FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = exams.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
  )
);

-- ============ DISEASES ============

-- diseases currently has an ALL policy for owner-only; drop and replace with granular
DROP POLICY IF EXISTS "Users can manage their own diseases" ON public.diseases;

-- INSERT remains owner-only
CREATE POLICY "Users can insert own diseases"
ON public.diseases FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- SELECT: group-aware
CREATE POLICY "Group members can view diseases"
ON public.diseases FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = diseases.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = fgm.family_member_id OR fm.id = ANY(fgm.managed_profiles))
  )
);

-- UPDATE: group-aware
CREATE POLICY "Group members can update diseases"
ON public.diseases FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = diseases.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
  )
);

-- DELETE: group-aware
CREATE POLICY "Group members can delete diseases"
ON public.diseases FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = diseases.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
  )
);

-- ============ NOTIFICATIONS ============

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Group members can delete notifications"
ON public.notifications FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = notifications.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
  )
);

CREATE POLICY "Group members can update notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM family_members fm
    JOIN family_group_members fgm ON fm.group_id = fgm.group_id
    WHERE fm.id = notifications.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
  )
);
