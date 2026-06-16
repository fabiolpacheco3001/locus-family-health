-- Security fix: decrement_stock SECURITY DEFINER lacks ownership check
--
-- Vulnerability (Warning — Lovable RAIO X 2.0):
--   The original function only checked `id = med_id` in the WHERE clause.
--   Any authenticated user who knows or guesses a medication UUID can call
--   decrement_stock(med_id) to modify stock for a medication they do not own.
--
-- Fix: add ownership check in WHERE clause.
--   The caller must either be the creator (user_id = auth.uid()) OR a member
--   of the family group that owns the medication (via family_group_members JOIN).
--
-- Note: SECURITY DEFINER is preserved so the function can UPDATE the table
-- even when the caller's RLS policy does not grant UPDATE. The ownership check
-- provides the authorisation gate instead.

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
    -- Ownership check: caller must be creator or a member of the medication's family group
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.family_group_members fgm
        WHERE fgm.auth_user_id = auth.uid()
          AND fgm.group_id = medications.group_id
      )
    )
  RETURNING estoque_total;
$$;
