
CREATE TABLE public.medications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  dosage text,
  frequency text,
  duration text,
  start_date timestamp with time zone,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own medications" ON public.medications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medications" ON public.medications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own medications" ON public.medications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own medications" ON public.medications FOR DELETE TO authenticated USING (auth.uid() = user_id);
