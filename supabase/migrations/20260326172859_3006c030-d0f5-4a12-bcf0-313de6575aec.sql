
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE auth_user_id = _user_id AND group_id = _group_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE auth_user_id = _user_id AND group_id = _group_id AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Members can view group members" ON public.family_group_members;
DROP POLICY IF EXISTS "Admins can manage group members" ON public.family_group_members;

CREATE POLICY "Members can view group members"
ON public.family_group_members FOR SELECT TO authenticated
USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Admins can manage group members"
ON public.family_group_members FOR ALL TO authenticated
USING (public.is_group_admin(auth.uid(), group_id))
WITH CHECK (public.is_group_admin(auth.uid(), group_id));

DROP POLICY IF EXISTS "Members can view their group" ON public.family_groups;
DROP POLICY IF EXISTS "Admins can update their group" ON public.family_groups;

CREATE POLICY "Members can view their group"
ON public.family_groups FOR SELECT TO authenticated
USING (public.is_group_member(auth.uid(), id));

CREATE POLICY "Admins can update their group"
ON public.family_groups FOR UPDATE TO authenticated
USING (public.is_group_admin(auth.uid(), id));

DROP POLICY IF EXISTS "Admins can manage group invites" ON public.group_invites;

CREATE POLICY "Admins can manage group invites"
ON public.group_invites FOR ALL TO authenticated
USING (public.is_group_admin(auth.uid(), group_id))
WITH CHECK (public.is_group_admin(auth.uid(), group_id));
