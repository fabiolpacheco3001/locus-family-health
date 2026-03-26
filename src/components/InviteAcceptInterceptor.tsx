import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Users, PartyPopper } from "lucide-react";
import { toast } from "sonner";

type PendingInvite = {
  id: string;
  group_id: string;
  role: string;
  family_member_id: string | null;
  group_name?: string;
};

const InviteAcceptInterceptor = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { groupId, isLoading: groupLoading } = useFamilyGroup();
  const queryClient = useQueryClient();

  const [checking, setChecking] = useState(true);
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    if (!user || groupLoading) return;

    // User already has a group — nothing to do
    if (groupId) {
      setChecking(false);
      return;
    }

    // Orphan account: check for pending invite
    const checkInvite = async () => {
      const email = user.email?.toLowerCase();
      if (!email) {
        await provisionNewGroup();
        return;
      }

      const { data, error } = await supabase
        .from("group_invites" as any)
        .select("id, group_id, role, family_member_id")
        .eq("email", email)
        .is("accepted_at", null)
        .limit(1);

      if (error || !data || data.length === 0) {
        // No invite found → provision new group
        await provisionNewGroup();
        return;
      }

      const inv = (data as unknown as PendingInvite[])[0];

      // Try to get group name
      const { data: grp } = await supabase
        .from("family_groups")
        .select("name")
        .eq("id", inv.group_id)
        .single();

      setInvite({ ...inv, group_name: (grp as any)?.name ?? "uma família" });
      setChecking(false);
    };

    const provisionNewGroup = async () => {
      setProvisioning(true);
      try {
        // Create group
        const { data: newGroup, error: gErr } = await supabase
          .from("family_groups")
          .insert({ created_by: user.id, name: "Minha Família" } as any)
          .select("id")
          .single();

        if (gErr) throw gErr;

        const gId = (newGroup as any).id;

        // Create membership as admin
        const { error: mErr } = await supabase
          .from("family_group_members" as any)
          .insert({
            group_id: gId,
            auth_user_id: user.id,
            role: "admin",
            accepted_at: new Date().toISOString(),
          } as any);

        if (mErr) throw mErr;

        // Create titular family member
        const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Titular";
        const { data: newMember, error: fErr } = await supabase
          .from("family_members")
          .insert({
            user_id: user.id,
            name: displayName,
            relationship: "Titular",
            member_type: "human",
            group_id: gId,
          })
          .select("id")
          .single();

        if (fErr) throw fErr;

        // Link membership to the titular member
        await supabase
          .from("family_group_members" as any)
          .update({ family_member_id: (newMember as any).id } as any)
          .eq("auth_user_id", user.id)
          .eq("group_id", gId);

        // Refresh context
        queryClient.invalidateQueries({ queryKey: ["family_group_membership"] });
        queryClient.invalidateQueries({ queryKey: ["family_members"] });
      } catch {
        toast.error("Erro ao configurar sua conta. Recarregue a página.");
      } finally {
        setProvisioning(false);
        setChecking(false);
      }
    };

    checkInvite();
  }, [user, groupId, groupLoading, queryClient]);

  const handleAccept = async () => {
    if (!invite || !user) return;
    setAccepting(true);
    try {
      // Insert into family_group_members
      const { error: insertErr } = await supabase
        .from("family_group_members" as any)
        .insert({
          group_id: invite.group_id,
          auth_user_id: user.id,
          role: invite.role,
          family_member_id: invite.family_member_id,
          accepted_at: new Date().toISOString(),
        } as any);

      if (insertErr) throw insertErr;

      // Mark invite as accepted
      await supabase
        .from("group_invites" as any)
        .update({ accepted_at: new Date().toISOString() } as any)
        .eq("id", invite.id);

      toast.success("Convite aceito! Bem-vindo à família.");
      queryClient.invalidateQueries({ queryKey: ["family_group_membership"] });
      queryClient.invalidateQueries({ queryKey: ["family_members"] });
      setInvite(null);
    } catch {
      toast.error("Erro ao aceitar convite. Tente novamente.");
    } finally {
      setAccepting(false);
    }
  };

  // Still loading
  if (groupLoading || checking || provisioning) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f2f0eb] z-50">
        <img
          src="/logo-locus-vita.svg"
          alt="Locus Vita"
          className="w-20 h-20 animate-breathing"
        />
      </div>
    );
  }

  // Show invite acceptance screen
  if (invite) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f2f0eb] z-50 px-6">
        <div className="bg-card rounded-2xl shadow-lg border border-border/40 p-8 max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#A7D3CB]/20 flex items-center justify-center mx-auto">
            <PartyPopper size={32} className="text-[#1C3333]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Você foi convidado!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Você recebeu um convite para participar da família{" "}
              <strong className="text-foreground">{invite.group_name}</strong> como{" "}
              <strong className="text-foreground">
                {invite.role === "admin" ? "Administrador" : "Usuário"}
              </strong>
              .
            </p>
          </div>
          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full h-12 rounded-xl bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-black font-semibold text-base border-none"
          >
            {accepting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Users size={18} className="mr-2" />
                Aceitar Convite
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default InviteAcceptInterceptor;
