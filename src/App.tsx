import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { FamilyGroupProvider } from "@/hooks/useFamilyGroup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

// Lazy-loaded routes (code-split into separate chunks)
// Lazy chunk import functions (reused for prefetching)
const importAgenda = () => import("./pages/Agenda");
const importFamilia = () => import("./pages/Familia");
const importAjustes = () => import("./pages/Ajustes");
const importFamiliarProfile = () => import("./pages/FamiliarProfile");
const importProntuario = () => import("./pages/Prontuario");
const importConsultas = () => import("./pages/Consultas");
const importMedicamentos = () => import("./pages/Medicamentos");
const importMedicamentosGeral = () => import("./pages/MedicamentosGeral");
const importExames = () => import("./pages/Exames");
const importNotificacoes = () => import("./pages/Notificacoes");
const importMinhaSaude = () => import("./pages/MinhaSaude");
const importMeusDados = () => import("./pages/MeusDados");
const importGerenciarFamilia = () => import("./pages/GerenciarFamilia");
const importAlergias = () => import("./pages/Alergias");
const importDoencas = () => import("./pages/Doencas");
const importVacinas = () => import("./pages/Vacinas");
const importSeguranca = () => import("./pages/Seguranca");
const importGestaoAcessos = () => import("./pages/GestaoAcessos");

const Agenda = lazy(importAgenda);
const Familia = lazy(importFamilia);
const Ajustes = lazy(importAjustes);
const FamiliarProfile = lazy(importFamiliarProfile);
const Prontuario = lazy(importProntuario);
const Consultas = lazy(importConsultas);
const Medicamentos = lazy(importMedicamentos);
const MedicamentosGeral = lazy(importMedicamentosGeral);
const Exames = lazy(importExames);
const Notificacoes = lazy(importNotificacoes);
const MinhaSaude = lazy(importMinhaSaude);
const MeusDados = lazy(importMeusDados);
const GerenciarFamilia = lazy(importGerenciarFamilia);
const Alergias = lazy(importAlergias);
const Doencas = lazy(importDoencas);
const Vacinas = lazy(importVacinas);
const Seguranca = lazy(importSeguranca);
const GestaoAcessos = lazy(importGestaoAcessos);

// Prefetch functions exported for use by AppLayout and BottomNav
export const prefetchCriticalChunks = () => {
  importAgenda();
  importFamilia();
  importAjustes();
  importMinhaSaude();
  importConsultas();
  importMedicamentos();
  importExames();
};

export const prefetchByRoute: Record<string, () => void> = {
  "/agenda": importAgenda,
  "/familia": importFamilia,
  "__drawer_saude__": importMinhaSaude,
  "/gerenciar-familia": importGerenciarFamilia,
  "/ajustes": importAjustes,
};

const RouteLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-[#f2f0eb] z-50">
    <img
      src="/logo-locus-vita.svg"
      alt="Locus Vita"
      className="w-20 h-20 animate-breathing"
    />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <FamilyGroupProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Suspense fallback={<RouteLoader />}><Login /></Suspense>} />
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/familia" element={<Familia />} />
              <Route path="/ajustes" element={<Ajustes />} />
              <Route path="/meus-dados" element={<MeusDados />} />
              <Route path="/gerenciar-familia" element={<GerenciarFamilia />} />
              <Route path="/familiar/:id/saude" element={<MinhaSaude />} />
              <Route path="/familiar/:id/prontuario" element={<Prontuario />} />
              <Route path="/familiar/:id" element={<FamiliarProfile />} />
              <Route path="/familiar/:id/consultas" element={<Consultas />} />
              <Route path="/familiar/:id/medicamentos" element={<Medicamentos />} />
              <Route path="/medicamentos" element={<MedicamentosGeral />} />
              <Route path="/familiar/:id/exames" element={<Exames />} />
              <Route path="/familiar/:id/alergias" element={<Alergias />} />
              <Route path="/familiar/:id/doencas" element={<Doencas />} />
              <Route path="/familiar/:id/vacinas" element={<Vacinas />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/seguranca" element={<Seguranca />} />
              <Route path="/gestao-acessos" element={<GestaoAcessos />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </FamilyGroupProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
