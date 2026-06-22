
-- Tabela principal de cirurgias
CREATE TABLE public.surgeries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  surgery_type text NOT NULL,
  custom_type text,
  scheduled_date timestamptz,
  hospital_clinic text,
  surgeon_name text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled')),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgeries TO authenticated;
GRANT ALL ON public.surgeries TO service_role;

ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view surgeries"
  ON public.surgeries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_group_members fgm
      WHERE fgm.group_id = surgeries.group_id AND fgm.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own surgeries"
  ON public.surgeries FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
      WHERE fm.id = surgeries.family_member_id
        AND fgm.auth_user_id = auth.uid()
        AND fm.group_id = surgeries.group_id
    )
  );

CREATE POLICY "Group members can update surgeries"
  ON public.surgeries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_group_members fgm
      WHERE fgm.group_id = surgeries.group_id AND fgm.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can delete surgeries"
  ON public.surgeries FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_group_members fgm
      WHERE fgm.group_id = surgeries.group_id AND fgm.auth_user_id = auth.uid()
    )
  );

-- Tabela de instruções pré/pós-op
CREATE TABLE public.surgery_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id uuid NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('pre', 'post')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_ocr_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (surgery_id, phase)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgery_instructions TO authenticated;
GRANT ALL ON public.surgery_instructions TO service_role;

ALTER TABLE public.surgery_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view surgery_instructions"
  ON public.surgery_instructions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      INNER JOIN public.family_group_members fgm ON fgm.group_id = s.group_id
      WHERE s.id = surgery_instructions.surgery_id AND fgm.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can insert surgery_instructions"
  ON public.surgery_instructions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      INNER JOIN public.family_group_members fgm ON fgm.group_id = s.group_id
      WHERE s.id = surgery_instructions.surgery_id AND fgm.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can update surgery_instructions"
  ON public.surgery_instructions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      INNER JOIN public.family_group_members fgm ON fgm.group_id = s.group_id
      WHERE s.id = surgery_instructions.surgery_id AND fgm.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can delete surgery_instructions"
  ON public.surgery_instructions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      INNER JOIN public.family_group_members fgm ON fgm.group_id = s.group_id
      WHERE s.id = surgery_instructions.surgery_id AND fgm.auth_user_id = auth.uid()
    )
  );

-- Índices
CREATE INDEX surgeries_family_member_id_idx ON public.surgeries(family_member_id);
CREATE INDEX surgeries_group_id_idx ON public.surgeries(group_id);
CREATE INDEX surgeries_scheduled_date_idx ON public.surgeries(scheduled_date);
CREATE INDEX surgery_instructions_surgery_id_idx ON public.surgery_instructions(surgery_id);

-- Triggers updated_at (usa função existente public.touch_updated_at)
CREATE TRIGGER set_surgeries_updated_at
  BEFORE UPDATE ON public.surgeries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER set_surgery_instructions_updated_at
  BEFORE UPDATE ON public.surgery_instructions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atualiza cascade_soft_delete_family_member para cobrir surgeries
CREATE OR REPLACE FUNCTION public.cascade_soft_delete_family_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE consultations SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id;
    UPDATE exams SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id;
    UPDATE medications SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id;
    UPDATE vaccines SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id;
    UPDATE surgeries SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id;
  END IF;

  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    UPDATE consultations SET deleted_at = NULL WHERE family_member_id = NEW.id;
    UPDATE exams SET deleted_at = NULL WHERE family_member_id = NEW.id;
    UPDATE medications SET deleted_at = NULL WHERE family_member_id = NEW.id;
    UPDATE vaccines SET deleted_at = NULL WHERE family_member_id = NEW.id;
    UPDATE surgeries SET deleted_at = NULL WHERE family_member_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
