import { useNavigate, useLocation } from "react-router-dom";

const useSmartBack = (): (() => void) => {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    // 1. Explicit origin in state
    const from = (location.state as any)?.from;
    if (from) {
      navigate(from, { replace: true });
      return;
    }

    // 2. Deduce logical parent from pathname
    const path = location.pathname;
    const parts = path.split("/").filter(Boolean);

    // /notificacoes, /medicamentos → /home
    if (path === "/notificacoes" || path === "/medicamentos") {
      navigate("/home", { replace: true });
      return;
    }

    // /familiar/:id/consultas|medicamentos|exames → /familiar/:id
    if (parts.length === 3 && parts[0] === "familiar") {
      navigate(`/familiar/${parts[1]}`, { replace: true });
      return;
    }

    // /familiar/:id → /familia
    if (parts.length === 2 && parts[0] === "familiar") {
      navigate("/familia", { replace: true });
      return;
    }

    // 3. Fallback: Home
    navigate("/home", { replace: true });
  };
};

export default useSmartBack;
