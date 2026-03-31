
-- Allow super_admin to update user_roles
CREATE POLICY "Super admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Allow super_admin to insert roles  
CREATE POLICY "Super admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()));
