-- Migration: 20260615000008_perf_clinical_tables_indexes
--
-- ALTO — A11: Tabelas clínicas sem índice em family_member_id e user_id
--   Toda listagem de dados clínicos (consultas, exames, medicamentos, vacinas...)
--   faz full scan nas tabelas sem índice nessas colunas de filtro.
--
-- MÉDIO — M15: Índices parciais ausentes
--   medications WHERE status='Ativo', notifications WHERE is_read=false,
--   email_send_log WHERE status='pending'
--
-- MÉDIO — M16: blood_pressure_history e menstrual_cycles sem FK constraint
--   em familiar_id — colunas uuid NOT NULL sem referência formal.
--
-- BAIXO — B7: changelogs e group_invites sem índices nas colunas de filtro

-- ============================================================
-- 1. consultations
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_consultations_family_member_id
  ON public.consultations (family_member_id);

CREATE INDEX IF NOT EXISTS idx_consultations_user_id
  ON public.consultations (user_id);

-- Índice parcial: exclui canceladas (padrão de filtro em useClinicalTimeline)
CREATE INDEX IF NOT EXISTS idx_consultations_active
  ON public.consultations (family_member_id, consultation_date DESC)
  WHERE status != 'Cancelada';

-- ============================================================
-- 2. exams
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_exams_family_member_id
  ON public.exams (family_member_id);

CREATE INDEX IF NOT EXISTS idx_exams_user_id
  ON public.exams (user_id);

CREATE INDEX IF NOT EXISTS idx_exams_active
  ON public.exams (family_member_id, exam_date DESC)
  WHERE status != 'Cancelado';

-- ============================================================
-- 3. medications (tabela mais consultada da aplicação)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_medications_family_member_id
  ON public.medications (family_member_id);

CREATE INDEX IF NOT EXISTS idx_medications_user_id
  ON public.medications (user_id);

-- Índice parcial crítico: cobre a query mais frequente (listar medicamentos ativos)
CREATE INDEX IF NOT EXISTS idx_medications_active
  ON public.medications (family_member_id)
  WHERE status = 'Ativo';

-- ============================================================
-- 4. vaccines
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vaccines_family_member_id
  ON public.vaccines (family_member_id);

CREATE INDEX IF NOT EXISTS idx_vaccines_user_id
  ON public.vaccines (user_id);

-- ============================================================
-- 5. allergies
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_allergies_family_member_id
  ON public.allergies (family_member_id);

CREATE INDEX IF NOT EXISTS idx_allergies_user_id
  ON public.allergies (user_id);

-- ============================================================
-- 6. diseases
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_diseases_family_member_id
  ON public.diseases (family_member_id);

CREATE INDEX IF NOT EXISTS idx_diseases_user_id
  ON public.diseases (user_id);

-- ============================================================
-- 7. health_measurements
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_health_measurements_family_member_id
  ON public.health_measurements (family_member_id);

CREATE INDEX IF NOT EXISTS idx_health_measurements_user_id
  ON public.health_measurements (user_id);

CREATE INDEX IF NOT EXISTS idx_health_measurements_recorded_at
  ON public.health_measurements (family_member_id, recorded_at DESC);

-- ============================================================
-- 8. blood_pressure_history — FK constraint + índice (M16)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_blood_pressure_history_familiar_id
  ON public.blood_pressure_history (familiar_id);

CREATE INDEX IF NOT EXISTS idx_blood_pressure_history_user_id
  ON public.blood_pressure_history (user_id);

CREATE INDEX IF NOT EXISTS idx_blood_pressure_history_date
  ON public.blood_pressure_history (familiar_id, measurement_date DESC);

-- FK constraint em familiar_id (ausente no schema original)
-- Garante integridade referencial: não pode existir medição de PA sem membro familiar
ALTER TABLE public.blood_pressure_history
  ADD CONSTRAINT fk_blood_pressure_history_family_member
  FOREIGN KEY (familiar_id)
  REFERENCES public.family_members (id)
  ON DELETE CASCADE;

-- ============================================================
-- 9. menstrual_cycles — FK constraint + índice (M16)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_familiar_id
  ON public.menstrual_cycles (familiar_id);

CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_user_id
  ON public.menstrual_cycles (user_id);

-- FK constraint em familiar_id (ausente no schema original)
ALTER TABLE public.menstrual_cycles
  ADD CONSTRAINT fk_menstrual_cycles_family_member
  FOREIGN KEY (familiar_id)
  REFERENCES public.family_members (id)
  ON DELETE CASCADE;

-- ============================================================
-- 10. notifications — índice parcial WHERE is_read = false (M15)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- ============================================================
-- 11. email_send_log — índice parcial WHERE status = 'pending' (M15)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_email_send_log_pending
  ON public.email_send_log (created_at)
  WHERE status = 'pending';

-- ============================================================
-- 12. ai_usage_logs — índice para rate limiting e auditoria
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id
  ON public.ai_usage_logs (user_id, created_at DESC);

-- ============================================================
-- 13. changelogs — índice para ordenação (B7)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_changelogs_created_at
  ON public.changelogs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_changelogs_release_date
  ON public.changelogs (release_date DESC);

-- ============================================================
-- 14. group_invites — índices em colunas de filtro (B7)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_group_invites_group_id
  ON public.group_invites (group_id);

CREATE INDEX IF NOT EXISTS idx_group_invites_email
  ON public.group_invites (email);

-- Índice composto: cobre lookup de convite por email + grupo (aceitar convite)
CREATE INDEX IF NOT EXISTS idx_group_invites_email_group
  ON public.group_invites (email, group_id);
