/**
 * AppLockScreen
 *
 * Full-screen biometric unlock overlay shown by the App Lock feature.
 * Appears when the user resumes the PWA after a passkey is registered.
 *
 * - "Desbloquear com Face ID" → authenticatePasskey() → onUnlock()
 * - "Usar outra conta" → signOut() (falls back to login page)
 */

import { useState } from "react";
import { Fingerprint, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authenticatePasskey } from "@/lib/webauthn";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AppLockScreenProps {
  onUnlock: () => void;
}

export function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleBiometric = async () => {
    setIsLoading(true);
    try {
      await authenticatePasskey();
      onUnlock();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro na verificação biométrica. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f2f0eb] px-6">
      {/* Logo */}
      <img
        src="/logo-carregamento.svg"
        alt="Locus Vita"
        className="w-24 h-24 mb-8"
      />

      {/* Greeting */}
      <h1 className="text-2xl font-bold text-foreground mb-1">Bem-vindo de volta</h1>
      <p className="text-sm text-muted-foreground mb-10 text-center">
        {user?.email}
      </p>

      {/* Biometric button */}
      <Button
        size="lg"
        className="w-full max-w-xs gap-3 text-base h-14"
        onClick={handleBiometric}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Fingerprint className="h-5 w-5" />
        )}
        {isLoading ? "Verificando..." : "Entrar"}
      </Button>

      {/* Fallback sign-out */}
      <button
        className="mt-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={handleSignOut}
        disabled={isLoading}
      >
        <LogOut className="h-4 w-4" />
        Usar outra conta
      </button>
    </div>
  );
}
