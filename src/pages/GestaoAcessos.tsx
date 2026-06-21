import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, UserPlus, Crown, Loader2, Mail, Trash2, Check, Copy, MessageCircle, Settings2, Info, ShieldOff, Send } from "lucide-react";
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
  // inviteRole removed — invitees always join as 'user' (DB enforces via RLS policy)
  const [inviteMemberId, setInviteMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "member" | "invite"; id: string } | null>(null);
  const [permsMember, setPermsMember] = useState<GroupMember | null>(null);
  const [permsSelected, setPermsSelected] = useState<string[]>([]);
  const [permsSaving, setPermsSaving] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  // Fetch active group members
  const { data: groupMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["group_members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_group_members")
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
        .from("group_invites")
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

  /** Chama a edge function para enfileirar o e-mail de convite (disparo inicial ou reenvio) */
  const sendInviteEmail = async (inviteId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    // Fire-and-forget: falha no e-mail não bloqueia a UX — convite já está registrado
    supabase.functions.invoke("send-invite-email", {
      body: { invite_id: inviteId },
    }).then(({ error }) => {
      if (error) console.warn("[invite-email] Falha ao enfileirar e-mail:", error);
    });
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !groupId || !user) return;
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase
        .from("group_invites")
        .insert({
          group_id: groupId,
          email: inviteEmail.trim().toLowerCase(),
          role: "user" as const, // always 'user' — DB policy forbids self-assigning 'admin'
          family_member_id: inviteMemberId || null,
          invited_by: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Enviar e-mail automaticamente — fire-and-forget (não bloqueia sucesso do convite)
      if (inserted?.id) sendInviteEmail(inserted.id);

      setSuccessEmail(inviteEmail.trim().toLowerCase());
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
    } catch {
      toast.error("Erro ao salvar convite.");
    } finally {
      setSaving(false);
    }
  };

  const handleResendInviteEmail = async (inviteId: string) => {
    setResendingInviteId(inviteId);
    try {
      const { error } = await supabase.functions.invoke("send-invite-email", {
        body: { invite_id: inviteId },
      });
      if (error) throw error;
      toast.success("E-mail de convite reenviado!");
    } catch {
      toast.error("Não foi possível reenviar. Tente novamente.");
    } finally {
      setResendingInviteId(null);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("group_invites")
        .delete()
        .eq("id", inviteId);
      if (error) throw error;
      toast.success("Convite removido.");
      queryClient.invalidateQueries({ queryKey: ["group_invites", groupId] });
    } catch {
      toast.error("Erro ao remover convite.");
    }
  };

  const handleChangeRole = async (memberId: string, newRole: "admin" | "user") => {
    setRoleChanging(true);
    try {
      const { error } = await supabase
        .from("family_group_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;
      toast.success(newRole === "admin" ? "Membro promovido a Admin!" : "Membro rebaixado a Usuário.");
      queryClient.invalidateQueries({ queryKey: ["group_members", groupId] });
      setPermsMember(null);
    } catch {
      toast.error("Erro ao alterar papel do membro.");
    } finally {
      setRoleChanging(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("family_group_members")
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
      <div className="flex-1 overflow-y-auto overscroll-y-auto no-scrollbar">
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
              <h1 className="text-lg font-bold text-foreground flex-1">Gestão de Acessos</h1>
              <button
                onClick={() => setInfoOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors [@media(hover:hover)]:hover:bg-muted active:bg-muted/60"
              >
                <Info size={20} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="px-4 pb-44 space-y-6">
            {/* Section: Active Members */}
            <div>
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
                        onClick={!isCurrentUser ? () => {
                          setPermsMember(gm);
                          setPermsSelected(gm.managed_profiles ?? []);
                        } : undefined}
                        className={`flex items-center gap-3 p-4 bg-card rounded-xl border border-border/40 shadow-xs ${!isCurrentUser ? "cursor-pointer active:bg-muted/30" : ""}`}
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
                        {!isCurrentUser && (
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
                      className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border/40 shadow-xs"
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
                      {/* Reenviar e-mail de convite */}
                      <button
                        onClick={() => handleResendInviteEmail(inv.id)}
                        disabled={resendingInviteId === inv.id}
                        title="Reenviar e-mail de convite"
                        className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)]:hover:bg-primary/10 [@media(hover:hover)]:hover:text-primary active:bg-primary/10 disabled:opacity-40"
                      >
                        {resendingInviteId === inv.id
                          ? <Loader2 size={16} className="animate-spin" />
                          : <Send size={15} />}
                      </button>
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
                    Um e-mail com as instruções foi enviado para{" "}
                    <strong className="text-foreground">{successEmail}</strong>.
                    Se preferir, também pode avisar pelo WhatsApp:
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

                {/* Linked Profile (optional — auto-created on accept if empty) */}
                {/* Security: invitees always join as 'user' — admin promotion is
                    a separate action. Role selector removed (DB enforces role = 'user'). */}
                {(
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Perfil Vinculado (opcional)</Label>
                    <Select value={inviteMemberId} onValueChange={setInviteMemberId}>
                      <SelectTrigger className={INPUT_CLASSES}>
                        <SelectValue placeholder="Selecione o usuário..." />
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
                    {saving ? <Loader2 className="animate-spin" size={16} /> : "Convidar e Enviar E-mail"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Permissions / Role Drawer */}
      <Drawer open={!!permsMember} onOpenChange={(open) => { if (!open) setPermsMember(null); }}>
        <DrawerContent className="flex flex-col max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Settings2 size={20} className="text-primary" />
              {members.find(m => m.id === permsMember?.family_member_id)?.name?.split(' ')[0] ?? "Membro"}
            </DrawerTitle>
            <DrawerDescription>
              Papel atual: <strong>{permsMember?.role === "admin" ? "Admin" : "Usuário"}</strong>
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 overscroll-contain">
            {/* Role section */}
            <div className="p-3 bg-card rounded-xl border border-border/40 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Papel no Grupo</p>
              {permsMember?.role === "user" ? (
                <Button
                  onClick={() => handleChangeRole(permsMember.id, "admin")}
                  disabled={roleChanging}
                  variant="outline"
                  className="w-full rounded-xl h-10 gap-2 text-sm"
                >
                  {roleChanging ? <Loader2 className="animate-spin" size={16} /> : <Crown size={16} className="text-amber-500" />}
                  Promover a Admin
                </Button>
              ) : (
                <Button
                  onClick={() => handleChangeRole(permsMember!.id, "user")}
                  disabled={roleChanging}
                  variant="outline"
                  className="w-full rounded-xl h-10 gap-2 text-sm text-destructive border-destructive/30 [@media(hover:hover)]:hover:bg-destructive/5"
                >
                  {roleChanging ? <Loader2 className="animate-spin" size={16} /> : <ShieldOff size={16} />}
                  Rebaixar a Usuário
                </Button>
              )}
            </div>

            {/* Profile permissions — only relevant for 'user' role */}
            {permsMember?.role === "user" && (
              <>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Perfis que pode gerenciar</p>
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
              </>
            )}
            {permsMember?.role === "admin" && (
              <p className="text-xs text-muted-foreground leading-relaxed px-1">
                Admins têm acesso completo a todos os perfis da família. As permissões de perfil específico se aplicam apenas a membros com papel Usuário.
              </p>
            )}
          </div>
          <DrawerFooter>
            {permsMember?.role === "user" && (
              <Button
                onClick={async () => {
                  if (!permsMember) return;
                  setPermsSaving(true);
                  try {
                    const profilesToSave = permsSelected.filter(id => id !== permsMember.family_member_id);
                    const { error } = await supabase
                      .from("family_group_members")
                      .update({ managed_profiles: profilesToSave })
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
            )}
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full rounded-xl text-muted-foreground">
                Fechar
              </Button>
            </DrawerClose>
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

      {/* Info Dialog */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-[320px] rounded-[24px] w-[90vw]">
          <DialogHeader>
            <DialogTitle>Níveis de Acesso</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Admin:</strong> acesso completo a todos os perfis e dados da família.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Usuário:</strong> acesso limitado ao perfil vinculado (só vê e edita seus próprios dados e os perfis que gerencia).
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      
    </div>
  );
};

export default GestaoAcessos;
