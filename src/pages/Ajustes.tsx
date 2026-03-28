import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Users, Bell, Shield, HelpCircle, ChevronRight, Trash2, Loader2, FileText, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { supabase } from "@/integrations/supabase/client";
import MemberAvatar from "@/components/MemberAvatar";
import { toast } from "sonner";

const menuItems = [
  { icon: User, label: "Meus Dados", path: "/meus-dados" },
  { icon: Users, label: "Gerenciar Família", path: "/gerenciar-familia" },
  { icon: Bell, label: "Notificações", path: "/notificacoes" },
  { icon: Shield, label: "Segurança e Senha", path: "/seguranca" },
  { icon: FileText, label: "Política de Privacidade", path: null },
  { icon: HelpCircle, label: "Ajuda e Suporte", path: null },
];

const Ajustes = () => {
  const { signOut, user } = useAuth();
  const { isAdmin } = useFamilyGroup();
  const navigate = useNavigate();
  const { members, updateMember } = useFamilyMembers();
  const { linkedMemberId } = useFamilyGroup();
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const myProfile = members?.find((m) => m.id === linkedMemberId) ?? members?.[0];

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      if (isAdmin) {
        // Admin: soft-delete all family members (cascade)
        if (members && members.length > 0) {
          for (const member of members) {
            await updateMember.mutateAsync({
              id: member.id,
              deleted_at: new Date().toISOString(),
            } as any);
          }
        }
      } else {
        // User: soft-delete ONLY own linked profile
        if (linkedMemberId) {
          await updateMember.mutateAsync({
            id: linkedMemberId,
            deleted_at: new Date().toISOString(),
          } as any);
        }
        // Remove own access record from family_group_members
        if (user?.id) {
          await supabase
            .from("family_group_members" as any)
            .delete()
            .eq("auth_user_id", user.id);
        }
      }
      await supabase.auth.signOut();
      toast.success("Conta excluída com sucesso.");
      navigate("/login", { replace: true });
    } catch {
      toast.error("Erro ao excluir conta. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-32 space-y-4 min-h-[calc(100%+1px)]">
          {/* Sticky Header with Glassmorphism */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-5">
            <h1 className="text-2xl font-bold text-foreground px-1">Ajustes</h1>
          </div>

          {/* Profile Card */}
          <div className="flex items-center gap-4 p-4 bg-card rounded-xl shadow-sm border border-border/40">
            <MemberAvatar avatarUrl={myProfile?.avatar_url} name={myProfile?.name ?? "?"} size="lg" memberType={myProfile?.member_type} />
            <div>
              <p className="text-base font-semibold text-foreground">{myProfile?.name ?? "Carregando..."}</p>
              <p className="text-sm text-muted-foreground">{myProfile?.relationship ?? "Membro"}</p>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-3">
            {menuItems.map(({ icon: Icon, label, path }) => (
              <button
                key={label}
                onClick={() => path && navigate(path)}
                className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-sm border border-border/40 active:bg-muted/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-black" />
                </div>
                <span className="flex-1 text-left text-sm font-medium text-foreground">{label}</span>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            ))}

            {/* Access Management - Admin only */}
            {isAdmin && (
              <button
                onClick={() => navigate("/gestao-acessos")}
                className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-sm border border-border/40 active:bg-muted/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0">
                  <UserCog size={20} className="text-black" />
                </div>
                <span className="flex-1 text-left text-sm font-medium text-foreground">Gestão de Acessos</span>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            )}

            {/* Delete Account - danger item */}
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-sm border border-destructive/20 active:bg-destructive/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-destructive" />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-destructive">Excluir Minha Conta</span>
              <ChevronRight size={18} className="text-destructive/50" />
            </button>
          </div>
        </div>
      </div>

      {/* Fixed Footer with Glassmorphism */}
      <div className="fixed bottom-20 left-0 right-0 z-20 p-4 bg-[#F4F1EB]/70 backdrop-blur-xl border-t border-slate-200/50 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)]">
        <Button
          onClick={handleLogout}
          className="w-full bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-red-600 border-none font-semibold flex items-center justify-center gap-2 h-11 rounded-xl"
        >
          <LogOut size={18} />
          Sair da conta
        </Button>
      </div>

      {/* Delete Account AlertDialog */}
      <AlertDialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <AlertDialogContent className="max-w-[320px] rounded-[24px] w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Alerta de Exclusão de Conta</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin
                ? "Tem certeza que deseja excluir sua conta Locus Vita? Todos os seus dados e os dados de sua família serão apagados permanentemente."
                : "Tem certeza que deseja excluir sua conta? Você perderá permanentemente o acesso a este grupo familiar e seus dados de login serão removidos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="animate-spin" size={16} /> : "Sim, Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Ajustes;
