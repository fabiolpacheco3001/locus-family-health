
CREATE TABLE public.medication_doses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  scheduled_for timestamp with time zone NOT NULL,
  taken_at timestamp with time zone,
  status text NOT NULL DEFAULT 'taken',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medication_doses_status_check CHECK (status IN ('taken', 'skipped'))
);

CREATE INDEX idx_medication_doses_medication_id ON public.medication_doses(medication_id);
CREATE INDEX idx_medication_doses_scheduled_for ON public.medication_doses(scheduled_for);

ALTER TABLE public.medication_doses ENABLE ROW LEVEL SECURITY;

-- SELECT: user owns the medication OR is group admin/manager of the family member
CREATE POLICY "Users can view medication doses"
ON public.medication_doses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.medications m
    WHERE m.id = medication_doses.medication_id
    AND (
      m.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.family_members fm
        JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
        WHERE fm.id = m.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
      )
    )
  )
);

-- INSERT: same logic
CREATE POLICY "Users can insert medication doses"
ON public.medication_doses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.medications m
    WHERE m.id = medication_doses.medication_id
    AND (
      m.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.family_members fm
        JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
        WHERE fm.id = m.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
      )
    )
  )
);

-- DELETE: same logic
CREATE POLICY "Users can delete medication doses"
ON public.medication_doses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.medications m
    WHERE m.id = medication_doses.medication_id
    AND (
      m.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.family_members fm
        JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
        WHERE fm.id = m.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
      )
    )
  )
);
