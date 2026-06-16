-- Security fix: Supersede migration 000013 — complete ownership check for clinical INSERT policies
--
-- Extends 20260616000013_security_health_record_insert_ownership.sql with:
--   1. `fm.deleted_at IS NULL` — excludes soft-deleted members from the ownership check
--   2. Role-aware access: allows insert if caller is group admin, the member's creator,
--      OR the member is in the caller's managed_profiles list
--
-- Lovable RAIO X 2.0 recommendation:
--   fgm.role = 'admin'                             → group admins can manage all members
--   fm.user_id = auth.uid()                        → creator can always manage their own member
--   fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))  → delegated caregivers
--
-- Tables covered: consultations, exams, medications, vaccines, allergies, diseases,
--                 health_measurements (same 7 as migration 000013)

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
      AND fm.deleted_at IS NULL
      AND (
        fgm.role = 'admin'
        OR fm.user_id = auth.uid()
        OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))
      )
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
      AND fm.deleted_at IS NULL
      AND (
        fgm.role = 'admin'
        OR fm.user_id = auth.uid()
        OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))
      )
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
      AND fm.deleted_at IS NULL
      AND (
        fgm.role = 'admin'
        OR fm.user_id = auth.uid()
        OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))
      )
  )
);

-- ============================================================
-- 4. VACCINES
-- (split policies already in place from migration 000013)
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own vaccines" ON public.vaccines;

CREATE POLICY "Users can insert own vaccines"
ON public.vaccines FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = vaccines.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND fm.deleted_at IS NULL
      AND (
        fgm.role = 'admin'
        OR fm.user_id = auth.uid()
        OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))
      )
  )
);

-- ============================================================
-- 5. ALLERGIES
-- (split policies already in place from migration 000013)
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own allergies" ON public.allergies;

CREATE POLICY "Users can insert own allergies"
ON public.allergies FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = allergies.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND fm.deleted_at IS NULL
      AND (
        fgm.role = 'admin'
        OR fm.user_id = auth.uid()
        OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))
      )
  )
);

-- ============================================================
-- 6. DISEASES
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
      AND fm.deleted_at IS NULL
      AND (
        fgm.role = 'admin'
        OR fm.user_id = auth.uid()
        OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))
      )
  )
);

-- ============================================================
-- 7. HEALTH MEASUREMENTS
-- (split policies already in place from migration 000013)
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own health_measurements" ON public.health_measurements;

CREATE POLICY "Users can insert own health_measurements"
ON public.health_measurements FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = health_measurements.family_member_id
      AND fgm.auth_user_id = auth.uid()
      AND fm.deleted_at IS NULL
      AND (
        fgm.role = 'admin'
        OR fm.user_id = auth.uid()
        OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))
      )
  )
);
