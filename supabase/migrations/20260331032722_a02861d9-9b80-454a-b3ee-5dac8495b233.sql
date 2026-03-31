
-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asaas_customer_id TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'trialing',
  trial_end TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin can read all subscriptions
CREATE POLICY "Admins can read all subscriptions"
ON public.subscriptions FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admin can write all subscriptions
CREATE POLICY "Admins can manage subscriptions"
ON public.subscriptions FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Users can read their own subscription
CREATE POLICY "Users can read own subscription"
ON public.subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
