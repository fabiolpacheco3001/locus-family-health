import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { captureException } from "@/lib/sentry";

/** Tipo mínimo de identidade retornado por getUserIdentities(). */
interface OAuthIdentity {
  id: string;
  provider: string;
  identity_data?: { email?: string };
}

const LoginSocial = () => {
  const navigate = useNavigate();
  const { getUserIdentities, unlinkIdentityAdmin } = useAuth();

  // ── Estado de identidades ──────────────────────────────────────────────────
  const [identities, setIdentities] = useState<OAuthIdentity[]>([]);
  const [loadingIdentities, setLoadingIdentities] = useState(true);
  const identitiesFetched = useRef(false);

  const fetchIdentities = async () => {
    setLoadingIdentities(true);
    try {
      const { data } = await getUserIdentities();
      if (data?.identities) {
        setIdentities(data.identities as OAuthIdentity[]);
      }
    } finally {
      setLoadingIdentities(false);
    }
  };

  useEffect(() => {
    if (identitiesFetched.current) return;
    identitiesFetched.current = true;
    fetchIdentities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Google ─────────────────────────────────────────────────────────────────
  const googleIdentity = identities.find((i) => i.provider === "google") ?? null;
  const hasGoogle = !!googleIdentity;

  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);

  const handleGoogleToggle = (enabled: boolean) => {
    // Apenas desvínculo é suportado aqui.
    // Vinculação requer o flag "Manual Linking" no Supabase Auth (não configurável
    // no Lovable Cloud) — direcionar o usuário a usar "Entrar com Google" na
    // tela de login com o mesmo e-mail para auto-vincular.
    if (!enabled) {
      setShowUnlinkDialog(true);
    }
  };

  const handleConfirmUnlink = async () => {
    if (!googleIdentity || unlinkingGoogle) return;
    setUnlinkingGoogle(true);
    try {
      // unlinkIdentity() do SDK falha com "Manual linking is disabled" no Lovable Cloud.
      // Usamos unlinkIdentityAdmin (edge function + Service Role) para contornar (LOCUS-VITA-S).
      const { error } = await unlinkIdentityAdmin(googleIdentity);
      if (error) {
        captureException(error, { action: "unlink_google" });
        // Mostrar mensagem real da edge function (ex: "Não é possível remover o único método de login")
        toast.error(error.message || "Não foi possível desvincular o Google.");
      } else {
        toast.success("Google desvinculado com sucesso.");
        await fetchIdentities();
      }
    } catch (err) {
      captureException(err, { action: "unlink_google_unexpected" });
      toast.error("Erro inesperado ao desvincular. Tente novamente.");
    } finally {
      setUnlinkingGoogle(false);
      setShowUnlinkDialog(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10 animate-fade-in">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pt-6 mb-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate(-1)}
          className="p-1"
        >
          <ChevronLeft size={22} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Login Social</h1>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-4">

        {/* Subtítulo */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          Conecte sua conta a um provedor social para entrar no Locus Vita sem digitar senha.
        </p>

        {/* Skeleton / loading */}
        {loadingIdentities && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={28} className="animate-spin text-[#78C2AD]" />
          </div>
        )}

        {!loadingIdentities && (
          <>
            {/* Google */}
            <div className="bg-card rounded-xl p-4 shadow-xs border border-border/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Logotipo Google (SVG inline) */}
                  <div className="w-10 h-10 rounded-full bg-white border border-border/40 flex items-center justify-center shrink-0 shadow-xs">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">Google</p>
                    {hasGoogle && googleIdentity?.identity_data?.email ? (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {googleIdentity.identity_data.email}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {hasGoogle ? "Conectado" : "Não conectado"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Toggle */}
                <div className="shrink-0">
                  {unlinkingGoogle ? (
                    <Loader2 size={20} className="animate-spin text-[#78C2AD]" />
                  ) : (
                    <Switch
                      checked={hasGoogle}
                      onCheckedChange={handleGoogleToggle}
                      // Vincular via toggle está desabilitado — o fluxo de vínculo
                      // requer "Manual Linking" no GoTrue (indisponível no Lovable Cloud).
                      // Usuários conectam via "Entrar com Google" na tela de login.
                      disabled={!hasGoogle}
                      aria-label={hasGoogle ? "Desvincular conta Google" : "Vincular conta Google — use o login com Google"}
                    />
                  )}
                </div>
              </div>

              {/* Caption quando Google não está vinculado */}
              {!hasGoogle && (
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Para conectar o Google, use{" "}
                  <strong className="text-foreground">Entrar com Google</strong>{" "}
                  na tela de login com o mesmo e-mail desta conta.
                </p>
              )}
            </div>

            {/* Apple — Em Breve */}
            <div className="bg-card rounded-xl p-4 shadow-xs border border-border/40 opacity-60">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0 shadow-xs">
                    {/* Logotipo Apple (SVG inline) */}
                    <svg viewBox="0 0 814 1000" className="w-5 h-5 fill-white" aria-hidden="true">
                      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.8-163.9-117.2c-50.6-67.4-93.8-180.6-93.8-289.6C179.3 293.7 307.6 218 411 218c73.2 0 134.6 48.7 181 48.7 44.1 0 113.7-52.8 198.6-52.8 31.5.1 108.2 4.3 155.5 54zm-181.4-167.9c28.7-33.9 49.8-81.4 49.8-128.9 0-6.5-.4-13.1-1.5-18.3-47.5 1.8-104 31.7-137.6 69.7-27.2 31-52.2 78.5-52.2 126.5 0 7.3.9 14.7 1.5 17.1 3 .5 7.6.7 12.2.7 43 0 95.7-28.7 127.8-66.8z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground leading-tight">Apple</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 uppercase tracking-wide">
                        Em Breve
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Disponível em breve</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Switch
                    checked={false}
                    disabled
                    aria-label="Apple Login — Em breve"
                  />
                </div>
              </div>
            </div>

            {/* Informação LGPD */}
            <div className="bg-[#78C2AD]/8 rounded-xl p-4 border border-[#78C2AD]/20">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ao conectar um provedor social, compartilhamos apenas seu e-mail e nome
                com o Locus Vita, conforme a <strong className="text-foreground">LGPD Art. 7, I</strong>.
                Você pode desvincular a qualquer momento.
              </p>
            </div>
          </>
        )}

        <div className="h-4" />
      </div>

      {/* AlertDialog — Confirmação de desvinculação */}
      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent className="max-w-[340px] rounded-[24px] w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular Google?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Você não poderá mais entrar no Locus Vita com sua conta Google.
              </span>
              <span className="block font-medium text-foreground">
                Certifique-se de ter outro método de acesso (e-mail/senha ou biometria)
                antes de desvincular.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinkingGoogle}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmUnlink(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={unlinkingGoogle}
            >
              {unlinkingGoogle
                ? <Loader2 className="animate-spin" size={16} />
                : "Desvincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LoginSocial;
