import { useState, useEffect } from "react";
import { parseDateInSP } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Users, Bell, HelpCircle, ChevronRight, Trash2, Loader2, FileText, UserCog, Crown, AlertCircle, Clock, Sparkles, Download, ShieldOff, MessageCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useSubscription } from "@/hooks/useSubscription";
import { usePasskeys } from "@/hooks/usePasskeys";
import { authenticatePasskey } from "@/lib/webauthn";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";
import MemberAvatar from "@/components/MemberAvatar";
import PaywallModal from "@/components/PaywallModal";
import { toast } from "sonner";
import { format } from "date-fns";
import { PLAN_MONTHLY_DISPLAY, PLAN_ANNUAL_DISPLAY } from "@/lib/planConfig";
import { ptBR } from "date-fns/locale";

// ── Tipos de item de menu ──────────────────────────────────────────────────
type MenuAction =
  | { kind: "navigate"; path: string }
  | { kind: "support" }
  | { kind: "export" }
  | { kind: "revoke" }
  | { kind: "delete" };

interface MenuItem {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  action: MenuAction;
  adminOnly?: boolean;
  danger?: boolean;
  warning?: boolean;
  accent?: boolean;
}

interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

export const buildMenuGroups = (isAdmin: boolean): MenuGroup[] => [
  // ── Item solto: Meus Dados ─────────────────────────────────────────────
  {
    items: [
      { icon: User, label: "Meus Dados", action: { kind: "navigate", path: "/meus-dados" } },
    ],
  },
  // ── Item solto: Gerenciar Família ──────────────────────────────────────
  {
    items: [
      { icon: Users, label: "Gerenciar Família", action: { kind: "navigate", path: "/gerenciar-familia" } },
    ],
  },
  // ── Grupo: Segurança ───────────────────────────────────────────────────
  {
    title: "Segurança",
    items: [
      { icon: Lock, label: "Senha e Biometria", action: { kind: "navigate", path: "/seguranca-conta" } },
      ...(isAdmin
        ? [{ icon: UserCog, label: "Gestão de Acessos", action: { kind: "navigate", path: "/gestao-acessos" } as MenuAction }]
        : []),
    ],
  },
  // ── Item solto: Notificações ───────────────────────────────────────────
  {
    items: [
      { icon: Bell, label: "Notificações", action: { kind: "navigate", path: "/notificacoes" } },
    ],
  },
  // ── Grupo: Conformidade ────────────────────────────────────────────────
  {
    title: "Conformidade",
    items: [
      { icon: FileText, label: "Política de Privacidade", action: { kind: "navigate", path: "/politica-de-privacidade" } },
      { icon: Download, label: "Exportar Meus Dados", sublabel: "LGPD Art. 18-V — portabilidade", action: { kind: "export" }, accent: true },
      { icon: ShieldOff, label: "Revogar Consentimento", sublabel: "LGPD Art. 18-IX — revogação", action: { kind: "revoke" }, warning: true },
      { icon: Trash2, label: "Excluir Conta", action: { kind: "delete" }, danger: true },
    ],
  },
  // ── Grupo: Suporte ─────────────────────────────────────────────────────
  {
    title: "Suporte",
    items: [
      { icon: HelpCircle, label: "Perguntas e Respostas", action: { kind: "navigate", path: "/ajuda" } },
      { icon: MessageCircle, label: "Fale Conosco", action: { kind: "support" } },
      { icon: Sparkles, label: "Novidade Locus Vita", action: { kind: "navigate", path: "/changelog" } },
    ],
  },
];

// ── Item de menu genérico ──────────────────────────────────────────────────
interface MenuItemButtonProps {
  item: MenuItem;
  exportingData: boolean;
  onAction: (action: MenuAction) => void;
}

const MenuItemButton = ({ item, exportingData, onAction }: MenuItemButtonProps) => {
  const isExporting = item.action.kind === "export" && exportingData;

  const containerClass = item.danger
    ? "w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-xs border border-destructive/20 active:bg-destructive/5 transition-colors"
    : item.warning
    ? "w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-xs border border-amber-200/60 active:bg-amber-50 transition-colors"
    : "w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-xs border border-border/40 active:bg-muted/40 transition-colors";

  const iconBgClass = item.danger
    ? "w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0"
    : item.warning
    ? "w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"
    : item.accent
    ? "w-10 h-10 rounded-full bg-[#78C2AD]/15 flex items-center justify-center shrink-0"
    : "w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0";

  const iconClass = item.danger
    ? "text-destructive"
    : item.warning
    ? "text-amber-600"
    : item.accent
    ? "text-[#78C2AD]"
    : "text-black";

  const labelClass = item.danger
    ? "text-sm font-medium text-destructive"
    : item.warning
    ? "text-sm font-medium text-amber-800"
    : "text-sm font-medium text-foreground";

  const chevronClass = item.danger
    ? "text-destructive/50"
    : item.warning
    ? "text-amber-400"
    : "text-muted-foreground";

  const Icon = item.icon;

  return (
    <button
      onClick={() => onAction(item.action)}
      disabled={isExporting}
      className={`${containerClass} disabled:opacity-60`}
      aria-label={item.label}
    >
      <div className={iconBgClass}>
        {isExporting
          ? <Loader2 size={20} className="text-[#78C2AD] animate-spin" />
          : <Icon size={20} className={iconClass} />
        }
      </div>
      <div className="flex-1 text-left">
        <span className={`${labelClass} block`}>{item.label}</span>
        {item.sublabel && (
          <span className={`text-xs block ${item.warning ? "text-amber-600/80" : "text-muted-foreground"}`}>
            {item.sublabel}
          </span>
        )}
      </div>
      <ChevronRight size={18} className={chevronClass} />
    </button>
  );
};

const Ajustes = () => {
  const { signOut, user } = useAuth();
  const { isAdmin } = useFamilyGroup();
  const navigate = useNavigate();
  const { members } = useFamilyMembers();
  const { linkedMemberId } = useFamilyGroup();
  const { subscription, isLoading, isTrialing, isActive, isPastDue, isCanceled, canceledButGracePeriod, trialDaysLeft, trialExpired, isImplicitTrial, implicitTrialExpired, canUsePremium } = useSubscription();
  // Dono da assinatura = quem criou o grupo (user_id na tabela subscriptions coincide com user logado).
  // Admins secundários veem o card informativo mas não o botão "Gerenciar Assinatura",
  // pois as edge functions de billing operam sobre o JWT do caller — outro admin criaria
  // uma assinatura duplicada no Asaas em nome dele.
  const isSubscriptionOwner = !isLoading && (!subscription || subscription.user_id === user?.id);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const { passkeys } = usePasskeys();
  const hasPasskey = passkeys.length > 0;
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [supportUrl, setSupportUrl] = useState<string>("");
  const [supportEmail, setSupportEmail] = useState<string>("suporte@locustech.com.br");
  // M14 — Revogação de consentimento
  const [showRevokeConsent, setShowRevokeConsent] = useState(false);
  const [revokingConsent, setRevokingConsent] = useState(false);
  // A15 — Exportação de dados
  const [exportingData, setExportingData] = useState(false);

  useEffect(() => {
    supabase
      .from("system_configs")
      .select("key, value")
      .in("key", ["support_url", "support_email"])
      .then(({ data }) => {
        if (data) {
          for (const row of data) {
            if (row.key === "support_url") setSupportUrl(row.value || "");
            if (row.key === "support_email") setSupportEmail(row.value || "suporte@locustech.com.br");
          }
        }
      });
  }, []);

  const handleRegularize = async () => {
    setLoadingSubscription(true);
    const checkoutWindow = window.open("about:blank", "_blank");
    try {
      const planType = subscription?.plan_type === "annual" ? "annual" : "monthly";
      const url = await createSubscription(planType as "monthly" | "annual");
      if (checkoutWindow) checkoutWindow.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (checkoutWindow) checkoutWindow.close();
      toast.error(err instanceof Error ? err.message : "Erro ao gerar link de pagamento.");
    } finally {
      setLoadingSubscription(false);
    }
  };

  const myProfile = members?.find((m) => m.id === linkedMemberId) ?? members?.[0];

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  // ── M14 — Revogar consentimento (LGPD Art. 18-IX) ─────────────────────────
  const handleRevokeConsent = async () => {
    setRevokingConsent(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Inserir registro de revogação — a tabela é imutável (sem DELETE via RLS)
      // O histórico fica completo: quando consentiu + quando revogou
      const { error } = await supabase.from("consent_log").insert([
        {
          user_id: userId,
          consent_type: "revoked",
          policy_version: "1.0",
          user_agent: navigator.userAgent.slice(0, 500),
        },
      ]);

      if (error) throw error;

      toast.success(
        "Consentimento revogado e registrado. Para remover seus dados definitivamente, use 'Excluir Conta'.",
        { duration: 7000 }
      );
      setShowRevokeConsent(false);
    } catch {
      toast.error("Erro ao registrar revogação. Tente novamente ou entre em contato com o suporte.");
    } finally {
      setRevokingConsent(false);
    }
  };

  // ── A15 — Exportar dados do titular (LGPD Art. 18-V) ──────────────────────
  const handleExportData = async () => {
    setExportingData(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const userEmail = userData?.user?.email;
      if (!userId) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Buscar o grupo familiar do usuário
      const { data: groupData } = await supabase
        .from("family_group_members")
        .select("group_id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      const groupId = groupData?.group_id;
      if (!groupId) {
        throw new Error("Usuário não está associado a um grupo familiar.");
      }

      // Buscar todos os membros do grupo
      const { data: membersData } = await supabase
        .from("family_members")
        .select("id, name, birth_date, gender, member_type, relationship, blood_type")
        .eq("group_id", groupId)
        .is("deleted_at", null);

      const memberIds = (membersData ?? []).map((m: any) => m.id);

      // Buscar todos os dados clínicos em paralelo
      const [
        medications,
        consultations,
        exams,
        vaccines,
        allergies,
        diseases,
        healthMeasurements,
        bloodPressure,
        menstrualCycles,
        petRoutines,
        consentLog,
      ] = await Promise.all([
        supabase.from("medications").select("*").in("family_member_id", memberIds).is("deleted_at", null),
        supabase.from("consultations").select("*").in("family_member_id", memberIds),
        supabase.from("exams").select("*").in("family_member_id", memberIds),
        supabase.from("vaccines").select("*").in("family_member_id", memberIds),
        supabase.from("allergies").select("*").in("family_member_id", memberIds),
        supabase.from("diseases").select("*").in("family_member_id", memberIds),
        supabase.from("health_measurements").select("*").in("family_member_id", memberIds),
        supabase.from("blood_pressure_history").select("*").in("family_member_id", memberIds),
        supabase.from("menstrual_cycles").select("*").in("family_member_id", memberIds),
        supabase.from("pet_routines").select("*").in("family_member_id", memberIds),
        supabase.from("consent_log").select("consent_type, policy_version, granted_at").eq("user_id", userId),
      ]);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        exportVersion: "1.0",
        dataController: "Locus Tech — fabio@locustech.com.br",
        lgpdBasis: "Art. 18-V LGPD — Portabilidade de dados",
        account: {
          userId,
          email: userEmail,
        },
        familyMembers: membersData ?? [],
        clinicalData: {
          medications: medications.data ?? [],
          consultations: consultations.data ?? [],
          exams: exams.data ?? [],
          vaccines: vaccines.data ?? [],
          allergies: allergies.data ?? [],
          diseases: diseases.data ?? [],
          healthMeasurements: healthMeasurements.data ?? [],
          bloodPressure: bloodPressure.data ?? [],
          menstrualCycles: menstrualCycles.data ?? [],
          petRoutines: petRoutines.data ?? [],
        },
        consentHistory: consentLog.data ?? [],
      };

      // Disparar download do JSON
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `locus-vita-dados-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Dados exportados com sucesso!");
    } catch {
      toast.error("Erro ao exportar dados. Tente novamente.");
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Get the current session token to authenticate the Edge Function call
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await supabase.functions.invoke("delete-user-account", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.error) {
        console.error("delete-user-account error:", response.error);
        toast.error("Erro ao excluir conta. Entre em contato com o suporte.");
        return;
      }

      toast.success("Conta e todos os dados excluídos com sucesso.");
      navigate("/login", { replace: true });
    } catch {
      toast.error("Erro ao excluir conta. Tente novamente.");
    } finally {
      setDeleting(false);
      setShowDeleteAccount(false);
      setReauthPassword("");
    }
  };

  // RX-01 — Reautenticação antes de excluir conta (OWASP A07)
  const handleReauthAndDelete = async () => {
    if (reauthLoading || deleting) return;
    setReauthLoading(true);
    try {
      if (hasPasskey) {
        await authenticatePasskey();
      } else {
        if (!user?.email) {
          toast.error("Não foi possível identificar seu e-mail. Faça login novamente.");
          return;
        }
        if (!reauthPassword) {
          toast.error("Digite sua senha atual para confirmar.");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: reauthPassword,
        });
        if (error) {
          toast.error("Senha incorreta. Tente novamente.");
          return;
        }
      }
      // Reautenticação bem-sucedida → executa a exclusão
      await handleDeleteAccount();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na confirmação. Tente novamente.");
    } finally {
      setReauthLoading(false);
    }
  };


  return (
    <div className="fixed top-0 left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-6 space-y-4 min-h-[calc(100%+1px)]">
          {/* Sticky Header with Glassmorphism */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-5">
            <h1 className="font-bold text-foreground px-1 text-lg">Ajustes</h1>
          </div>

          {/* Profile Card */}
          <div className="flex items-center gap-4 p-4 bg-card rounded-xl shadow-xs border border-border/40">
            <MemberAvatar avatarUrl={myProfile?.avatar_url} name={myProfile?.name ?? "?"} size="lg" memberType={myProfile?.member_type} />
            <div>
              <p className="text-base font-semibold text-foreground">{myProfile?.name ?? "Carregando..."}</p>
              <p className="text-sm text-muted-foreground">{myProfile?.relationship ?? "Membro"}</p>
            </div>
          </div>

          {/* Subscription Card */}
          {isAdmin ? (
            /* ── Admin: card completo com gerenciamento ── */
            isLoading ? (
              <div className="rounded-xl border border-border/40 p-4 space-y-3 animate-pulse">
                <div className="h-10 bg-muted rounded-lg" />
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-10 bg-muted rounded-xl" />
              </div>
            ) : subscription ? (
              <div className="rounded-xl overflow-hidden shadow-xs border border-border/40">
                {/* Header gradient */}
                <div className={`px-4 py-3 ${
                  isActive
                    ? "bg-gradient-to-r from-[#2A5C82] to-[#78C2AD]"
                    : isPastDue
                    ? "bg-gradient-to-r from-red-600 to-red-400"
                    : isCanceled
                    ? "bg-gradient-to-r from-gray-500 to-gray-400"
                    : trialExpired
                    ? "bg-gradient-to-r from-gray-500 to-gray-400"
                    : "bg-gradient-to-r from-amber-500 to-amber-400"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown size={16} className="text-white" />
                      <span className="text-sm font-bold text-white">
                        {isActive
                          ? subscription.plan_type === "annual"
                            ? "Plano Anual Locus Vita"
                            : "Plano Mensal Locus Vita"
                          : isPastDue
                          ? "Pagamento Pendente"
                          : isCanceled
                          ? "Assinatura Cancelada"
                          : "Assinatura"}
                      </span>
                    </div>
                    {isActive && (
                      <Badge className="bg-white/20 text-white border-none text-xs backdrop-blur-sm">Ativo</Badge>
                    )}
                    {isCanceled && (
                      <Badge className="bg-white/20 text-white border-none text-xs backdrop-blur-sm">Cancelado</Badge>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="bg-card p-4 space-y-3">
                  {isActive && (
                    <div className="flex justify-center items-baseline gap-1 mt-4">
                      <span className="text-2xl font-bold text-foreground">
                        {subscription.plan_type === "annual" ? PLAN_ANNUAL_DISPLAY : PLAN_MONTHLY_DISPLAY}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        /{subscription.plan_type === "annual" ? "ano" : "mês"}
                      </span>
                    </div>
                  )}

                  {isActive && subscription.next_billing_date && (
                    <p className="text-sm text-muted-foreground">
                      Próximo pagamento:{" "}
                      <strong className="text-foreground">
                        {format(parseDateInSP(subscription.next_billing_date.substring(0, 10)) ?? new Date(), "dd MMM yyyy", { locale: ptBR })}
                      </strong>
                    </p>
                  )}

                  {isCanceled && canceledButGracePeriod && subscription.next_billing_date && (
                    <p className="text-sm text-muted-foreground">
                      Acesso válido até:{" "}
                      <strong className="text-foreground">
                        {format(parseDateInSP(subscription.next_billing_date.substring(0, 10)) ?? new Date(), "dd MMM yyyy", { locale: ptBR })}
                      </strong>
                    </p>
                  )}

                  {/* Gerenciar Assinatura — só para o dono da assinatura */}
                  {isSubscriptionOwner && (
                    <Button
                      variant="outline"
                      onClick={() => navigate("/meu-plano")}
                      className="w-full h-10 rounded-xl border-primary/30 text-primary font-semibold"
                    >
                      {isCanceled ? "Ver Meu Plano" : "Gerenciar Assinatura"}
                    </Button>
                  )}

                  {isPastDue && isSubscriptionOwner && (
                    <Button
                      onClick={handleRegularize}
                      disabled={loadingSubscription}
                      className="w-full h-10 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold shadow-md"
                    >
                      {loadingSubscription ? <Loader2 className="animate-spin" size={16} /> : (
                        <span className="flex items-center gap-2">
                          <AlertCircle size={16} />
                          Regularizar Pagamento
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Plano Grátis Card — admin sem assinatura */
              <div className="rounded-xl overflow-hidden shadow-xs border border-border/40">
                <div className={`px-4 py-3 ${
                  implicitTrialExpired
                    ? "bg-gradient-to-r from-gray-500 to-gray-400"
                    : "bg-gradient-to-r from-[#2A5C82] to-[#A0C4D7]"
                }`}>
                  <div className="flex items-center gap-2">
                    <Crown size={16} className="text-white" />
                    <span className="text-sm font-bold text-white">
                      {implicitTrialExpired ? "Acesso Gratuito Expirado" : "Você está no Plano Grátis"}
                    </span>
                  </div>
                </div>
                <div className="bg-card p-4 space-y-3">
                  {!implicitTrialExpired && trialDaysLeft > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={14} />
                      <span>Faltam <strong className="text-foreground">{trialDaysLeft} dias</strong> para o fim do seu acesso gratuito.</span>
                    </div>
                  )}
                  {implicitTrialExpired && (
                    <p className="text-sm text-muted-foreground">
                      Seus 30 dias de acesso gratuito terminaram. Assine para continuar.
                    </p>
                  )}
                  <Button
                    onClick={() => setShowPaywall(true)}
                    className="w-full h-10 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-bold shadow-md"
                  >
                    Assinar Agora
                  </Button>
                </div>
              </div>
            )
          ) : (
            /* ── Usuário (não-admin): card informativo sem acesso a billing ── */
            <div className="rounded-xl overflow-hidden shadow-xs border border-border/40">
              <div className="px-4 py-3 bg-gradient-to-r from-[#2A5C82] to-[#78C2AD]">
                <div className="flex items-center gap-2">
                  <Crown size={16} className="text-white" />
                  <span className="text-sm font-bold text-white">Plano Familiar</span>
                </div>
              </div>
              <div className="bg-card p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Você está usando o Locus Vita através do plano do administrador do grupo.
                  Para gerenciar a assinatura, entre em contato com o administrador da sua família.
                </p>
              </div>
            </div>
          )}

          {/* Menu Groups */}
          {buildMenuGroups(isAdmin).map((group, gi) => (
            <div key={gi} className="space-y-2">
              {group.title && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-2">
                  {group.title}
                </p>
              )}
              <div className="space-y-2">
                {group.items.map((item) => (
                  <MenuItemButton
                    key={item.label}
                    item={item}
                    exportingData={exportingData}
                    onAction={(action) => {
                      switch (action.kind) {
                        case "navigate":
                          navigate(action.path, { state: { from: "/ajustes" } });
                          break;
                        case "support":
                          if (supportUrl) window.open(supportUrl, "_blank");
                          else window.location.href = `mailto:${supportEmail}`;
                          break;
                        case "export":
                          handleExportData();
                          break;
                        case "revoke":
                          setShowRevokeConsent(true);
                          break;
                        case "delete":
                          setShowDeleteAccount(true);
                          break;
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Sair da conta — parte do conteúdo scrollável, sem footer fixo */}
          <Button
            onClick={handleLogout}
            className="w-full bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-red-600 border-none font-semibold flex items-center justify-center gap-2 h-11 rounded-xl"
          >
            <LogOut size={18} />
            Sair da conta
          </Button>
        </div>
      </div>

      {/* Delete Account AlertDialog — RX-01: inclui reautenticação */}
      <AlertDialog
        open={showDeleteAccount}
        onOpenChange={(open) => {
          setShowDeleteAccount(open);
          if (!open) setReauthPassword("");
        }}
      >
        <AlertDialogContent className="max-w-[340px] rounded-[24px] w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão de conta</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {isAdmin
                  ? "Esta ação é irreversível. Todos os seus dados e os dados de sua família serão apagados permanentemente."
                  : "Esta ação é irreversível. Você perderá o acesso a este grupo familiar e seus dados de login serão removidos."}
              </span>
              <span className="block font-medium text-foreground">
                Para continuar, confirme sua identidade.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!hasPasskey && (
            <div className="space-y-2 py-1">
              <Label htmlFor="reauth-password" className="text-sm">
                Sua senha atual
              </Label>
              <Input
                id="reauth-password"
                type="password"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                className="text-base"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                disabled={reauthLoading || deleting}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={reauthLoading || deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleReauthAndDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={reauthLoading || deleting || (!hasPasskey && !reauthPassword)}
            >
              {reauthLoading || deleting ? (
                <Loader2 className="animate-spin" size={16} />
              ) : hasPasskey ? (
                "Confirmar com Face ID / Touch ID"
              ) : (
                "Confirmar exclusão"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* M14 — Revogar consentimento AlertDialog */}
      <AlertDialog open={showRevokeConsent} onOpenChange={setShowRevokeConsent}>
        <AlertDialogContent className="max-w-[320px] rounded-[24px] w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar Consentimento</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Ao revogar, registraremos sua solicitação conforme a <strong>LGPD Art. 18-IX</strong>.
              </span>
              <span className="block text-amber-700 font-medium">
                Atenção: a revogação não apaga seus dados. Para remoção definitiva, use "Excluir Conta".
              </span>
              <span className="block">
                Você continuará tendo acesso ao aplicativo normalmente após a revogação.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConsent}
              className="bg-amber-500 text-white hover:bg-amber-600"
              disabled={revokingConsent}
            >
              {revokingConsent ? <Loader2 className="animate-spin" size={16} /> : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaywallModal
        open={showPaywall}
        onOpenChange={setShowPaywall}
      />
    </div>
  );
};

export default Ajustes;
