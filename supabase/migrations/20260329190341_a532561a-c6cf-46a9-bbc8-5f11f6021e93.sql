ALTER TABLE public.vaccines
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS dose_type text,
  ADD COLUMN IF NOT EXISTS facility text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;