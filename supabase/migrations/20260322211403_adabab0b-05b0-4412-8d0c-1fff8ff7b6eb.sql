
CREATE TABLE public.vaccines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  applied_date DATE,
  booster_date DATE,
  batch TEXT,
  side_effects TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vaccines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vaccines"
ON public.vaccines
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
