
CREATE TABLE public.menstrual_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  familiar_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date,
  flow_intensity text,
  symptoms text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.menstrual_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own menstrual_cycles"
  ON public.menstrual_cycles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
