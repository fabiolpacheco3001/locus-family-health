import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type PendingInvite = {
  id: string;
  group_id: string;
  role: string;
  family_member_id: string | null;
  group_name?: string;
};

type InterceptorState =
  | { step: "loading" }
  | { step: "invite"; invite: PendingInvite }
  | { step: "provisioning" }
  | { step: "ready" }
  | { step: "error"; message: string };

const MAX_RETRIES = 3;
const RETRY_DELAY = 1500;

const InviteAcceptInterceptor = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { groupId, isLoading: groupLoading } = useFamilyGroup();
  const queryClient = useQueryClient();

  const [state, setState] = useState<InterceptorState>({ step: "loading" });
  const [accepting, setAccepting] = useState(false);

  const provisionNewGroup = useCallback(async () => {
    if (!user) return;
    setState({ step: "provisioning" });
    try {
      const { data: newGroup, error: gErr } = await supabase
        .from("family_groups")
        .insert({ created_by: user.id, name: "Minha Família" } as any)
        .select("id")
        .single();
      if (gErr) throw gErr;

      const gId = (newGroup as any).id;

      const { error: mErr } = await supabase
        .from("family_group_members" as any)
        .insert({
          group_id: gId,
          auth_user_id: user.id,
          role: "admin",
          accepted_at: new Date().toISOString(),
        } as any);
      if (mErr) throw mErr;

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

      await supabase
        .from("family_group_members" as any)
        .update({ family_member_id: (newMember as any).id } as any)
        .eq("auth_user_id", user.id)
        .eq("group_id", gId);

      queryClient.invalidateQueries({ queryKey: ["family_group_membership"] });
      queryClient.invalidateQueries({ queryKey: ["family_members"] });
      setState({ step: "ready" });
    } catch (err: any) {
      console.error("[InviteInterceptor] provisionNewGroup error:", err);
      // If it's a duplicate key / already exists, try to recover
      const isDuplicate = err?.code === "23505";
      if (isDuplicate) {
        queryClient.invalidateQueries({ queryKey: ["family_group_membership"] });
        queryClient.invalidateQueries({ queryKey: ["family_members"] });
        setState({ step: "ready" });
        return;
      }
      toast.error("Erro ao configurar sua conta. Recarregue a página.");
      setState({ step: "error", message: "Erro ao configurar conta." });
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (!user || groupLoading) return;

    // User already has a group — nothing to do
    if (groupId) {
      setState({ step: "ready" });
      return;
    }

    // Orphan account: check for pending invite WITH retries
    let cancelled = false;
    let retryCount = 0;

    const checkInvite = async () => {
      const email = user.email?.toLowerCase();
      if (!email) {
        // No email — can't match invite, provision directly
        await provisionNewGroup();
        return;
      }

      setState({ step: "loading" });

      while (retryCount < MAX_RETRIES && !cancelled) {
        const { data, error } = await supabase
          .from("group_invites" as any)
          .select("id, group_id, role, family_member_id")
          .eq("email", email)
          .is("accepted_at", null)
          .limit(1);

        if (cancelled) return;

        if (error) {
          retryCount++;
          console.warn(`[InviteInterceptor] Invite query attempt ${retryCount} failed:`, error.message);
          if (retryCount < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY));
            continue;
          }
          // All retries exhausted — DO NOT auto-provision, show error
          toast.error("Erro ao verificar convites. Recarregue a página.");
          setState({ step: "error", message: "Não foi possível verificar convites pendentes." });
          return;
        }

        // Query succeeded
        if (data && data.length > 0) {
          const inv = (data as unknown as PendingInvite[])[0];
          // Try to get group name (non-critical)
          const { data: grp } = await supabase
            .from("family_groups")
            .select("name")
            .eq("id", inv.group_id)
            .single();

          if (!cancelled) {
            setState({
              step: "invite",
              invite: { ...inv, group_name: (grp as any)?.name ?? "uma família" },
            });
          }
          return;
        }

        // No invite found — safe to provision
        if (!cancelled) {
          await provisionNewGroup();
        }
        return;
      }
    };

    checkInvite();

    return () => { cancelled = true; };
  }, [user, groupId, groupLoading, provisionNewGroup]);

  const handleAccept = async () => {
    if (state.step !== "invite" || !user) return;
    const { invite } = state;
    setAccepting(true);
    try {
      // Check if already a member (prevent duplicate key error)
      const { data: existing } = await supabase
        .from("family_group_members" as any)
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("group_id", invite.group_id)
        .limit(1);

      if (existing && (existing as any[]).length > 0) {
        // Already a member — just mark invite as accepted and proceed
        await supabase
          .from("group_invites" as any)
          .update({ accepted_at: new Date().toISOString() } as any)
          .eq("id", invite.id);

        toast.success("Você já faz parte desta família!");
        queryClient.invalidateQueries({ queryKey: ["family_group_membership"] });
        queryClient.invalidateQueries({ queryKey: ["family_members"] });
        setState({ step: "ready" });
        return;
      }

      // Auto-provision profile if invite has no linked family_member_id
      let finalMemberId = invite.family_member_id;

      if (!finalMemberId) {
        const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Familiar";
        const { data: newMember, error: profileErr } = await supabase
          .from("family_members")
          .insert({
            user_id: user.id,
            name: displayName,
            relationship: "Familiar",
            member_type: "human",
            group_id: invite.group_id,
          })
          .select("id")
          .single();
        if (profileErr) throw profileErr;
        finalMemberId = (newMember as any).id;
      }

      const { error: insertErr } = await supabase
        .from("family_group_members" as any)
        .insert({
          group_id: invite.group_id,
          auth_user_id: user.id,
          role: invite.role,
          family_member_id: finalMemberId,
          accepted_at: new Date().toISOString(),
        } as any);

      if (insertErr) throw insertErr;

      await supabase
        .from("group_invites" as any)
        .update({ accepted_at: new Date().toISOString() } as any)
        .eq("id", invite.id);

      toast.success("Convite aceito! Bem-vindo à família.");
      queryClient.invalidateQueries({ queryKey: ["family_group_membership"] });
      queryClient.invalidateQueries({ queryKey: ["family_members"] });
      setState({ step: "ready" });
    } catch (err: any) {
      console.error("Erro detalhado do Aceite:", err);
      const isDuplicate = err?.code === "23505";
      toast.error(
        isDuplicate
          ? "Você já faz parte desta família."
          : "Erro ao aceitar convite. Contate o administrador."
      );
    } finally {
      setAccepting(false);
    }
  };

  const handleRetry = () => {
    setState({ step: "loading" });
    queryClient.invalidateQueries({ queryKey: ["family_group_membership"] });
  };

  // Global loader
  if (state.step === "loading" || state.step === "provisioning" || groupLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f2f0eb] z-50">
        <img
          src="/logo-locus-vita-icon.jpeg"
          alt="Locus Vita"
          className="w-20 h-20 animate-breathing rounded-2xl"
        />
      </div>
    );
  }

  // Error state with retry
  if (state.step === "error") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f2f0eb] z-50 px-6">
        <div className="bg-card rounded-2xl shadow-lg border border-border/40 p-8 max-w-sm w-full text-center space-y-6">
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <Button
            onClick={handleRetry}
            className="w-full h-12 rounded-xl bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-black font-semibold"
          >
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // Invite acceptance screen — BLOCKS all other rendering
  if (state.step === "invite") {
    const { invite } = state;
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f2f0eb] z-50 px-6">
        <div className="bg-card rounded-2xl shadow-lg border border-border/40 p-8 max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#A7D3CB]/20 flex items-center justify-center mx-auto">
            <ShieldCheck size={32} className="text-[#A7D3CB]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Acesso Liberado!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Identificamos que o seu e-mail possui acesso liberado à conta familiar do aplicativo Locus Vita, com permissão de{" "}
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
              "Acessar Conta Familiar"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default InviteAcceptInterceptor;
