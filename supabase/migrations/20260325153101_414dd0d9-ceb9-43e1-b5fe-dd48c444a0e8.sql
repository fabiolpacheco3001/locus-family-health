
CREATE TABLE public.blood_pressure_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  familiar_id uuid NOT NULL,
  consultation_id uuid,
  systolic integer NOT NULL,
  diastolic integer NOT NULL,
  measurement_date timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.blood_pressure_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own blood_pressure_history"
  ON public.blood_pressure_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
