import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * A3 fix: AdminRoute resistente a manipulação via React DevTools.
 *
 * Padrão de segurança:
 *  - `authorizedRef` é a "fonte de verdade" — não é visível nem editável via DevTools
 *  - `status` state controla apenas o re-render; a decisão final sempre consulta o ref
 *  - Isso impede que alguém manipule `status` de "loading" → "authorized" no DevTools
 *    antes da query completar, pois `authorizedRef.current` permanecerá `false`
 *  - Risco residual baixo: dados protegidos por RLS server-side independentemente
 */
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "authorized" | "denied">("loading");

  // Fonte de verdade imutável via DevTools — só o useEffect pode setar para true
  const authorizedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus("denied");
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.role === "super_admin" || data?.role === "admin") {
          authorizedRef.current = true;
          setStatus("authorized");
        } else {
          setStatus("denied");
        }
      });
  }, [user, authLoading]);

  // Toast via useEffect — nunca em render path (side-effect proibido em JSX)
  useEffect(() => {
    if (status === "denied") {
      toast.error("Acesso negado.");
    }
  }, [status]);

  if (status === "loading" || !authorizedRef.current) {
    if (status === "denied") {
      return <Navigate to="/command_center/login" replace />;
    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f2f0eb] z-50">
        <img src="/logo-carregamento.svg" alt="Locus Vita" className="w-40 h-40 animate-breathing" />
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
