import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "authorized" | "denied">("loading");

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
          setStatus("authorized");
        } else {
          setStatus("denied");
        }
      });
  }, [user, authLoading]);

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f2f0eb] z-50">
        <img src="/logo-locus-vita.svg" alt="Locus Vita" className="w-20 h-20 animate-breathing" />
      </div>
    );
  }

  if (status === "denied") {
    toast.error("Acesso negado.");
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
