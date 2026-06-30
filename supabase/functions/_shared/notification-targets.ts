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

// ─────────────────────────────────────────────────────────────────────────────
// Batch helpers — eliminam N+1 em crons de notificação
// ─────────────────────────────────────────────────────────────────────────────

interface FgmRow {
  auth_user_id: string;
  role: string;
  managed_profiles: string[] | null;
  group_id: string;
}

/**
 * Prefetches all family_group_members for a set of group_ids in ONE query.
 * Eliminates N+1: instead of 1 SELECT per item in a loop, 1 SELECT total.
 */
export async function prefetchGroupFamilyMembers(
  adminClient: SupabaseClient,
  groupIds: string[]
): Promise<Map<string, FgmRow[]>> {
  const uniqueGroupIds = [...new Set(groupIds.filter(Boolean))];
  if (uniqueGroupIds.length === 0) return new Map();

  const { data, error } = await adminClient
    .from("family_group_members")
    .select("auth_user_id, role, managed_profiles, group_id")
    .in("group_id", uniqueGroupIds);

  if (error || !data) return new Map();

  const map = new Map<string, FgmRow[]>();
  for (const row of data as FgmRow[]) {
    if (!row.group_id) continue;
    const list = map.get(row.group_id) ?? [];
    list.push(row);
    map.set(row.group_id, list);
  }
  return map;
}

/**
 * Resolves notification targets from a prefetched FGM map — no DB call.
 */
export function resolveNotificationTargets(
  fgmMap: Map<string, FgmRow[]>,
  familyMemberId: string,
  groupId: string
): string[] {
  if (!familyMemberId || !groupId) return [];
  const members = fgmMap.get(groupId) ?? [];
  return members
    .filter((fgm) => {
      if (!fgm.auth_user_id) return false;
      if (fgm.role === "admin") return true;
      return (
        Array.isArray(fgm.managed_profiles) &&
        fgm.managed_profiles.includes(familyMemberId)
      );
    })
    .map((fgm) => fgm.auth_user_id);
}
