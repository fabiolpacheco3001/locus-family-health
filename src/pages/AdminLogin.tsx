import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#1C3333" }}>
      <Card className="w-full max-w-md shadow-2xl border-0" style={{ backgroundColor: "#f2f0eb" }}>
        <CardContent className="pt-10 pb-8 px-8">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#A7D3CB" }}>
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold" style={{ color: "#1C3333" }}>
                Locus Vita — Command Center
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Acesso restrito a Administradores
              </p>
            </div>
          </div>

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
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Acesso controlado internamente. Contate o Super Admin para credenciais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
