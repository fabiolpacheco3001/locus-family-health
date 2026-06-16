import { useState, useEffect } from "react";
import { parseDateInSP } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Users, Bell, Shield, HelpCircle, ChevronRight, Trash2, Loader2, FileText, UserCog, Crown, AlertCircle, Clock, Mail, Sparkles, Download, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";
import MemberAvatar from "@/components/MemberAvatar";
import PaywallModal from "@/components/PaywallModal";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { PLAN_MONTHLY_DISPLAY, PLAN_ANNUAL_DISPLAY } from "@/lib/planConfig";
import { ptBR } from "date-fns/locale";

const menuItems = [
  { icon: User, label: "Meus Dados", path: "/meus-dados" },
  { icon: Users, label: "Gerenciar Família", path: "/gerenciar-familia" },
  { icon: Bell, label: "Notificações", path: "/notificacoes" },
  { icon: Shield, label: "Segurança e Senha", path: "/seguranca" },
  { icon: FileText, label: "Política de Privacidade", path: "/politica-de-privacidade" },
  { icon: Sparkles, label: "Novidades do Locus Vita", path: "/changelog" },
  { icon: HelpCircle, label: "Ajuda e Suporte", path: "/ajuda" },
  { icon: Mail, label: "Fale Conosco", path: "__support__" },
];

const Ajustes = () => {
  const { signOut, user } = useAuth();
  const { isAdmin } = useFamilyGroup();
  const navigate = useNavigate();
  const { members } = useFamilyMembers();
  const { linkedMemberId } = useFamilyGroup();
  const { subscription, isTrialing, isActive, isPastDue, isCanceled, canceledButGracePeriod, trialDaysLeft, trialExpired, isImplicitTrial, implicitTrialExpired, canUsePremium } = useSubscription();
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      .from("system_configs" as any)
      .select("key, value")
      .in("key", ["support_url", "support_email"])
      .then(({ data }) => {
        if (data) {
          for (const row of data as any[]) {
            if (row.key === "support_url") setSupportUrl(row.value || "");
            if (row.key === "support_email") setSupportEmail(row.value || "suporte@locustech.com.br");
          }
        }
      });
  }, []);

  const handleRegularize = async () => {
    setLoadingSubscription(true);
    try {
      const planType = subscription?.plan_type === "annual" ? "annual" : "monthly";
      const url = await createSubscription(planType as "monthly" | "annual");
      window.location.href = url;
    } catch {
      toast.error("Erro ao gerar link de pagamento.");
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
      const { error } = await supabase.from("consent_log" as any).insert([
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
        .from("family_group_members" as any)
        .select("group_id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      const groupId = (groupData as any)?.group_id;

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
        supabase.from("consent_log" as any).select("consent_type, policy_version, granted_at").eq("user_id", userId),
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
        consentHistory: (consentLog.data as any[]) ?? [],
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

      // Call the delete-user-account Edge Function which handles:
      // 1. Storage files (exam-files, receitas, vaccine_documents, avatars)
      // 2. Asaas subscription cancellation (best-effort)
      // 3. All DB records (clinical data via CASCADE, subscriptions, notifications, etc.)
      // 4. auth.users deletion (last step)
      const response = await supabase.functions.invoke("delete-user-account", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.error) {
        console.error("delete-user-account error:", response.error);
        toast.error("Erro ao excluir conta. Entre em contato com o suporte.");
        return;
      }

      // Token is now invalid — just navigate, no signOut needed
      toast.success("Conta e todos os dados excluídos com sucesso.");
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
            <h1 className="font-bold text-foreground px-1 text-lg">Ajustes</h1>
          </div>

          {/* Profile Card */}
          <div className="flex items-center gap-4 p-4 bg-card rounded-xl shadow-sm border border-border/40">
            <MemberAvatar avatarUrl={myProfile?.avatar_url} name={myProfile?.name ?? "?"} size="lg" memberType={myProfile?.member_type} />
            <div>
              <p className="text-base font-semibold text-foreground">{myProfile?.name ?? "Carregando..."}</p>
              <p className="text-sm text-muted-foreground">{myProfile?.relationship ?? "Membro"}</p>
            </div>
          </div>

          {/* Subscription Card - Netflix Style */}
          {subscription ? (
            <div className="rounded-xl overflow-hidden shadow-sm border border-border/40">
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

                {/* Always visible navigation to /meu-plano */}
                <Button
                  variant="outline"
                  onClick={() => navigate("/meu-plano")}
                  className="w-full h-10 rounded-xl border-primary/30 text-primary font-semibold"
                >
                  {isCanceled ? "Ver Meu Plano" : "Gerenciar Assinatura"}
                </Button>

                {isPastDue && (
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
            /* Plano Grátis Card */
            <div className="rounded-xl overflow-hidden shadow-sm border border-border/40">
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
          )}

          {/* Menu Items */}
          <div className="space-y-3">
            {menuItems.map(({ icon: Icon, label, path }) => (
              <button
                key={label}
                onClick={() => {
                  if (path === "__support__") {
                    if (supportUrl) {
                      window.open(supportUrl, "_blank");
                    } else {
                      window.location.href = `mailto:${supportEmail}`;
                    }
                  } else if (path?.startsWith("mailto:")) {
                    window.location.href = path;
                  } else if (path) {
                    navigate(path);
                  }
                }}
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

            {/* A15 — Exportar dados (LGPD Art. 18-V) */}
            <button
              onClick={handleExportData}
              disabled={exportingData}
              className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-sm border border-border/40 active:bg-muted/40 transition-colors disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-full bg-[#78C2AD]/15 flex items-center justify-center shrink-0">
                {exportingData
                  ? <Loader2 size={20} className="text-[#78C2AD] animate-spin" />
                  : <Download size={20} className="text-[#78C2AD]" />
                }
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-foreground block">Exportar Meus Dados</span>
                <span className="text-xs text-muted-foreground">LGPD Art. 18-V — portabilidade</span>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>

            {/* M14 — Revogar consentimento (LGPD Art. 18-IX) */}
            <button
              onClick={() => setShowRevokeConsent(true)}
              className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-sm border border-amber-200/60 active:bg-amber-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <ShieldOff size={20} className="text-amber-600" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-amber-800 block">Revogar Consentimento</span>
                <span className="text-xs text-amber-600/80">LGPD Art. 18-IX — revogação</span>
              </div>
              <ChevronRight size={18} className="text-amber-400" />
            </button>

            {/* Delete Account - danger item */}
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-sm border border-destructive/20 active:bg-destructive/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-destructive" />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-destructive">Excluir Conta</span>
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
