
-- 1. system_settings table
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read system_settings"
ON public.system_settings FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can manage system_settings"
ON public.system_settings FOR ALL TO authenticated
USING (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow all authenticated users to read ai_status specifically
CREATE POLICY "Anyone can read ai_status"
ON public.system_settings FOR SELECT TO authenticated
USING (key = 'ai_status');

-- Insert default ai_status
INSERT INTO public.system_settings (key, value) VALUES ('ai_status', '{"is_active": true}'::jsonb);

-- 2. ai_usage_logs table
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own ai logs"
ON public.ai_usage_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all ai logs"
ON public.ai_usage_logs FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  )
);
