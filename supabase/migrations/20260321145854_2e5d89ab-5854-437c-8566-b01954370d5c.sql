
CREATE TABLE public.exams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  exam_date date,
  location text,
  status text NOT NULL DEFAULT 'Agendado',
  file_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exams"
  ON public.exams FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exams"
  ON public.exams FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exams"
  ON public.exams FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exams"
  ON public.exams FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
