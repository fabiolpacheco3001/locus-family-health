import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fingerprint, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Seguranca = () => {
  const navigate = useNavigate();
  const [biometria, setBiometria] = useState(() => localStorage.getItem("biometria") === "true");

  const handleBiometria = (checked: boolean) => {
    setBiometria(checked);
    localStorage.setItem("biometria", String(checked));
    if (checked) {
      toast.info("A ativação do Face ID / Touch ID (WebAuthn) será concluída quando o aplicativo estiver conectado ao servidor de segurança final.", { duration: 5000 });
    } else {
      toast("Biometria desativada. Você acessará o aplicativo apenas com sua senha.");
    }
  };
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);

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
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      toast.success("Senha atualizada com segurança!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    } catch {
      toast.error("Erro ao atualizar senha. Verifique a senha atual.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-[16px] max-w-full box-border min-w-0 appearance-none ring-offset-background pr-10";

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        <button onClick={() => navigate("/ajustes")} className="p-1">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Segurança</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain no-scrollbar">
        {/* Biometria */}
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border/40 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Acesso Rápido</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0">
              <Fingerprint size={20} className="text-black" />
            </div>
            <span className="flex-1 text-sm text-foreground">Usar Biometria / Face ID</span>
            <Switch checked={biometria} onCheckedChange={handleBiometria} />
          </div>
        </div>

        {/* Alterar Senha */}
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border/40 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Alterar Senha</h2>

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
                placeholder="Digite a nova senha"
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
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">Mínimo de 8 caracteres. Deve conter letra maiúscula, número e caractere especial.</p>
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
            {loading ? "Atualizando..." : "Atualizar Senha"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Seguranca;
