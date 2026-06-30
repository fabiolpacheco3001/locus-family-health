/**
 * AppLockScreen
 *
 * Full-screen biometric unlock overlay shown by the App Lock feature.
 * Appears when the user resumes the PWA after a passkey is registered.
 *
 * - "Desbloquear com Face ID" → authenticatePasskey() → onUnlock()
 * - "Usar outra conta" → signOut() (falls back to login page)
 */

import { useState, useEffect, useRef } from "react";
import { Fingerprint, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authenticatePasskey, fetchWebAuthnChallenge } from "@/lib/webauthn";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AppLockScreenProps {
  onUnlock: () => void;
}

export function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fetch the WebAuthn challenge as soon as the lock screen mounts.
  // The edge function cold-start (2-5 s) runs in the background while the
  // user reads the screen. When they tap "Entrar", the challenge is already
  // resolved → OS Face ID dialog appears immediately instead of after ~7 s.
  //
  // Challenge TTL is typically 60 s server-side — plenty of time.
  // On error, challengeRef stays null and authenticatePasskey fetches on demand.
  const challengeRef = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    challengeRef.current = fetchWebAuthnChallenge().catch(() => null);
  }, []);

  const handleBiometric = async () => {
    setIsLoading(true);
    try {
      const prefetched = await challengeRef.current;
      await authenticatePasskey(prefetched ?? undefined);
      onUnlock();
    } catch (err) {
      // Reset so the next tap triggers a fresh challenge fetch
      challengeRef.current = null;
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
