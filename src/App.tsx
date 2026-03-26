import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

// Lazy-loaded routes (code-split into separate chunks)
const Agenda = lazy(() => import("./pages/Agenda"));
const Familia = lazy(() => import("./pages/Familia"));
const Ajustes = lazy(() => import("./pages/Ajustes"));
const FamiliarProfile = lazy(() => import("./pages/FamiliarProfile"));
const Prontuario = lazy(() => import("./pages/Prontuario"));
const Consultas = lazy(() => import("./pages/Consultas"));
const Medicamentos = lazy(() => import("./pages/Medicamentos"));
const MedicamentosGeral = lazy(() => import("./pages/MedicamentosGeral"));
const Exames = lazy(() => import("./pages/Exames"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const MinhaSaude = lazy(() => import("./pages/MinhaSaude"));
const MeusDados = lazy(() => import("./pages/MeusDados"));
const GerenciarFamilia = lazy(() => import("./pages/GerenciarFamilia"));
const Alergias = lazy(() => import("./pages/Alergias"));
const Doencas = lazy(() => import("./pages/Doencas"));
const Vacinas = lazy(() => import("./pages/Vacinas"));
const Seguranca = lazy(() => import("./pages/Seguranca"));

const RouteLoader = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f2f0eb] z-50">
    <img
      src="/logo-locus-vita.svg"
      alt="Locus Vita"
      className="w-16 h-16 mb-4 animate-pulse"
    />
    <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
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
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
