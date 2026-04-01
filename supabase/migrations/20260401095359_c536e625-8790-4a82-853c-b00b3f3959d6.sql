
CREATE TABLE public.changelogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL DEFAULT 'feature',
  release_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.changelogs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read changelogs
CREATE POLICY "Authenticated users can read changelogs"
ON public.changelogs FOR SELECT TO authenticated
USING (true);

-- Only admins can insert changelogs
CREATE POLICY "Admins can insert changelogs"
ON public.changelogs FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Only admins can update changelogs
CREATE POLICY "Admins can update changelogs"
ON public.changelogs FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Only admins can delete changelogs
CREATE POLICY "Admins can delete changelogs"
ON public.changelogs FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
