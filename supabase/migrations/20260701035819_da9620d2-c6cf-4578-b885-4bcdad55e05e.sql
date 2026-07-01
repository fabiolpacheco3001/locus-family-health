-- ============================================================
-- Migration: surgery_instructions_created_by_ownership
-- ============================================================

ALTER TABLE public.surgery_instructions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

UPDATE public.surgery_instructions si
SET created_by = s.user_id
FROM public.surgeries s
WHERE si.surgery_id = s.id
  AND si.created_by IS NULL;

ALTER TABLE public.surgery_instructions
  ALTER COLUMN created_by SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_surgery_instructions_created_by
  ON public.surgery_instructions (created_by);

CREATE OR REPLACE FUNCTION public.set_surgery_instruction_created_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_surgery_instructions_created_by ON public.surgery_instructions;
CREATE TRIGGER trg_surgery_instructions_created_by
  BEFORE INSERT ON public.surgery_instructions
  FOR EACH ROW EXECUTE FUNCTION public.set_surgery_instruction_created_by();

DROP POLICY IF EXISTS "Group members can insert surgery_instructions" ON public.surgery_instructions;
CREATE POLICY "Group members can insert surgery_instructions"
  ON public.surgery_instructions FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.surgeries s
      INNER JOIN public.family_group_members fgm ON fgm.group_id = s.group_id
      WHERE s.id = surgery_instructions.surgery_id
        AND fgm.auth_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner or admin can update surgery_instructions" ON public.surgery_instructions;
CREATE POLICY "Owner or admin can update surgery_instructions"
  ON public.surgery_instructions FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR public.is_group_admin(
         (SELECT auth.uid()),
         (SELECT group_id FROM public.surgeries WHERE id = surgery_instructions.surgery_id)
       )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR public.is_group_admin(
         (SELECT auth.uid()),
         (SELECT group_id FROM public.surgeries WHERE id = surgery_instructions.surgery_id)
       )
  );

DROP POLICY IF EXISTS "Owner or admin can delete surgery_instructions" ON public.surgery_instructions;
CREATE POLICY "Owner or admin can delete surgery_instructions"
  ON public.surgery_instructions FOR DELETE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR public.is_group_admin(
         (SELECT auth.uid()),
         (SELECT group_id FROM public.surgeries WHERE id = surgery_instructions.surgery_id)
       )
  );