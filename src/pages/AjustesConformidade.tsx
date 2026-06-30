import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, FileText, Download, ShieldOff, Trash2, Loader2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { usePasskeys } from "@/hooks/usePasskeys";
import { authenticatePasskey } from "@/lib/webauthn";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Tipos ──────────────────────────────────────────────────────────────────────
type ConformidadeAction =
  | { kind: "navigate"; path: string }
  | { kind: "export" }
  | { kind: "revoke" }
  | { kind: "delete" };

export interface ConformidadeItem {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  action: ConformidadeAction;
  danger?: boolean;
  warning?: boolean;
  accent?: boolean;
}

export const conformidadeItems: ConformidadeItem[] = [
  {
    icon: FileText,
    label: "Política de Privacidade",
    action: { kind: "navigate", path: "/politica-de-privacidade" },
  },
  {
    icon: Download,
    label: "Exportar Meus Dados",
    sublabel: "LGPD Art. 18-V — portabilidade",
    action: { kind: "export" },
    accent: true,
  },
  {
    icon: ShieldOff,
    label: "Revogar Consentimento",
    sublabel: "LGPD Art. 18-IX — revogação",
    action: { kind: "revoke" },
    warning: true,
  },
  {
    icon: Trash2,
    label: "Excluir Conta",
    action: { kind: "delete" },
    danger: true,
  },
];

const AjustesConformidade = () => {
  const navigate = useNavigate();
  const { user, getUserIdentities } = useAuth();
  const { passkeys } = usePasskeys();
  const hasPasskey = passkeys.length > 0;

  // GAP-4 — detecta se o usuário tem provedor e-mail/senha para reautenticação.
  // Usuários OAuth-only (Google/Apple sem senha) não podem fazer reauth por senha.
  // Mitigação v2.2: exibir mensagem de bloqueio. Solução v3.0: supabase.auth.reauthenticate().
  const [hasEmailProvider, setHasEmailProvider] = useState<boolean | null>(null);
  const identitiesFetched = useRef(false);
  useEffect(() => {
    if (identitiesFetched.current) return;
    identitiesFetched.current = true;
    getUserIdentities().then(({ data }) => {
      if (data?.identities) {
        setHasEmailProvider(data.identities.some((i: { provider: string }) => i.provider === "email"));
      }
    });
  }, [getUserIdentities]);

  // ── A15 — Exportar dados ───────────────────────────────────────────────────
  const [exportingData, setExportingData] = useState(false);

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const userEmail = userData?.user?.email;
      if (!userId) { toast.error("Sessão expirada. Faça login novamente."); return; }

      const { data: groupData } = await supabase
        .from("family_group_members")
        .select("group_id")
        .eq("auth_user_id", userId)
        .maybeSingle();
      const groupId = groupData?.group_id;
      if (!groupId) throw new Error("Usuário não está associado a um grupo familiar.");

      const { data: membersData } = await supabase
        .from("family_members")
        .select("id, name, birth_date, gender, member_type, relationship, blood_type")
        .eq("group_id", groupId)
        .is("deleted_at", null);
      const memberIds = (membersData ?? []).map((m: any) => m.id);

      const [
        medications, consultations, exams, vaccines, allergies, diseases,
        healthMeasurements, bloodPressure, menstrualCycles, petRoutines, consentLog,
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

      const payload = {
        exportedAt: new Date().toISOString(),
        exportVersion: "1.0",
        dataController: "Locus Tech — fabio@locustech.com.br",
        lgpdBasis: "Art. 18-V LGPD — Portabilidade de dados",
        account: { userId, email: userEmail },
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

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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

  // ── M14 — Revogar consentimento ────────────────────────────────────────────
  const [showRevokeConsent, setShowRevokeConsent] = useState(false);
  const [revokingConsent, setRevokingConsent] = useState(false);

  const handleRevokeConsent = async () => {
    setRevokingConsent(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) { toast.error("Sessão expirada. Faça login novamente."); return; }
      const { error } = await supabase.from("consent_log").insert([{
        user_id: userId,
        consent_type: "revoked",
        policy_version: "1.0",
        user_agent: navigator.userAgent.slice(0, 500),
      }]);
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

  // ── RX-01 — Excluir conta com reautenticação ───────────────────────────────
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error("Sessão expirada. Faça login novamente."); return; }
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

  const handleReauthAndDelete = async () => {
    if (reauthLoading || deleting) return;
    setReauthLoading(true);
    try {
      if (hasPasskey) {
        await authenticatePasskey();
      } else {
        if (!user?.email) { toast.error("Não foi possível identificar seu e-mail. Faça login novamente."); return; }
        if (!reauthPassword) { toast.error("Digite sua senha atual para confirmar."); return; }
        const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: reauthPassword });
        if (error) { toast.error("Senha incorreta. Tente novamente."); return; }
      }
      await handleDeleteAccount();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na confirmação. Tente novamente.");
    } finally {
      setReauthLoading(false);
    }
  };

  // ── Handler de ação por item ────────────────────────────────────────────────
  const handleAction = (action: ConformidadeAction) => {
    switch (action.kind) {
      case "navigate": navigate(action.path, { state: { from: "/ajustes/conformidade" } }); break;
      case "export":   handleExportData(); break;
      case "revoke":   setShowRevokeConsent(true); break;
      case "delete":   setShowDeleteAccount(true); break;
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-6 space-y-4 min-h-[calc(100%+1px)]">

          {/* Header com back */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 rounded-lg active:bg-muted/40"
              aria-label="Voltar"
            >
              <ChevronLeft size={24} className="text-foreground" />
            </button>
            <h1 className="font-bold text-foreground text-lg">Conformidade</h1>
          </div>

          {/* Itens */}
          <div className="space-y-2">
            {conformidadeItems.map((item) => {
              const Icon = item.icon;
              const isExporting = item.action.kind === "export" && exportingData;

              const containerClass = item.danger
                ? "w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-xs border border-destructive/20 active:bg-destructive/5 transition-colors"
                : item.warning
                ? "w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-xs border border-amber-200/60 active:bg-amber-50 transition-colors"
                : "w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-xs border border-border/40 active:bg-muted/40 transition-colors";

              const iconBg = item.danger
                ? "w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0"
                : item.warning
                ? "w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"
                : item.accent
                ? "w-10 h-10 rounded-full bg-[#78C2AD]/15 flex items-center justify-center shrink-0"
                : "w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0";

              const iconClass = item.danger ? "text-destructive" : item.warning ? "text-amber-600" : item.accent ? "text-[#78C2AD]" : "text-black";
              const labelClass = item.danger ? "text-sm font-medium text-destructive block" : item.warning ? "text-sm font-medium text-amber-800 block" : "text-sm font-medium text-foreground block";
              const chevronClass = item.danger ? "text-destructive/50" : item.warning ? "text-amber-400" : "text-muted-foreground";

              return (
                <button
                  key={item.label}
                  onClick={() => handleAction(item.action)}
                  disabled={isExporting}
                  className={`${containerClass} disabled:opacity-60`}
                  aria-label={item.label}
                >
                  <div className={iconBg}>
                    {isExporting
                      ? <Loader2 size={20} className="text-[#78C2AD] animate-spin" />
                      : <Icon size={20} className={iconClass} />
                    }
                  </div>
                  <div className="flex-1 text-left">
                    <span className={labelClass}>{item.label}</span>
                    {item.sublabel && (
                      <span className={`text-xs block ${item.warning ? "text-amber-600/80" : "text-muted-foreground"}`}>
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={18} className={chevronClass} />
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Dialog — Excluir Conta (RX-01) */}
      <AlertDialog
        open={showDeleteAccount}
        onOpenChange={(open) => { setShowDeleteAccount(open); if (!open) setReauthPassword(""); }}
      >
        <AlertDialogContent className="max-w-[340px] rounded-[24px] w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão de conta</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Esta ação é irreversível. Todos os seus dados e os dados de sua família serão apagados permanentemente.
              </span>
              <span className="block font-medium text-foreground">
                Para continuar, confirme sua identidade.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Reautenticação: passkey > senha > bloqueio OAuth-only */}
          {!hasPasskey && hasEmailProvider === true && (
            <div className="space-y-2 py-1">
              <Label htmlFor="reauth-password" className="text-sm">Sua senha atual</Label>
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
          {/* GAP-4 — OAuth-only: sem passkey e sem senha. Mitigação v2.2. */}
          {!hasPasskey && hasEmailProvider === false && (
            <div className="py-1 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800 leading-relaxed">
                Você acessa o Locus Vita via Google ou Apple e não possui senha cadastrada. Por ora,
                a exclusão de conta requer suporte. Entre em contato:{" "}
                <strong>suporte@locustech.com.br</strong>
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reauthLoading || deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReauthAndDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                reauthLoading || deleting ||
                (!hasPasskey && hasEmailProvider === true && !reauthPassword) ||
                (!hasPasskey && hasEmailProvider === false)
              }
            >
              {reauthLoading || deleting
                ? <Loader2 className="animate-spin" size={16} />
                : hasPasskey ? "Confirmar com Face ID / Touch ID" : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog — Revogar Consentimento (M14) */}
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
    </div>
  );
};

export default AjustesConformidade;
