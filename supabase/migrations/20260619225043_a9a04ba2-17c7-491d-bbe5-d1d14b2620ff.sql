-- ============================================================
-- Revogar EXECUTE de funções SECURITY DEFINER não-RLS
-- que não devem ser chamáveis diretamente por authenticated
-- ============================================================

-- Fila de e-mail PGMQ (service_role only)
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, int, int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM authenticated;

-- Operações administrativas
REVOKE EXECUTE ON FUNCTION public.decrement_stock(uuid, int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_test_mode(uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_clients() FROM authenticated;

-- ============================================================
-- NÃO REVOGAR — helpers de RLS (causam regressão se revogadas)
-- is_group_member, is_super_admin, is_group_admin, check_group_access
-- Decisão documentada na security-memory do projeto
-- ============================================================