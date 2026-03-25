import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Agenda from "./pages/Agenda";
import Familia from "./pages/Familia";
import Ajustes from "./pages/Ajustes";
import FamiliarProfile from "./pages/FamiliarProfile";
import Prontuario from "./pages/Prontuario";
import Consultas from "./pages/Consultas";
import Medicamentos from "./pages/Medicamentos";
import MedicamentosGeral from "./pages/MedicamentosGeral";
import Exames from "./pages/Exames";
import Notificacoes from "./pages/Notificacoes";
import MinhaSaude from "./pages/MinhaSaude";
import MeusDados from "./pages/MeusDados";
import GerenciarFamilia from "./pages/GerenciarFamilia";
import Alergias from "./pages/Alergias";
import Doencas from "./pages/Doencas";
import Vacinas from "./pages/Vacinas";
import Seguranca from "./pages/Seguranca";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
