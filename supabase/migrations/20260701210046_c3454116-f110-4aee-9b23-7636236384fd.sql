-- BK-02: Ciclos Posológicos Complexos
-- Adiciona suporte a frequency_type = 'cyclic' (ex: anticoncepcional 21+7)
-- cycle_active_days: dias com dose (ex: 21)
-- cycle_pause_days: dias de pausa sem dose (ex: 7)
-- cycle_start_date: data/hora do início do 1º ciclo ativo (âncora de fase)

ALTER TABLE medications
  ADD COLUMN cycle_active_days INT DEFAULT NULL,
  ADD COLUMN cycle_pause_days INT DEFAULT NULL,
  ADD COLUMN cycle_start_date TIMESTAMPTZ DEFAULT NULL;

-- Garante que cyclic sempre tem os 3 campos preenchidos (segurança: sem dose na pausa)
ALTER TABLE medications ADD CONSTRAINT chk_cyclic_fields CHECK (
  frequency_type <> 'cyclic' OR (
    cycle_active_days >= 1 AND
    cycle_pause_days >= 1 AND
    cycle_start_date IS NOT NULL
  )
);

COMMENT ON COLUMN medications.cycle_active_days IS 'BK-02: dias com dose por ciclo (ex: 21 para anticoncepcional)';
COMMENT ON COLUMN medications.cycle_pause_days IS 'BK-02: dias de pausa por ciclo (ex: 7 para anticoncepcional)';
COMMENT ON COLUMN medications.cycle_start_date IS 'BK-02: âncora temporal do ciclo 1 — usada para calcular a fase atual';