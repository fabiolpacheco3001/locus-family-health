-- Security fix: "Allow invitees to join group" INSERT policy on family_group_members
--
-- Vulnerability (Critical — Lovable scanner):
--   The existing policy verified that a group_invite exists for the user's email+group
--   but did NOT enforce:
--   (1) auth_user_id = auth.uid()  → attacker with valid invite could add a third party
--   (2) role = 'user'              → attacker could self-assign 'admin' role
--
-- Fix: drop and recreate with both WITH CHECK conditions.
--
-- Side effect: inviting someone as 'admin' via GestaoAcessos no longer takes effect on
-- join — invitees always join as 'user'. Explicit admin promotion remains possible via
-- the existing Admins can manage group members UPDATE policy.

DROP POLICY IF EXISTS "Allow invitees to join group" ON public.family_group_members;

CREATE POLICY "Allow invitees to join group"
ON public.family_group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- (1) Can only insert a row for yourself
  auth_user_id = auth.uid()
  -- (2) Can only join as 'user', never self-assign 'admin'
  AND role = 'user'::app_role
  -- (3) A pending invite must exist for the current user's email + target group
  AND EXISTS (
    SELECT 1
    FROM public.group_invites gi
    JOIN auth.users u ON u.email = gi.email
    WHERE gi.group_id = family_group_members.group_id
      AND u.id         = auth.uid()
      AND gi.accepted_at IS NULL
  )
);
