/**
 * Shared sort utility for family members.
 * New hierarchy: Admins first, then relationship order, pets last.
 */

const relationshipOrder: Record<string, number> = {
  "Cônjuge": 1,
  "Filho(a)": 2,
  "Pai/Mãe": 3,
  "Irmão(ã)": 4,
  "Outro": 5,
  "Titular": 5, // treated same as "Outro" — no longer top priority
};

interface SortableMember {
  id: string;
  relationship?: string | null;
  member_type?: string | null;
  created_at?: string;
}

/**
 * Sort members: admins first (oldest first), then by relationship hierarchy, pets last.
 * @param members - array of family members
 * @param roleMap - optional map of member id → role string (e.g. "admin" | "user")
 */
export function sortFamilyMembers<T extends SortableMember>(
  members: T[],
  roleMap?: Map<string, string>,
): T[] {
  return [...members].sort((a, b) => {
    const roleA = roleMap?.get(a.id);
    const roleB = roleMap?.get(b.id);
    const isAdminA = roleA === "admin";
    const isAdminB = roleB === "admin";
    const isPetA = a.member_type === "pet" || a.relationship === "Pet";
    const isPetB = b.member_type === "pet" || b.relationship === "Pet";

    // 1. Admins always first
    if (isAdminA && !isAdminB) return -1;
    if (!isAdminA && isAdminB) return 1;
    if (isAdminA && isAdminB) {
      // Oldest admin first
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    }

    // 2. Pets always last
    if (isPetA && !isPetB) return 1;
    if (!isPetA && isPetB) return -1;

    // 3. Relationship hierarchy
    const weightA = relationshipOrder[a.relationship ?? ""] ?? 99;
    const weightB = relationshipOrder[b.relationship ?? ""] ?? 99;
    return weightA - weightB;
  });
}
