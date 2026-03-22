
-- Add biometric columns to family_members
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS height numeric,
  ADD COLUMN IF NOT EXISTS physical_activity text;

-- Create health_measurements history table
CREATE TABLE public.health_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  weight numeric,
  height numeric,
  bmi numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.health_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own health_measurements"
  ON public.health_measurements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
