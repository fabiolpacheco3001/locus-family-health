import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import MobileShell from "@/components/MobileShell";
import { useAuth } from "@/hooks/useAuth";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = isSignUp
      ? await signUp(email, password, name)
      : await signIn(email, password);

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (isSignUp) {
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    } else {
      navigate("/home");
    }
  };

  return (
    <MobileShell>
      <div className="flex-1 flex flex-col justify-center px-8 py-12 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Heart className="text-primary-foreground" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Locus Vita</h1>
          <p className="text-muted-foreground text-sm mt-1">Saúde familiar simplificada</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Nome</label>
              <Input placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">E-mail</label>
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : isSignUp ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors text-center"
        >
          {isSignUp ? "Já tem uma conta? Entrar" : "Criar nova conta familiar"}
        </button>
      </div>
    </MobileShell>
  );
};

export default Login;
