
CREATE TABLE public.system_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read configs
CREATE POLICY "Authenticated users can read configs"
ON public.system_configs FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage configs
CREATE POLICY "Admins can manage configs"
ON public.system_configs FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Seed initial rows
INSERT INTO public.system_configs (key, value, description) VALUES
  ('support_url', '', 'URL do portal de suporte (ex: Zoho, Zendesk). Se preenchido, o botão de suporte abrirá este link.'),
  ('support_email', 'suporte@locustech.com.br', 'E-mail de atendimento usado como fallback quando a URL de suporte não está configurada.');
