-- Security fix: blood_pressure_history + menstrual_cycles INSERT policies
--
-- Vulnerability (Error — Lovable RAIO X 3.0, findings #1 and #2):
--   Both tables have FOR ALL policies with only:
--     WITH CHECK (auth.uid() = user_id)
--   This does not validate that `familiar_id` belongs to a family_member the user
--   can manage. An attacker who discovers another family's familiar_id UUID could
--   inject blood pressure readings or menstrual cycle records into a foreign profile.
--
-- Note: Both tables use the column `familiar_id` (not `family_member_id`).
--
-- Fix: Split FOR ALL → separate SELECT / INSERT / UPDATE / DELETE policies.
--   INSERT gets the complete ownership check:
--     - familiar_id must belong to a family_member in the user's group
--     - family_member must not be soft-deleted
--     - caller must be group admin, the member's creator, or have managed_profiles access
--
-- Pattern is identical to vaccines/allergies/health_measurements (migration 000013/000017).

-- ============================================================
-- 1. BLOOD_PRESSURE_HISTORY
-- ============================================================

DROP POLICY IF EXISTS "Users can manage their own blood_pressure_history" ON public.blood_pressure_history;

-- SELECT / UPDATE / DELETE: keep original ownership check
CREATE POLICY "Users can select own blood_pressure_history"
ON public.blood_pressure_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own blood_pressure_history"
ON public.blood_pressure_history FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own blood_pressure_history"
ON public.blood_pressure_history FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- INSERT: add familiar_id ownership check
CREATE POLICY "Users can insert own blood_pressure_history"
ON public.blood_pressure_history FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = blood_pressure_history.familiar_id
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
-- 2. MENSTRUAL_CYCLES
-- ============================================================

DROP POLICY IF EXISTS "Users can manage their own menstrual_cycles" ON public.menstrual_cycles;

-- SELECT / UPDATE / DELETE: keep original ownership check
CREATE POLICY "Users can select own menstrual_cycles"
ON public.menstrual_cycles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own menstrual_cycles"
ON public.menstrual_cycles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own menstrual_cycles"
ON public.menstrual_cycles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- INSERT: add familiar_id ownership check
CREATE POLICY "Users can insert own menstrual_cycles"
ON public.menstrual_cycles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
    WHERE fm.id = menstrual_cycles.familiar_id
      AND fgm.auth_user_id = auth.uid()
      AND fm.deleted_at IS NULL
      AND (
        fgm.role = 'admin'
        OR fm.user_id = auth.uid()
        OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[]))
      )
  )
);
