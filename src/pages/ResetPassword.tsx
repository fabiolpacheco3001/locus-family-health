import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import locusvitaLogo from "@/assets/locus-vita-logo.jpeg";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Start as "pending" — we assume recovery until proven otherwise
  const [status, setStatus] = useState<"pending" | "recovery" | "invalid">("pending");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("recovery");
      }
    });

    // Check URL for recovery indicators (hash-based or PKCE code)
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const hasRecoveryHash = hash.includes("type=recovery");
    const hasPkceCode = params.has("code");

    if (hasRecoveryHash || hasPkceCode) {
      // If PKCE code present, Supabase client will exchange it automatically
      // and fire PASSWORD_RECOVERY event. Set a timeout as fallback.
      const timeout = setTimeout(() => {
        setStatus((prev) => (prev === "pending" ? "invalid" : prev));
      }, 8000);
      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    } else {
      // No recovery params at all — invalid link
      setStatus("invalid");
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Senha atualizada com sucesso!");
    navigate("/home");
  };

  if (status === "pending") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
        <div className="flex-1 flex flex-col items-center justify-center px-8 animate-fade-in">
          <img src={locusvitaLogo} alt="Locus Vita" className="w-24 h-24 object-cover rounded-2xl shadow-md mb-6" />
          <Loader2 className="animate-spin text-muted-foreground" size={28} />
          <p className="text-muted-foreground text-sm text-center mt-4">
            Validando link de recuperação...
          </p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
        <div className="flex-1 flex flex-col items-center justify-center px-8 animate-fade-in">
          <img src={locusvitaLogo} alt="Locus Vita" className="w-24 h-24 object-cover rounded-2xl shadow-md mb-6" />
          <p className="text-muted-foreground text-sm text-center">
            Link de recuperação inválido ou expirado.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate("/login")}
          >
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
      <div className="flex-1 flex flex-col justify-center px-8 py-12 animate-fade-in">
        <div className="flex flex-col items-center mb-10">
          <img src={locusvitaLogo} alt="Locus Vita" className="w-24 h-24 object-cover rounded-2xl shadow-md mb-4" />
          <h1 className="text-lg font-semibold text-foreground">Nova Senha</h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            Digite sua nova senha abaixo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nova senha</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
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
            <label className="text-sm font-medium text-foreground">Confirmar senha</label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Salvar nova senha"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
