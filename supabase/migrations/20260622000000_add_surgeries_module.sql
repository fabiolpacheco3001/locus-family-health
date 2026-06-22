-- ============================================================
-- Migration: 20260622000000_add_surgeries_module
-- Módulo de Cirurgias — Locus Vita SPEC v1.2
-- ============================================================

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

-- Tabela de instruções pré e pós-cirúrgicas
CREATE TABLE public.surgery_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id uuid NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('pre', 'post')),
  items jsonb NOT NULL DEFAULT '[]',
  raw_ocr_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (surgery_id, phase)
);

-- Índices de performance
CREATE INDEX surgeries_family_member_id_idx ON public.surgeries(family_member_id);
CREATE INDEX surgeries_group_id_idx ON public.surgeries(group_id);
CREATE INDEX surgeries_scheduled_date_idx ON public.surgeries(scheduled_date);
CREATE INDEX surgeries_status_idx ON public.surgeries(status);
CREATE INDEX surgery_instructions_surgery_id_idx ON public.surgery_instructions(surgery_id);

-- RLS
ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_instructions ENABLE ROW LEVEL SECURITY;

-- ── Políticas surgeries (escopo por group_id — padrão do projeto) ──
CREATE POLICY "surgeries_select"
  ON public.surgeries FOR SELECT TO authenticated
  USING (
    group_id IN (
      SELECT fgm.group_id FROM public.family_group_members fgm
      WHERE fgm.user_id = auth.uid()
    )
  );

CREATE POLICY "surgeries_insert"
  ON public.surgeries FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    group_id IN (
      SELECT fgm.group_id FROM public.family_group_members fgm
      WHERE fgm.user_id = auth.uid()
    )
  );

CREATE POLICY "surgeries_update"
  ON public.surgeries FOR UPDATE TO authenticated
  USING (
    group_id IN (
      SELECT fgm.group_id FROM public.family_group_members fgm
      WHERE fgm.user_id = auth.uid()
    )
  );

CREATE POLICY "surgeries_delete"
  ON public.surgeries FOR DELETE TO authenticated
  USING (
    group_id IN (
      SELECT fgm.group_id FROM public.family_group_members fgm
      WHERE fgm.user_id = auth.uid()
    )
  );

-- ── Políticas surgery_instructions (via surgeries) ──
CREATE POLICY "surgery_instructions_select"
  ON public.surgery_instructions FOR SELECT TO authenticated
  USING (
    surgery_id IN (
      SELECT s.id FROM public.surgeries s
      WHERE s.group_id IN (
        SELECT fgm.group_id FROM public.family_group_members fgm
        WHERE fgm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "surgery_instructions_insert"
  ON public.surgery_instructions FOR INSERT TO authenticated
  WITH CHECK (
    surgery_id IN (
      SELECT s.id FROM public.surgeries s
      WHERE s.group_id IN (
        SELECT fgm.group_id FROM public.family_group_members fgm
        WHERE fgm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "surgery_instructions_update"
  ON public.surgery_instructions FOR UPDATE TO authenticated
  USING (
    surgery_id IN (
      SELECT s.id FROM public.surgeries s
      WHERE s.group_id IN (
        SELECT fgm.group_id FROM public.family_group_members fgm
        WHERE fgm.user_id = auth.uid()
      )
    )
  );

-- ── Atualizar trigger cascade_soft_delete_family_member ──
-- Adicionar surgeries ao cascade existente
CREATE OR REPLACE FUNCTION public.cascade_soft_delete_family_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.consultations   SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.exams            SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.medications      SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.vaccines         SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.pet_routines     SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.allergies        SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.diseases         SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.surgeries        SET deleted_at = NEW.deleted_at WHERE family_member_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Garantir que apenas service_role pode executar o trigger (sem acesso direto via API)
REVOKE ALL ON FUNCTION public.cascade_soft_delete_family_member() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.cascade_soft_delete_family_member() TO service_role;

-- updated_at automático
CREATE OR REPLACE TRIGGER set_surgeries_updated_at
  BEFORE UPDATE ON public.surgeries
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE OR REPLACE TRIGGER set_surgery_instructions_updated_at
  BEFORE UPDATE ON public.surgery_instructions
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Grants para authenticated (necessário para PostgREST)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgeries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.surgery_instructions TO authenticated;
GRANT USAGE ON SEQUENCE surgeries_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE surgery_instructions_id_seq TO authenticated;
