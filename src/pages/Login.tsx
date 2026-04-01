import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import locusvitaLogo from "@/assets/locus-vita-logo-splash.svg";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";

type ViewMode = "login" | "forgot";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan") as "monthly" | "annual" | null;
  const { signIn, user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && !planFromUrl) {
      navigate("/home", { replace: true });
    }
  }, [authLoading, user, planFromUrl, navigate]);
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Digite seu e-mail.");
      return;
    }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    toast.success("Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes.");
    setViewMode("login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    setLoading(false);

    if (error) {
      toast.error("E-mail ou senha incorretos. Tente novamente.");
      return;
    }

    // Express checkout tunnel — wait for session to stabilize
    if (planFromUrl) {
      setCheckoutLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const url = await createSubscription(planFromUrl);
        window.location.href = url;
        return;
      } catch (err: any) {
        setCheckoutLoading(false);
        toast.error("Conta criada, mas houve um erro ao redirecionar para o pagamento: " + (err?.message || "Tente novamente na aba Ajustes."));
        navigate("/home");
        return;
      }
    }

    {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        queryClient.prefetchQuery({
          queryKey: ["medications", "all"],
          queryFn: async () => {
            const { data } = await supabase
              .from("medications")
              .select("*, consultations(professional_name, specialty), family_members(name)")
              .eq("user_id", currentUser.id)
              .order("created_at", { ascending: false });
            return data ?? [];
          },
          staleTime: 5 * 60 * 1000,
        });
        queryClient.prefetchQuery({
          queryKey: ["family_members", currentUser.id],
          queryFn: async () => {
            const { data } = await supabase
              .from("family_members")
              .select("*")
              .is("deleted_at", null)
              .order("created_at", { ascending: true });
            return data ?? [];
          },
          staleTime: 5 * 60 * 1000,
        });
        queryClient.prefetchQuery({
          queryKey: ["notifications", currentUser.id],
          queryFn: async () => {
            const { data } = await supabase
              .from("notifications")
              .select("*")
              .eq("user_id", currentUser.id)
              .order("created_at", { ascending: false });
            return data ?? [];
          },
          staleTime: 5 * 60 * 1000,
        });
      }
      navigate("/home");
    }
  };

  // Full-screen checkout overlay
  if (checkoutLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f2f0eb] animate-fade-in">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <p className="text-lg font-semibold text-foreground">Preparando seu ambiente seguro de pagamento...</p>
        <p className="text-sm text-muted-foreground mt-2">Você será redirecionado em instantes.</p>
      </div>
    );
  }

  // Forgot password view
  if (viewMode === "forgot") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
        <div className="flex-1 flex flex-col justify-center px-8 py-12 animate-fade-in">
          <div className="flex flex-col items-center mb-10">
            <img src={locusvitaLogo} alt="Locus Vita" className="w-24 h-24 object-cover rounded-2xl shadow-md mb-4" />
            <h1 className="text-lg font-semibold text-foreground">Recuperar Senha</h1>
            <p className="text-muted-foreground text-sm mt-1 text-center">
              Digite seu e-mail para receber o link de recuperação.
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">E-mail</label>
              <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Enviar link de recuperação"}
            </Button>
          </form>

          <button
            onClick={() => setViewMode("login")}
            className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors text-center"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
      <div className="flex-1 flex flex-col justify-center px-8 py-12 animate-fade-in">
        <div className="flex flex-col items-center mb-12">
          <img src={locusvitaLogo} alt="Locus Vita" className="h-32 w-auto mb-4" />
          <p className="text-muted-foreground text-sm mt-1">Saúde Familiar Simplificada</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">E-mail</label>
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Senha</label>
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

          <button
            type="button"
            onClick={() => setViewMode("forgot")}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Esqueci minha senha
          </button>

          <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={loading}>
            {loading ? <><Loader2 className="animate-spin mr-2" size={20} /> Entrando...</> : "Entrar"}
          </Button>
        </form>

        <button
          onClick={() => navigate(planFromUrl ? `/cadastro?plan=${planFromUrl}` : "/cadastro")}
          className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors text-center"
        >
          Ainda não tem conta? <span className="font-semibold underline">Crie aqui</span>
        </button>
      </div>
    </div>
  );
};

export default Login;
