import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import locusvitaLogo from "@/assets/locus-vita-logo.jpeg";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { createSubscription } from "@/services/asaasService";

const Cadastro = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan") as "monthly" | "annual" | null;
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmError("");

    if (password !== confirmPassword) {
      setConfirmError("As senhas não coincidem.");
      return;
    }

    if (password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);

    if (error) {
      const msg = error.message?.includes("already registered")
        ? "Este e-mail já está cadastrado. Tente fazer login."
        : error.message?.includes("weak")
        ? "A senha é muito fraca. Use pelo menos 8 caracteres com letras e números."
        : error.message || "Erro ao criar conta. Tente novamente.";
      toast.error(msg);
      return;
    }

    toast.success("Conta criada com sucesso! Verifique seu e-mail para confirmar seu acesso.");
    navigate("/login");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
      <div className="flex-1 flex flex-col justify-center px-8 py-12 animate-fade-in">
        <div className="flex flex-col items-center mb-10">
          <img src={locusvitaLogo} alt="Locus Vita" className="w-32 h-32 object-cover rounded-3xl shadow-md mb-4" />
          <h1 className="text-lg font-semibold text-foreground">Criar sua Conta</h1>
          <p className="text-muted-foreground text-sm mt-1">Saúde Familiar Simplificada</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <Input placeholder="Ex: João da Silva" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">E-mail</label>
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Confirmar Senha</label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError("");
                }}
                className={`pr-10 ${confirmError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmError && (
              <p className="text-sm text-red-500 font-medium">{confirmError}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold mt-2"
            disabled={loading}
          >
            {loading ? <><Loader2 className="animate-spin mr-2" size={20} /> Criando conta...</> : "Criar Conta"}
          </Button>
        </form>

        <button
          onClick={() => navigate("/login")}
          className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors text-center"
        >
          Já tem uma conta? <span className="font-semibold underline">Entrar</span>
        </button>
      </div>
    </div>
  );
};

export default Cadastro;
