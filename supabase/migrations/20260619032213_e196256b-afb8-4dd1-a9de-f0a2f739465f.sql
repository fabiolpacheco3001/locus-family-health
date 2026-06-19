ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS credit_card_token TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;

COMMENT ON COLUMN public.subscriptions.credit_card_token IS 'Token do cartão para renovações automáticas sem checkout';
COMMENT ON COLUMN public.subscriptions.asaas_payment_id IS 'ID da última cobrança Asaas (pay_xxx)';