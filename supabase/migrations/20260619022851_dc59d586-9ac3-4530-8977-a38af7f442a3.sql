ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_subscriptions_test_mode
  ON public.subscriptions(test_mode) WHERE test_mode = true;