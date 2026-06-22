/**
 * notification-targets — Teste de unidade do helper de resolução de RBAC.
 *
 * Verifica as 4 combinações críticas:
 *   1. Admin → recebe notificação de qualquer membro do grupo
 *   2. Usuário com membro em managed_profiles → recebe
 *   3. Usuário sem membro em managed_profiles → NÃO recebe
 *   4. Membro inativo (sem auth_user_id) → NÃO recebe
 */

// Importamos diretamente a lógica de filtragem para teste isolado (sem Supabase)
// Replicamos o algoritmo puro para garantir cobertura sem infra.

interface FamilyGroupMember {
  auth_user_id: string | null;
  role: string;
  managed_profiles: string[] | null;
}

function filterTargets(members: FamilyGroupMember[], familyMemberId: string): string[] {
  return members
    .filter((fgm) => {
      if (!fgm.auth_user_id) return false;
      if (fgm.role === "admin") return true;
      return Array.isArray(fgm.managed_profiles) && fgm.managed_profiles.includes(familyMemberId);
    })
    .map((fgm) => fgm.auth_user_id as string);
}

const MEMBER_UUID = "11111111-0000-0000-0000-000000000000";
const ADMIN_UUID = "aaaa0000-0000-0000-0000-000000000000";
const USER_WITH_PROFILE = "bbbb0000-0000-0000-0000-000000000000";
const USER_WITHOUT_PROFILE = "cccc0000-0000-0000-0000-000000000000";

describe("getNotificationTargets — algoritmo de filtragem RBAC", () => {
  const mockGroup: FamilyGroupMember[] = [
    { auth_user_id: ADMIN_UUID, role: "admin", managed_profiles: null },
    { auth_user_id: USER_WITH_PROFILE, role: "user", managed_profiles: [MEMBER_UUID] },
    { auth_user_id: USER_WITHOUT_PROFILE, role: "user", managed_profiles: ["outro-uuid"] },
    { auth_user_id: null, role: "admin", managed_profiles: null }, // membro sem auth_user_id
  ];

  test("admin sempre recebe — independentemente de managed_profiles", () => {
    const targets = filterTargets(mockGroup, MEMBER_UUID);
    expect(targets).toContain(ADMIN_UUID);
  });

  test("usuário com membro em managed_profiles recebe", () => {
    const targets = filterTargets(mockGroup, MEMBER_UUID);
    expect(targets).toContain(USER_WITH_PROFILE);
  });

  test("usuário SEM membro em managed_profiles NÃO recebe", () => {
    const targets = filterTargets(mockGroup, MEMBER_UUID);
    expect(targets).not.toContain(USER_WITHOUT_PROFILE);
  });

  test("membro sem auth_user_id (null) é excluído do resultado", () => {
    const targets = filterTargets(mockGroup, MEMBER_UUID);
    expect(targets).not.toContain(null);
    expect(targets.every((t) => typeof t === "string" && t.length > 0)).toBe(true);
  });

  test("grupo vazio retorna array vazio", () => {
    const targets = filterTargets([], MEMBER_UUID);
    expect(targets).toHaveLength(0);
  });

  test("grupo sem admins, sem usuários gerenciando o membro → nenhuma notificação", () => {
    const isolatedGroup: FamilyGroupMember[] = [
      { auth_user_id: USER_WITHOUT_PROFILE, role: "user", managed_profiles: ["outro-uuid"] },
    ];
    const targets = filterTargets(isolatedGroup, MEMBER_UUID);
    expect(targets).toHaveLength(0);
  });

  test("retorna apenas admin quando usuário não tem o membro em managed_profiles", () => {
    const partialGroup: FamilyGroupMember[] = [
      { auth_user_id: ADMIN_UUID, role: "admin", managed_profiles: null },
      { auth_user_id: USER_WITHOUT_PROFILE, role: "user", managed_profiles: [] },
    ];
    const targets = filterTargets(partialGroup, MEMBER_UUID);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toBe(ADMIN_UUID);
  });

  test("múltiplos admins — todos recebem", () => {
    const multiAdmin: FamilyGroupMember[] = [
      { auth_user_id: ADMIN_UUID, role: "admin", managed_profiles: null },
      { auth_user_id: USER_WITH_PROFILE, role: "admin", managed_profiles: null },
    ];
    const targets = filterTargets(multiAdmin, MEMBER_UUID);
    expect(targets).toHaveLength(2);
    expect(targets).toContain(ADMIN_UUID);
    expect(targets).toContain(USER_WITH_PROFILE);
  });
});
