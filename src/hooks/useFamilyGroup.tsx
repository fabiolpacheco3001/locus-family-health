import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { createContext, useContext, ReactNode, useMemo } from "react";

export type AppRole = "admin" | "user";

interface FamilyGroupContextType {
  groupId: string | null;
  role: AppRole;
  linkedMemberId: string | null;
  managedProfiles: string[];
  isAdmin: boolean;
  isLoading: boolean;
}

const FamilyGroupContext = createContext<FamilyGroupContextType>({
  groupId: null,
  role: "user",      // least-privilege default during loading (#6 security fix)
  linkedMemberId: null,
  managedProfiles: [],
  isAdmin: false,    // least-privilege default during loading (#6 security fix)
  isLoading: true,
});

export const FamilyGroupProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["family_group_membership", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_group_members" as any)
        .select("group_id, role, family_member_id, managed_profiles")
        .eq("auth_user_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { group_id: string; role: AppRole; family_member_id: string | null; managed_profiles: string[] | null };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const value = useMemo<FamilyGroupContextType>(() => ({
    groupId: query.data?.group_id ?? null,
    role: (query.data?.role as AppRole) ?? "user",
    linkedMemberId: query.data?.family_member_id ?? null,
    managedProfiles: query.data?.managed_profiles ?? [],
    isAdmin: (query.data?.role ?? "user") === "admin",
    isLoading: query.isLoading,
  }), [query.data, query.isLoading]);

  return (
    <FamilyGroupContext.Provider value={value}>
      {children}
    </FamilyGroupContext.Provider>
  );
};

export const useFamilyGroup = () => useContext(FamilyGroupContext);
