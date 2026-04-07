ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS frequency_type text NOT NULL DEFAULT 'fixed_interval',
  ADD COLUMN IF NOT EXISTS specific_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS specific_days jsonb NOT NULL DEFAULT '[]'::jsonb;