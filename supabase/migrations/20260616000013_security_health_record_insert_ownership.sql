-- Security fix: Health record INSERT policies — verify family_member_id ownership
--
-- Vulnerability (Warning — Lovable scanner):
--   INSERT policies on clinical tables only checked auth.uid() = user_id.
--   A user could insert a health record for a family_member_id from a different
--   family group (by guessing or obtaining another group's UUID).
--
-- Fix: add ownership subquery to all clinical INSERT policies.
--   The family_member must belong to a family group where the current user is a member.
--   Uses family_members.group_id → family_group_members.group_id JOIN.
--
-- Tables covered: consultations, exams, medications, vaccines, allergies, diseases,
--                 health_measurements
--
-- Pattern for FOR ALL policies (vaccines, allergies, health_measurements):
--   Drop the FOR ALL policy → recreate as separate SELECT/INSERT/UPDATE/DELETE
--   so the INSERT WITH CHECK can be independently strengthened.
--   (Postgres OR-logic: two permissive INSERT policies are OR'd, so you cannot
--    add a stricter INSERT policy on top of an existing FOR ALL WITH CHECK.)

-- ============================================================
-- 1. CONSULTATIONS
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own consultations" ON public.consultations;

CREATE POLICY "Users can insert own consultations"
ON public.consultations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = consultations.family_member_id
      AND fgm.auth_user_id = auth.uid()
  )
);

-- ============================================================
-- 2. EXAMS
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own exams" ON public.exams;

CREATE POLICY "Users can insert own exams"
ON public.exams FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = exams.family_member_id
      AND fgm.auth_user_id = auth.uid()
  )
);

-- ============================================================
-- 3. MEDICATIONS
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;

CREATE POLICY "Users can insert own medications"
ON public.medications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = medications.family_member_id
      AND fgm.auth_user_id = auth.uid()
  )
);

-- ============================================================
-- 4. VACCINES
-- (FOR ALL policy — must split to allow independent INSERT WITH CHECK)
-- ============================================================

DROP POLICY IF EXISTS "Users can manage their own vaccines" ON public.vaccines;

-- SELECT / UPDATE / DELETE: keep original check (user_id = auth.uid())
CREATE POLICY "Users can select own vaccines"
ON public.vaccines FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own vaccines"
ON public.vaccines FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vaccines"
ON public.vaccines FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- INSERT: add family_member ownership check
CREATE POLICY "Users can insert own vaccines"
ON public.vaccines FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = vaccines.family_member_id
      AND fgm.auth_user_id = auth.uid()
  )
);

-- ============================================================
-- 5. ALLERGIES
-- (FOR ALL policy — split same as vaccines)
-- ============================================================

DROP POLICY IF EXISTS "Users can manage their own allergies" ON public.allergies;

CREATE POLICY "Users can select own allergies"
ON public.allergies FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own allergies"
ON public.allergies FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own allergies"
ON public.allergies FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own allergies"
ON public.allergies FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = allergies.family_member_id
      AND fgm.auth_user_id = auth.uid()
  )
);

-- ============================================================
-- 6. DISEASES
-- (Already has separate INSERT policy from migration 20260328214119)
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own diseases" ON public.diseases;

CREATE POLICY "Users can insert own diseases"
ON public.diseases FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = diseases.family_member_id
      AND fgm.auth_user_id = auth.uid()
  )
);

-- ============================================================
-- 7. HEALTH MEASUREMENTS
-- (FOR ALL policy — split same as vaccines)
-- ============================================================

DROP POLICY IF EXISTS "Users can manage their own health_measurements" ON public.health_measurements;

CREATE POLICY "Users can select own health_measurements"
ON public.health_measurements FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own health_measurements"
ON public.health_measurements FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health_measurements"
ON public.health_measurements FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health_measurements"
ON public.health_measurements FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = health_measurements.family_member_id
      AND fgm.auth_user_id = auth.uid()
  )
);
