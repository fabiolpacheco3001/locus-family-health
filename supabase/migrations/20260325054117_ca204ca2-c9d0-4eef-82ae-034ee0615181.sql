
-- Add column to track last stock decrement timestamp
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS last_stock_decrement timestamp with time zone;

-- Create a safe decrement function that never goes below 0
CREATE OR REPLACE FUNCTION public.decrement_stock(med_id uuid, amount integer DEFAULT 1)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE medications
  SET estoque_total = GREATEST(0, COALESCE(estoque_total, 0) - amount),
      last_stock_decrement = now()
  WHERE id = med_id
    AND estoque_total IS NOT NULL
    AND estoque_total > 0
  RETURNING estoque_total;
$$;
