import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fingerprint, Eye, EyeOff, Lock, Plus, Trash2, Loader2, SmartphoneNfc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePasskeys } from "@/hooks/usePasskeys";
import { browserSupportsWebAuthn } from "@/lib/webauthn";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const webAuthnSupported = browserSupportsWebAuthn();

  const handleRegister = async () => {
    const name = deviceName.trim() || undefined;
    await register.mutateAsync(name);
    setShowRegisterForm(false);
    setDeviceName("");
  };

  const handleRemove = (id: string, name: string) => {
    if (!confirm(`Remover a biometria "${name}"? Você poderá cadastrá-la novamente.`)) return;
    remove.mutate(id);
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
        <button onClick={() => navigate("/ajustes")} className="p-1">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Segurança</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-6">

        {/* BK-02 — Biometria: WebAuthn real (FaceID / TouchID / fingerprint) */}
        <div className="bg-card rounded-xl p-4 shadow-xs border border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint size={16} className="text-[#78C2AD]" />
              <h2 className="text-sm font-semibold text-foreground">Biometria / Face ID</h2>
            </div>
            {webAuthnSupported && !showRegisterForm && (
              <button
                onClick={() => setShowRegisterForm(true)}
                className="flex items-center gap-1 text-xs font-medium text-[#78C2AD] hover:text-[#4a9a8a] transition-colors"
              >
                <Plus size={14} />
                Cadastrar
              </button>
            )}
          </div>

          {/* Dispositivo não suportado */}
          {!webAuthnSupported && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Biometria não é suportada neste navegador ou dispositivo. Use Chrome, Safari ou Edge em iOS 16+ / Android.
            </p>
          )}

          {/* Formulário de cadastro inline */}
          {webAuthnSupported && showRegisterForm && (
            <div className="space-y-2 pt-1">
              <Label className="text-xs">Nome do dispositivo (opcional)</Label>
              <Input
                className="text-base h-10"
                placeholder="Ex: iPhone de Fábio"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleRegister(); }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleRegister()}
                  disabled={register.isPending}
                  className="flex-1 bg-[#A7D3CB] hover:bg-[#A7D3CB]/90 text-black font-semibold border-none"
                >
                  {register.isPending ? (
                    <><Loader2 size={14} className="animate-spin mr-1" />Aguardando biometria...</>
                  ) : "Cadastrar Biometria"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowRegisterForm(false); setDeviceName(""); }}
                  disabled={register.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Lista de passkeys cadastradas */}
          {webAuthnSupported && !showRegisterForm && (
            <>
              {passkeyLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 size={13} className="animate-spin" />
                  Carregando...
                </div>
              )}

              {!passkeyLoading && passkeys.length === 0 && (
                <div className="flex items-start gap-3 py-1">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <SmartphoneNfc size={18} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Nenhuma biometria cadastrada</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Cadastre sua biometria para acessar o app com FaceID, TouchID ou impressão digital.
                    </p>
                  </div>
                </div>
              )}

              {!passkeyLoading && passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center gap-3 py-2 border-t border-border/30 first:border-0">
                  <div className="w-9 h-9 rounded-full bg-[#78C2AD]/10 flex items-center justify-center shrink-0">
                    <Fingerprint size={17} className="text-[#78C2AD]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{pk.device_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Cadastrado em {formatDate(pk.created_at)}
                      {pk.last_used_at ? ` · Último uso: ${formatDate(pk.last_used_at)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(pk.id, pk.device_name)}
                    disabled={remove.isPending}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remover biometria"
                  >
                    {remove.isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              ))}
            </>
          )}
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
