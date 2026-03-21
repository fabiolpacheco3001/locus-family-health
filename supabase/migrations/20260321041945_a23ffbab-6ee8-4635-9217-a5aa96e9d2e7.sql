
CREATE TABLE public.consultations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  specialty text NOT NULL,
  professional_name text,
  consultation_date timestamptz,
  type text DEFAULT 'Rotina',
  symptoms text,
  questions text,
  status text NOT NULL DEFAULT 'Agendada',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consultations"
  ON public.consultations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consultations"
  ON public.consultations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consultations"
  ON public.consultations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own consultations"
  ON public.consultations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
