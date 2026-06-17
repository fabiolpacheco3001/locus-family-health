-- M18: Adiciona coluna queue_name à email_send_state para lookup semântico
--
-- A tabela usa padrão singleton (CHECK id = 1), mas o código usava .eq('id', 1)
-- que quebraria silenciosamente se a tabela fosse recriada com outro ID.
-- Solução: adicionar queue_name TEXT NOT NULL DEFAULT 'default' e usar
-- .eq('queue_name', 'default') no código — semântico e resiliente.

ALTER TABLE public.email_send_state
  ADD COLUMN IF NOT EXISTS queue_name TEXT NOT NULL DEFAULT 'default';

-- Garantir unicidade por queue_name (futuro: múltiplas filas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_state_queue_name
  ON public.email_send_state (queue_name);
