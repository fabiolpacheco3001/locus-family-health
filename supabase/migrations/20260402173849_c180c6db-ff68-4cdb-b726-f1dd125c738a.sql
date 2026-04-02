
-- Remove duplicate medication_doses keeping only the oldest per (medication_id, scheduled_for)
DELETE FROM public.medication_doses
WHERE id NOT IN (
  SELECT DISTINCT ON (medication_id, scheduled_for) id
  FROM public.medication_doses
  ORDER BY medication_id, scheduled_for, created_at ASC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.medication_doses
ADD CONSTRAINT medication_doses_med_scheduled_unique UNIQUE (medication_id, scheduled_for);
