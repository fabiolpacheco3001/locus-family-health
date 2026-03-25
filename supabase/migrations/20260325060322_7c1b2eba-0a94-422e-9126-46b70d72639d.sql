ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS medication_id uuid;

CREATE INDEX IF NOT EXISTS idx_notifications_stock_medication_created_at
ON public.notifications (user_id, type, medication_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_stock_medication_unread
ON public.notifications (user_id, type, medication_id, is_read)
WHERE type = 'stock' AND medication_id IS NOT NULL;