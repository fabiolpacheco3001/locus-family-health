import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import locusVitaLogo from "@/assets/locus-vita-logo-landing.jpeg";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error("E-mail ou senha incorretos. Tente novamente.");
        setLoading(false);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        toast.error("Erro inesperado. Tente novamente.");
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (roleData?.role === "super_admin" || roleData?.role === "admin") {
        toast.success("Bem-vindo ao Command Center.");
        navigate("/command_center", { replace: true });
      } else {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Esta área é restrita a administradores.");
      }
    } catch {
      toast.error("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail.");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("E-mail de recuperação enviado. Verifique sua caixa de entrada.");
      setMode("login");
    } catch {
      toast.error("Erro ao enviar e-mail de recuperação.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#1C3333" }}>
      <Card className="w-full max-w-md shadow-2xl border-0" style={{ backgroundColor: "#f2f0eb" }}>
        <CardContent className="pt-10 pb-8 px-8">
          <div className="flex flex-col items-center gap-3 mb-8">
            <img src={locusVitaLogo} alt="Locus Vita" className="h-16 w-auto rounded-lg" />
            <div className="text-center">
              <h1 className="text-xl font-bold" style={{ color: "#1C3333" }}>
                Locus Vita — Command Center
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "login" ? "Acesso restrito a Administradores" : "Recuperação de senha"}
              </p>
            </div>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@locustech.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full text-white font-semibold"
                style={{ backgroundColor: "#1C3333" }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Autenticando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>

              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-email">E-mail cadastrado</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="admin@locustech.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <Button
                type="submit"
                className="w-full text-white font-semibold"
                style={{ backgroundColor: "#1C3333" }}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Voltar ao login
              </button>
            </form>
          )}

          <p className="text-xs text-center text-muted-foreground mt-6">
            Acesso controlado internamente. Contate o Super Admin para credenciais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
