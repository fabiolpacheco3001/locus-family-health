import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";

/**
 * Guard de acesso a perfis de membros familiares.
 * Redireciona para /home com toast.error se o usuário não tiver acesso ao familyMemberId.
 * Retorna { allowed, isLoading }.
 */
export function useFamilyAccessGuard(
  familyMemberId: string | null | undefined
) {
  const navigate = useNavigate();
  const {
    isAdmin,
    linkedMemberId,
    managedProfiles,
    isLoading,
  } = useFamilyGroup();

  const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])].filter(
    Boolean
  ) as string[];

  const allowed =
    !familyMemberId ||
    isLoading ||
    isAdmin ||
    allowedIds.includes(familyMemberId);

  useEffect(() => {
    if (isLoading) return;
    if (!familyMemberId) return;
    if (isAdmin) return;
    if (!allowedIds.includes(familyMemberId)) {
      toast.error("Acesso negado a este perfil.");
      navigate("/home", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAdmin, familyMemberId, linkedMemberId, JSON.stringify(managedProfiles)]);

  return { allowed, isLoading };
}
