
-- ============================================================
-- 1. CLEAN ORPHANED RECORDS (family_member_id not in family_members)
-- ============================================================
DELETE FROM public.consultations WHERE family_member_id NOT IN (SELECT id FROM public.family_members);
DELETE FROM public.exams WHERE family_member_id NOT IN (SELECT id FROM public.family_members);
DELETE FROM public.medications WHERE family_member_id NOT IN (SELECT id FROM public.family_members);
DELETE FROM public.pet_routines WHERE family_member_id NOT IN (SELECT id FROM public.family_members);
DELETE FROM public.allergies WHERE family_member_id NOT IN (SELECT id FROM public.family_members);
DELETE FROM public.diseases WHERE family_member_id NOT IN (SELECT id FROM public.family_members);
DELETE FROM public.vaccines WHERE family_member_id NOT IN (SELECT id FROM public.family_members);
DELETE FROM public.health_measurements WHERE family_member_id NOT IN (SELECT id FROM public.family_members);
DELETE FROM public.notifications WHERE family_member_id IS NOT NULL AND family_member_id NOT IN (SELECT id FROM public.family_members);

-- ============================================================
-- 2. RECREATE FOREIGN KEYS WITH ON DELETE CASCADE
-- ============================================================

-- consultations
ALTER TABLE public.consultations DROP CONSTRAINT IF EXISTS consultations_family_member_id_fkey;
ALTER TABLE public.consultations ADD CONSTRAINT consultations_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- exams
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_family_member_id_fkey;
ALTER TABLE public.exams ADD CONSTRAINT exams_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- medications
ALTER TABLE public.medications DROP CONSTRAINT IF EXISTS medications_family_member_id_fkey;
ALTER TABLE public.medications ADD CONSTRAINT medications_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- pet_routines
ALTER TABLE public.pet_routines DROP CONSTRAINT IF EXISTS pet_routines_family_member_id_fkey;
ALTER TABLE public.pet_routines ADD CONSTRAINT pet_routines_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- allergies
ALTER TABLE public.allergies DROP CONSTRAINT IF EXISTS allergies_family_member_id_fkey;
ALTER TABLE public.allergies ADD CONSTRAINT allergies_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- diseases
ALTER TABLE public.diseases DROP CONSTRAINT IF EXISTS diseases_family_member_id_fkey;
ALTER TABLE public.diseases ADD CONSTRAINT diseases_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- vaccines
ALTER TABLE public.vaccines DROP CONSTRAINT IF EXISTS vaccines_family_member_id_fkey;
ALTER TABLE public.vaccines ADD CONSTRAINT vaccines_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- health_measurements
ALTER TABLE public.health_measurements DROP CONSTRAINT IF EXISTS health_measurements_family_member_id_fkey;
ALTER TABLE public.health_measurements ADD CONSTRAINT health_measurements_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- notifications (nullable FK)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_family_member_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_family_member_id_fkey
  FOREIGN KEY (family_member_id) REFERENCES public.family_members(id) ON DELETE CASCADE;

-- ============================================================
-- 3. FIX MEDICATIONS RLS: Replace fragile policies with group-aware ones
-- ============================================================

-- Drop the old user-only SELECT policy
DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
DROP POLICY IF EXISTS "RBAC_Select_Meds" ON public.medications;

-- New unified SELECT policy (same pattern as pet_routines)
CREATE POLICY "Group members can view medications" ON public.medications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = medications.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin' OR fm.id = fgm.family_member_id OR fm.id = ANY(fgm.managed_profiles))
    )
  );

-- Also fix DELETE and UPDATE to be group-aware for admins
DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;
CREATE POLICY "Group members can delete medications" ON public.medications
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = medications.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND fgm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
CREATE POLICY "Group members can update medications" ON public.medications
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = medications.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND fgm.role = 'admin'
    )
  );
