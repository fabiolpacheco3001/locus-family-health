import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, UserPlus, Crown, User as UserIcon, Loader2, Mail, Trash2, Check, Copy, MessageCircle, Settings2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
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
  managed_profiles: string[] | null;
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groupId } = useFamilyGroup();
  const { members } = useFamilyMembers();
  const queryClient = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const [inviteMemberId, setInviteMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "member" | "invite"; id: string } | null>(null);
  const [permsMember, setPermsMember] = useState<GroupMember | null>(null);
  const [permsSelected, setPermsSelected] = useState<string[]>([]);
  const [permsSaving, setPermsSaving] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Fetch active group members
  const { data: groupMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_group_members" as any)
        .select("id, auth_user_id, role, family_member_id, managed_profiles, invited_at, accepted_at")
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
    setSaving(true);
    try {
      const { error } = await supabase.from("group_invites" as any).insert({
        group_id: groupId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        family_member_id: inviteMemberId || null,
        invited_by: user.id,
      } as any);

      if (error) throw error;

      setSuccessEmail(inviteEmail.trim().toLowerCase());
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
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
    setSuccessEmail(null);
    setCopied(false);
  };

  const getShareMessage = (email: string) => {
    const safeEmail = email.replace('@', '@\u200B');
    return `Olá! Seu acesso ao Locus Vita, foi liberado.💚\n\n1 - Baixe o aplicativo na sua loja de aplicativos, disponível para Android e Ios.\n2 - Clique no botão Criar nova conta familiar.\n3 - Digite este e-mail ${safeEmail} e defina uma senha para criar a conta.\n4 - Aproveite seu aplicativo de saúde familiar mais completo e apaixonante.\n\nIMPORTANTE: Utilize exatamente o e-mail constante no item 3 ${safeEmail}, um e-mail diferente deste inviabilizará o acesso ao plano para o qual você foi convidado.`;
  };

  const handleCopyMessage = async () => {
    if (!successEmail) return;
    try {
      await navigator.clipboard.writeText(getShareMessage(successEmail));
      setCopied(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const handleShareWhatsApp = () => {
    if (!successEmail) return;
    const msg = encodeURIComponent(getShareMessage(successEmail));
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const isLoading = loadingMembers || loadingInvites;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-y-auto">
        <div className="min-h-[calc(100%+1px)]">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md">
            <div className="flex items-center gap-3 px-4 py-4">
              <button
                onClick={() => navigate("/ajustes")}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors [@media(hover:hover)]:hover:bg-muted active:bg-muted/60"
              >
                <ArrowLeft size={22} className="text-foreground" />
              </button>
              <div className="flex items-center gap-2 flex-1">
                <Shield size={20} className="text-primary" />
                <h1 className="text-lg font-bold text-foreground">Gestão de Acessos</h1>
              </div>
              <button
                onClick={() => setInfoOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors [@media(hover:hover)]:hover:bg-muted active:bg-muted/60"
              >
                <Info size={20} className="text-muted-foreground" />
              </button>

          <div className="px-4 pb-28 space-y-6">
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
                        onClick={gm.role === "user" && !isCurrentUser ? () => {
                          setPermsMember(gm);
                          setPermsSelected(gm.managed_profiles ?? []);
                        } : undefined}
                        className={`flex items-center gap-3 p-4 bg-card rounded-xl border border-border/40 shadow-sm ${gm.role === "user" && !isCurrentUser ? "cursor-pointer active:bg-muted/30" : ""}`}
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
                        {gm.role === "user" && !isCurrentUser && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPermsMember(gm); setPermsSelected(gm.managed_profiles ?? []); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)]:hover:bg-accent active:bg-accent/60"
                          >
                            <Settings2 size={16} />
                          </button>
                        )}
                        <Badge
                          className={
                            gm.role === "admin"
                              ? "bg-[#1C3333] text-white border-none text-[10px] px-2"
                              : "bg-[#AEE2D4] text-slate-800 border-none text-[10px] px-2"
                          }
                        >
                          {gm.role === "admin" ? "Admin" : "Usuário"}
                        </Badge>
                        {!isCurrentUser ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "member", id: gm.id }); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)]:hover:bg-destructive/10 [@media(hover:hover)]:hover:text-destructive active:bg-destructive/10"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center opacity-0">
                            <Trash2 size={16} />
                          </div>
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
            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex flex-col space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Admin:</strong> acesso completo a todos os perfis e dados da família.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Usuário:</strong> acesso limitado ao perfil vinculado (só vê e edita seus próprios dados).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAB */}
      {!drawerOpen && <FixedFAB onClick={() => { resetForm(); setDrawerOpen(true); }} />}

      <Drawer open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) resetForm(); }}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          {successEmail ? (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check size={32} className="text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Convite gerado com sucesso!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    O acesso foi liberado no sistema. Agora, avise o convidado para baixar o aplicativo e criar uma conta usando o e-mail:{" "}
                    <strong className="text-foreground">{successEmail}</strong>
                  </p>
                </div>

                <div className="w-full space-y-3 pt-2">
                  <Button
                    onClick={handleShareWhatsApp}
                    className="w-full rounded-xl h-12 bg-[#25D366] text-white [@media(hover:hover)]:hover:bg-[#25D366]/90 text-sm font-semibold gap-2"
                  >
                    <MessageCircle size={20} />
                    Avisar pelo WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCopyMessage}
                    className="w-full rounded-xl h-12 text-sm font-semibold gap-2"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? "Copiado!" : "Copiar Mensagem"}
                  </Button>
                </div>
              </div>
              <DrawerFooter>
                <Button
                  variant="ghost"
                  onClick={() => { setDrawerOpen(false); resetForm(); }}
                  className="w-full rounded-xl text-muted-foreground"
                >
                  Fechar
                </Button>
              </DrawerFooter>
            </>
          ) : (
            <>
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <UserPlus size={20} className="text-primary" />
                  Convidar Pessoa
                </DrawerTitle>
                <DrawerDescription>
                  Envie um convite para alguém acessar a conta da família.
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-5 overscroll-contain pb-32">
                {/* Email */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">E-mail do Convidado</Label>
                  <Input
                    type="email"
                    placeholder="pessoa@email.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className={INPUT_CLASSES}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300)}
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

                {/* Linked Profile (optional — auto-created on accept if empty) */}
                {inviteRole === "user" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Perfil Vinculado (opcional)</Label>
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
                      Se não selecionar, um perfil será criado automaticamente quando o convidado aceitar.
                    </p>
                  </div>
                )}

                {/* Action buttons inside scrollable area for iOS keyboard */}
                <div className="flex gap-3 pt-2">
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
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Permissions Drawer */}
      <Drawer open={!!permsMember} onOpenChange={(open) => { if (!open) setPermsMember(null); }}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Settings2 size={20} className="text-primary" />
              Permissões de {members.find(m => m.id === permsMember?.family_member_id)?.name?.split(' ')[0] ?? "Usuário"}
            </DrawerTitle>
            <DrawerDescription>
              Defina quais perfis este usuário pode visualizar e editar.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 overscroll-contain">
            {members.map(m => {
              const isPrimary = m.id === permsMember?.family_member_id;
              const isChecked = isPrimary || permsSelected.includes(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40">
                  <MemberAvatar avatarUrl={m.avatar_url} name={m.name} size="sm" memberType={m.member_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.relationship}</p>
                  </div>
                  <Switch
                    checked={isChecked}
                    disabled={isPrimary}
                    onCheckedChange={(checked) => {
                      setPermsSelected(prev =>
                        checked ? [...prev, m.id] : prev.filter(id => id !== m.id)
                      );
                    }}
                  />
                </div>
              );
            })}
          </div>
          <DrawerFooter>
            <Button
              onClick={async () => {
                if (!permsMember) return;
                setPermsSaving(true);
                try {
                  // Filter out the primary profile from managed_profiles
                  const profilesToSave = permsSelected.filter(id => id !== permsMember.family_member_id);
                  const { error } = await supabase
                    .from("family_group_members" as any)
                    .update({ managed_profiles: profilesToSave } as any)
                    .eq("id", permsMember.id);
                  if (error) throw error;
                  toast.success("Permissões atualizadas!");
                  queryClient.invalidateQueries({ queryKey: ["group_members", groupId] });
                  setPermsMember(null);
                } catch {
                  toast.error("Erro ao salvar permissões.");
                } finally {
                  setPermsSaving(false);
                }
              }}
              disabled={permsSaving}
              className="w-full rounded-xl bg-[#1C3333] text-white [@media(hover:hover)]:hover:bg-[#1C3333]/90"
            >
              {permsSaving ? <Loader2 className="animate-spin" size={16} /> : "Salvar Permissões"}
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
