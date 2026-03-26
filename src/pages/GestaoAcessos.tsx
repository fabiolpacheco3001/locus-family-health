import { useState } from "react";
import { ArrowLeft, Shield, UserPlus, Crown, User as UserIcon, Loader2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import useSmartBack from "@/hooks/useSmartBack";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MemberAvatar from "@/components/MemberAvatar";
import { toast } from "sonner";
import FixedFAB from "@/components/ui/FixedFAB";

const INPUT_CLASSES = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none";

type GroupMember = {
  id: string;
  auth_user_id: string;
  role: string;
  family_member_id: string | null;
  invited_at: string;
  accepted_at: string | null;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  family_member_id: string | null;
  created_at: string;
  accepted_at: string | null;
};

const GestaoAcessos = () => {
  const goBack = useSmartBack();
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
  const { members } = useFamilyMembers();
  const queryClient = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const [inviteMemberId, setInviteMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "member" | "invite"; id: string } | null>(null);

  // Fetch active group members
  const { data: groupMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_group_members" as any)
        .select("id, auth_user_id, role, family_member_id, invited_at, accepted_at")
        .eq("group_id", groupId!);
      if (error) throw error;
      return (data as unknown as GroupMember[]) ?? [];
    },
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch pending invites
  const { data: pendingInvites = [], isLoading: loadingInvites } = useQuery({
    queryKey: ["group_invites", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_invites" as any)
        .select("id, email, role, family_member_id, created_at, accepted_at")
        .eq("group_id", groupId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Invite[]) ?? [];
    },
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000,
  });

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return null;
    return members.find(m => m.id === memberId)?.name ?? "Perfil removido";
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !groupId || !user) return;
    if (inviteRole === "user" && !inviteMemberId) {
      toast.error("Selecione o perfil vinculado para usuários.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("group_invites" as any).insert({
        group_id: groupId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        family_member_id: inviteRole === "user" ? inviteMemberId : null,
        invited_by: user.id,
      } as any);

      if (error) throw error;

      toast.success("Convite salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
      setDrawerOpen(false);
      resetForm();
    } catch {
      toast.error("Erro ao salvar convite.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("group_invites" as any)
        .delete()
        .eq("id", inviteId);
      if (error) throw error;
      toast.success("Convite removido.");
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
    } catch {
      toast.error("Erro ao remover convite.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("family_group_members" as any)
        .delete()
        .eq("id", memberId);
      if (error) throw error;
      toast.success("Acesso removido.");
      queryClient.invalidateQueries({ queryKey: ["group_members", groupId] });
    } catch {
      toast.error("Erro ao remover acesso.");
    }
  };

  const resetForm = () => {
    setInviteEmail("");
    setInviteRole("user");
    setInviteMemberId("");
  };

  const isLoading = loadingMembers || loadingInvites;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors [@media(hover:hover)]:hover:bg-muted active:bg-muted/60"
          >
            <ArrowLeft size={22} className="text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            <h1 className="text-lg font-bold text-foreground">Gestão de Acessos</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pb-32 space-y-6">
        {/* Section: Active Members */}
        <div>
          <div className="flex items-center gap-2 mb-3 mt-2">
            <Crown size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Membros com Acesso</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center p-4 bg-card rounded-xl border border-border/50">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex flex-col ml-3 flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {groupMembers.map(gm => {
                const linkedMember = members.find(m => m.id === gm.family_member_id);
                const isCurrentUser = gm.auth_user_id === user?.id;
                return (
                  <div
                    key={gm.id}
                    className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border/40 shadow-sm"
                  >
                    <MemberAvatar
                      avatarUrl={linkedMember?.avatar_url ?? null}
                      name={linkedMember?.name ?? "?"}
                      size="md"
                      memberType={linkedMember?.member_type}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {linkedMember?.name ?? "Sem perfil vinculado"}
                        </p>
                        {isCurrentUser && (
                          <span className="text-[10px] text-muted-foreground font-medium">(Você)</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {gm.family_member_id ? linkedMember?.relationship : "Todos os perfis"}
                      </p>
                    </div>
                    <Badge
                      className={
                        gm.role === "admin"
                          ? "bg-[#1C3333] text-white border-none text-[10px] px-2"
                          : "bg-[#AEE2D4] text-slate-800 border-none text-[10px] px-2"
                      }
                    >
                      {gm.role === "admin" ? "Admin" : "Usuário"}
                    </Badge>
                    {!isCurrentUser && (
                      <button
                        onClick={() => setDeleteTarget({ type: "member", id: gm.id })}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)]:hover:bg-destructive/10 [@media(hover:hover)]:hover:text-destructive active:bg-destructive/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section: Pending Invites */}
        {pendingInvites.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Mail size={18} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Convites Pendentes</h2>
            </div>
            <div className="space-y-3">
              {pendingInvites.map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border/40 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.family_member_id ? `Perfil: ${getMemberName(inv.family_member_id)}` : "Acesso total"}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] px-2">
                    {inv.role === "admin" ? "Admin" : "Usuário"}
                  </Badge>
                  <button
                    onClick={() => setDeleteTarget({ type: "invite", id: inv.id })}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)]:hover:bg-destructive/10 [@media(hover:hover)]:hover:text-destructive active:bg-destructive/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Admin:</strong> acesso completo a todos os perfis e dados da família.{" "}
            <strong className="text-foreground">Usuário:</strong> acesso limitado ao perfil vinculado (só vê e edita seus próprios dados).
          </p>
        </div>
      </div>

      {/* FAB */}
      <FixedFAB onClick={() => { resetForm(); setDrawerOpen(true); }} visible={!drawerOpen} />

      {/* Invite Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <UserPlus size={20} className="text-primary" />
              Convidar Pessoa
            </DrawerTitle>
            <DrawerDescription>
              Envie um convite para alguém acessar a conta da família.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 overscroll-contain">
            {/* Email */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">E-mail do Convidado</Label>
              <Input
                type="email"
                placeholder="pessoa@email.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className={INPUT_CLASSES}
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nível de Acesso</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setInviteRole("admin")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    inviteRole === "admin"
                      ? "border-[#1C3333] bg-[#1C3333]/5"
                      : "border-border bg-card"
                  }`}
                >
                  <Crown size={24} className={inviteRole === "admin" ? "text-[#1C3333]" : "text-muted-foreground"} />
                  <span className={`text-sm font-semibold ${inviteRole === "admin" ? "text-[#1C3333]" : "text-muted-foreground"}`}>
                    Admin
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    Vê e edita tudo
                  </span>
                </button>
                <button
                  onClick={() => setInviteRole("user")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    inviteRole === "user"
                      ? "border-[#A7D3CB] bg-[#A7D3CB]/10"
                      : "border-border bg-card"
                  }`}
                >
                  <UserIcon size={24} className={inviteRole === "user" ? "text-[#1C3333]" : "text-muted-foreground"} />
                  <span className={`text-sm font-semibold ${inviteRole === "user" ? "text-[#1C3333]" : "text-muted-foreground"}`}>
                    Usuário
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    Só vê o seu perfil
                  </span>
                </button>
              </div>
            </div>

            {/* Linked Profile (only for User role) */}
            {inviteRole === "user" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Perfil Vinculado</Label>
                <Select value={inviteMemberId} onValueChange={setInviteMemberId}>
                  <SelectTrigger className={INPUT_CLASSES}>
                    <SelectValue placeholder="Selecione o familiar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.relationship})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Este usuário só poderá ver e editar dados vinculados a este perfil.
                </p>
              </div>
            )}
          </div>

          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1 rounded-xl">Cancelar</Button>
            </DrawerClose>
            <Button
              onClick={handleSendInvite}
              disabled={saving || !inviteEmail.trim()}
              className="flex-1 rounded-xl bg-[#1C3333] text-white [@media(hover:hover)]:hover:bg-[#1C3333]/90"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : "Salvar Convite"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[320px] rounded-[24px] w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "member"
                ? "Deseja remover o acesso desta pessoa? Ela não poderá mais entrar na conta da família."
                : "Deseja cancelar este convite pendente?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget?.type === "member") handleRemoveMember(deleteTarget.id);
                else if (deleteTarget?.type === "invite") handleDeleteInvite(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground [@media(hover:hover)]:hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GestaoAcessos;
