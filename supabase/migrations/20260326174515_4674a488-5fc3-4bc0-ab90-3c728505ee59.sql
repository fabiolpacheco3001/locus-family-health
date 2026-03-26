
-- Allow authenticated users to insert new family_groups (needed for orphan account provisioning)
CREATE POLICY "Authenticated users can create groups"
ON public.family_groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);
