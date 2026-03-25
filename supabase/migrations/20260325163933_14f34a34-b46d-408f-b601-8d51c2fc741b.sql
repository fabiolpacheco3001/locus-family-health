ALTER TABLE public.menstrual_cycles ADD COLUMN cycle_length integer NOT NULL DEFAULT 28;
ALTER TABLE public.menstrual_cycles ADD COLUMN alert_advance_days integer NOT NULL DEFAULT 2;