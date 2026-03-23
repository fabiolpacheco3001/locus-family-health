
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS uso_continuo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS medico_prescritor text,
  ADD COLUMN IF NOT EXISTS estoque_total integer,
  ADD COLUMN IF NOT EXISTS estoque_minimo integer;
