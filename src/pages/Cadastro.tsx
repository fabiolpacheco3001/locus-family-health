import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import locusvitaLogo from "@/assets/locus-vita-logo-splash.svg";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createSubscription } from "@/services/asaasService";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { captureException } from "@/lib/sentry";
import { signupSchema, signupDefaultValues, type SignupInput } from "@/lib/schemas/auth";

/** Registra o consentimento LGPD na tabela consent_log após o cadastro. */
async function logConsent(userId: string) {
  const userAgent = navigator.userAgent.slice(0, 500);
  const records = [
    { user_id: userId, consent_type: "privacy_policy",  policy_version: "1.0", user_agent: userAgent },
    { user_id: userId, consent_type: "health_data",     policy_version: "1.0", user_agent: userAgent },
  ];
  const { error } = await supabase.from("consent_log").insert(records);
  if (error) {
    // [ID-015] Non-blocking — falha de consent_log não impede o cadastro.
    // captureException encaminha para Sentry sem expor erro no browser console.
    captureException(error, { context: "logConsent" });
  }
}

const Cadastro = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan") as "monthly" | "annual" | null;
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // [ID-016] Validação centralizada via Zod — src/lib/schemas/auth.ts
  // (inclui LGPD Art. 11: consentAccepted deve ser exatamente `true`)
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: signupDefaultValues,
  });

  // Clear any stale cached session and subscription cache to prevent auth limbo
  // and cross-user localStorage contamination (lv_sub_cache must not leak between sessions).
  useEffect(() => {
    try { localStorage.removeItem("lv_sub_cache"); } catch { /* ignore */ }
    supabase.auth.signOut();
  }, []);

  const handleSave = async (data: SignupInput) => {
    setLoading(true);
    const { error } = await signUp(data.email, data.password, data.name);
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

    // Registra consentimento LGPD — busca userId da sessão criada pelo signUp
    // (non-blocking — não impede o fluxo se falhar)
    const { data: sessionData } = await supabase.auth.getUser();
    if (sessionData?.user?.id) {
      await logConsent(sessionData.user.id);
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

    toast.success("Conta criada com sucesso!");
    navigate("/home");
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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
      <div className="flex-1 flex flex-col justify-center px-8 py-12 animate-fade-in">
        <div className="flex flex-col items-center mb-10">
          <img src={locusvitaLogo} alt="Locus Vita" className="w-32 h-32 object-cover rounded-3xl shadow-md mb-4" />
          <h1 className="text-lg font-semibold text-foreground">Criar sua Conta</h1>
          <p className="text-muted-foreground text-sm mt-1">Saúde Familiar Simplificada</p>
        </div>

        <p className="text-xs text-muted-foreground text-center mb-3 font-medium">
          Criar conta rapidamente
        </p>
        <SocialLoginButtons context="cadastro" planFromUrl={planFromUrl} />

        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4" noValidate>
          <p className="text-xs text-muted-foreground">
            Campos marcados com <span className="text-destructive">*</span> são obrigatórios.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="signup-name" className="text-sm font-medium text-foreground">
              Nome <span className="text-destructive">*</span>
            </label>
            <Input id="signup-name" placeholder="Ex: João da Silva" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-email" className="text-sm font-medium text-foreground">
              E-mail <span className="text-destructive">*</span>
            </label>
            <Input id="signup-email" type="email" placeholder="seu@email.com" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-password" className="text-sm font-medium text-foreground">
              Senha <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                className="pr-10"
                {...form.register("password")}
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-confirm" className="text-sm font-medium text-foreground">
              Confirmar Senha <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                id="signup-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Repita a senha"
                className={`pr-10 ${form.formState.errors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                {...form.register("confirmPassword")}
              />
              <button
                type="button"
                aria-label={showConfirm ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-red-500 font-medium">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          {/* LGPD Art. 11 — Consentimento para tratamento de dados de saúde */}
          <div className="space-y-1">
            <label
              className={`flex items-start gap-3 cursor-pointer select-none p-3 rounded-xl border transition-colors ${
                form.formState.errors.consentAccepted
                  ? "border-red-400 bg-red-50"
                  : form.watch("consentAccepted")
                  ? "border-[#78C2AD]/60 bg-[#78C2AD]/5"
                  : "border-border/40 bg-card"
              }`}
            >
              <input
                type="checkbox"
                {...form.register("consentAccepted")}
                className="mt-0.5 w-4 h-4 accent-[#78C2AD] shrink-0 cursor-pointer"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                Concordo com a{" "}
                <Link
                  to="/politica-de-privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#78C2AD] underline underline-offset-2 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  Política de Privacidade
                </Link>{" "}
                e autorizo o tratamento dos meus dados de saúde pelo Locus Vita,
                conforme a LGPD (Art. 11).
              </span>
            </label>
            {form.formState.errors.consentAccepted && (
              <p className="text-xs text-red-500 font-medium pl-1">
                {form.formState.errors.consentAccepted.message}
              </p>
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
          onClick={() => navigate(planFromUrl ? `/login?plan=${planFromUrl}` : "/login")}
          className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors text-center"
        >
          Já tem uma conta? <span className="font-semibold underline">Entrar</span>
        </button>
      </div>
    </div>
  );
};

export default Cadastro;
