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
  role: "admin",
  linkedMemberId: null,
  managedProfiles: [],
  isAdmin: true,
  isLoading: true,
});

export const FamilyGroupProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["family_group_membership", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_group_members" as any)
        .select("group_id, role, family_member_id")
        .eq("auth_user_id", user!.id)
        .limit(1)
        .single();
      if (error) throw error;
      return data as unknown as { group_id: string; role: AppRole; family_member_id: string | null };
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const value = useMemo<FamilyGroupContextType>(() => ({
    groupId: (query.data as any)?.group_id ?? null,
    role: ((query.data as any)?.role as AppRole) ?? "admin",
    linkedMemberId: (query.data as any)?.family_member_id ?? null,
    isAdmin: ((query.data as any)?.role ?? "admin") === "admin",
    isLoading: query.isLoading,
  }), [query.data, query.isLoading]);

  return (
    <FamilyGroupContext.Provider value={value}>
      {children}
    </FamilyGroupContext.Provider>
  );
};

export const useFamilyGroup = () => useContext(FamilyGroupContext);
