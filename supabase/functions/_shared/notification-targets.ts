/**
 * notification-targets.ts — Resolução de destinatários de push por RBAC.
 *
 * Regras:
 *  - Usuários ADMIN do grupo familiar recebem notificações de TODOS os membros.
 *  - Usuários regulares (role = 'user') recebem apenas se o family_member_id
 *    estiver em seu array managed_profiles.
 *
 * Usado por: send-medication-reminders, send-appointment-reminders
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

/**
 * Retorna a lista de auth_user_ids que devem receber uma notificação push
 * relacionada a um dado family_member em um grupo familiar.
 *
 * @param adminClient  - Cliente Supabase com service_role (bypassa RLS)
 * @param familyMemberId - UUID do membro familiar que gerou o evento
 * @param groupId        - UUID do grupo familiar ao qual o membro pertence
 * @returns Array de auth_user_ids qualificados (pode ser vazio)
 */
export async function getNotificationTargets(
  adminClient: SupabaseClient,
  familyMemberId: string,
  groupId: string
): Promise<string[]> {
  if (!familyMemberId || !groupId) return [];

  const { data, error } = await adminClient
    .from("family_group_members")
    .select("auth_user_id, role, managed_profiles")
    .eq("group_id", groupId);

  if (error || !data) return [];

  return data
    .filter((fgm) => {
      if (!fgm.auth_user_id) return false;
      // Admin: recebe tudo
      if (fgm.role === "admin") return true;
      // Usuário regular: recebe apenas se gerencia este membro
      return (
        Array.isArray(fgm.managed_profiles) &&
        fgm.managed_profiles.includes(familyMemberId)
      );
    })
    .map((fgm) => fgm.auth_user_id as string);
}
