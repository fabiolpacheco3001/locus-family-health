import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fingerprint, Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePasskeys } from "@/hooks/usePasskeys";
import { browserSupportsWebAuthn } from "@/lib/webauthn";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Detecta o nome do dispositivo a partir do User-Agent sem dependências externas. */
function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) {
    const match = ua.match(/;\s*([^;)]+)\sBuild\//);
    return match ? match[1].trim() : "Android";
  }
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Dispositivo";
}

/**
 * Seguranca.tsx
 *
 * BK-02 — Biometria: WebAuthn real (FaceID / TouchID / impressão digital).
 *          Usa native browser Credential Management API + @simplewebauthn/server
 *          via edge functions (webauthn-challenge + webauthn-verify).
 *
 * A2 — Senha atual: verifica via supabase.auth.signInWithPassword antes de
 *      atualizar (campo não é decorativo).
 */
const Seguranca = () => {
  const navigate = useNavigate();

  // ── Biometria ──────────────────────────────────────────────────────────────
  const { passkeys, isLoading: passkeyLoading, register, remove } = usePasskeys();
  const [isToggling, setIsToggling] = useState(false);
  const webAuthnSupported = browserSupportsWebAuthn();

  const hasPasskey = passkeys.length > 0;
  const activePasskey = passkeys[0] ?? null;

  const handleToggle = async (enabled: boolean) => {
    if (isToggling || register.isPending || remove.isPending) return;
    setIsToggling(true);
    try {
      if (enabled) {
        // Avisa o usuário para selecionar "Senhas" (iCloud Keychain) no picker nativo do iOS.
        // Esse picker é obrigatório na primeira vez — nas próximas, o Face ID age direto.
        toast.info('Selecione "Senhas" (ícone de chaves) para o Face ID funcionar automaticamente.', {
          duration: 6000,
        });
        await register.mutateAsync(getDeviceName());
      } else {
        // Desliga: remove a passkey do DB (iCloud Keychain retém a chave, mas o app não a usa mais)
        if (!activePasskey) return;
        if (!confirm("Desativar o acesso com Face ID / biometria?")) return;
        await remove.mutateAsync(activePasskey.id);
      }
    } finally {
      setIsToggling(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    const d = parseISO(iso);
    return isValid(d) ? format(d, "dd/MM/yyyy", { locale: ptBR }) : null;
  };

  // ── Alterar senha ──────────────────────────────────────────────────────────
  const [senhaAtual, setSenhaAtual]     = useState("");
  const [novaSenha, setNovaSenha]       = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showAtual, setShowAtual]       = useState(false);
  const [showNova, setShowNova]         = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading]           = useState(false);

  const handleUpdatePassword = async () => {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      toast.error("Preencha todos os campos.");
      return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(novaSenha)) {
      toast.error("A senha deve ter no mínimo 8 caracteres, contendo letra maiúscula, número e caractere especial.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      // A2 — Verificar senha atual ANTES de atualizar
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;

      if (!email) {
        toast.error("Não foi possível identificar sua conta. Faça login novamente.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: senhaAtual,
      });

      if (signInError) {
        toast.error("Senha atual incorreta. Verifique e tente novamente.");
        return;
      }

      // Senha atual válida — pode atualizar
      const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha });
      if (updateError) throw updateError;

      toast.success("Senha atualizada com sucesso!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    } catch {
      toast.error("Erro inesperado ao atualizar senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none ring-offset-background pr-10";

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10 animate-fade-in">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pt-6 mb-4">
        <button type="button" aria-label="Voltar" onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Segurança</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-6">

        {/* BK-02 — Biometria: WebAuthn real (FaceID / TouchID / fingerprint) */}
        <div className="bg-card rounded-xl p-4 shadow-xs border border-border/40 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Fingerprint size={16} className="text-[#78C2AD] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  Acessar com Face ID / Biometria
                </p>
                {!webAuthnSupported ? (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    Não suportado neste navegador. Use Safari (iOS 16+) ou Chrome (Android).
                  </p>
                ) : passkeyLoading ? (
                  <p className="text-xs text-muted-foreground mt-0.5">Carregando...</p>
                ) : hasPasskey && activePasskey ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ativo · {activePasskey.device_name}
                    {activePasskey.created_at ? ` · desde ${formatDate(activePasskey.created_at)}` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    Desbloqueie o app com Face ID ao abri-lo. Na ativação, selecione <strong>Senhas</strong> no iOS.
                  </p>
                )}
              </div>
            </div>

            {/* Toggle — só renderiza quando WebAuthn é suportado */}
            {webAuthnSupported && (
              <div className="shrink-0">
                {(isToggling || register.isPending || remove.isPending) ? (
                  <Loader2 size={20} className="animate-spin text-[#78C2AD]" />
                ) : (
                  <Switch
                    checked={hasPasskey}
                    onCheckedChange={handleToggle}
                    disabled={passkeyLoading}
                    aria-label="Ativar acesso com Face ID"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Alterar Senha */}
        <div className="bg-card rounded-xl p-4 shadow-xs border border-border/40 space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#78C2AD]" />
            <h2 className="text-sm font-semibold text-foreground">Alterar Senha</h2>
          </div>

          {/* A2 — Campo "Senha Atual" agora é validado no backend */}
          <div className="space-y-1.5">
            <Label>Senha Atual</Label>
            <div className="relative">
              <input
                type={showAtual ? "text" : "password"}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
              <button
                type="button"
                aria-label={showAtual ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowAtual(!showAtual)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showAtual ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nova Senha</Label>
            <div className="relative">
              <input
                type={showNova ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Ex: MinhaS3nh@Forte!"
                className={inputClass}
              />
              <button
                type="button"
                aria-label={showNova ? "Ocultar nova senha" : "Mostrar nova senha"}
                onClick={() => setShowNova(!showNova)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showNova ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
              Mínimo 8 caracteres · letra maiúscula · número · caractere especial (@$!%*?&)
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Confirmar Nova Senha</Label>
            <div className="relative">
              <input
                type={showConfirmar ? "text" : "password"}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                className={inputClass}
              />
              <button
                type="button"
                aria-label={showConfirmar ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                onClick={() => setShowConfirmar(!showConfirmar)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleUpdatePassword}
            disabled={loading}
            className="w-full bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-black font-semibold border-none"
          >
            {loading ? "Verificando..." : "Atualizar Senha"}
          </Button>
        </div>

        {/* Spacer para não cortar atrás do BottomNav */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default Seguranca;
