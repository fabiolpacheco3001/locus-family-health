-- Fix subscriptions_credit_card_token_exposure finding.
-- Root cause: the "Family members can read owner subscription" policy granted
-- SELECT over the whole row to any family member. Column-level GRANTs already
-- blocked credit_card_token effectively, but the scanner flags the policy text.
-- Solution: remove the family-member policy and expose owner subscription data
-- via a SECURITY DEFINER RPC that returns ONLY non-sensitive columns.

DROP POLICY IF EXISTS "Family members can read owner subscription" ON public.subscriptions;

CREATE OR REPLACE FUNCTION public.get_owner_subscription_safe(_owner_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  plan_type text,
  status text,
  trial_end timestamptz,
  next_billing_date timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  asaas_subscription_id text,
  test_mode boolean,
  asaas_payment_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.user_id, s.plan_type, s.status, s.trial_end, s.next_billing_date,
    s.created_at, s.updated_at, s.asaas_subscription_id, s.test_mode, s.asaas_payment_id
  FROM public.subscriptions s
  WHERE s.user_id = _owner_id
    AND EXISTS (
      SELECT 1
      FROM public.family_group_members fgm
      JOIN public.family_groups fg ON fg.id = fgm.group_id
      WHERE fgm.auth_user_id = auth.uid()
        AND fg.created_by = _owner_id
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_owner_subscription_safe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_subscription_safe(uuid) TO authenticated;