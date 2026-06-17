import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fingerprint, Eye, EyeOff, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Seguranca.tsx
 *
 * C3 — Biometria: toggle fake (localStorage) removido. Substituído por card
 *      informativo "em breve" para não induzir o usuário a acreditar que tem
 *      proteção biométrica real. WebAuthn real será implementado futuramente.
 *
 * A2 — Senha atual: antes era campo decorativo (valor ignorado). Agora verifica
 *      a senha atual via supabase.auth.signInWithPassword antes de atualizar.
 */
const Seguranca = () => {
  const navigate = useNavigate();

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

        {/* C3 — Biometria: card informativo "em breve" (toggle falso removido) */}
        <div className="bg-card rounded-xl p-4 shadow-xs border border-border/40 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Acesso Rápido</h2>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Fingerprint size={20} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Biometria / Face ID</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#78C2AD]/15 text-[#4a9a8a]">
                  <Clock size={9} />
                  Em breve
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Autenticação biométrica (WebAuthn / FIDO2) será disponibilizada em breve. Por enquanto, o acesso é protegido pela sua senha.
              </p>
            </div>
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
