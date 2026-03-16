import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { CompanyGate } from "@/components/CompanyGate";
import { PrivateRoute } from "@/components/PrivateRoute";
import { ModuleGuard } from "@/components/ModuleGuard";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import SetPassword from "@/pages/SetPassword";
import Placeholder from "@/pages/Placeholder";
import Presenca from "@/pages/Presenca";
import Pessoas from "@/pages/Pessoas";
import Financeiro from "@/pages/Financeiro";
import CustoPessoal from "@/pages/CustoPessoal";
import Ferias from "@/pages/Ferias";
import SimuladorRescisao from "@/pages/SimuladorRescisao";
import Assistente from "@/pages/Assistente";
import Configuracoes from "@/pages/Configuracoes";
import SuperAdmin from "@/pages/SuperAdmin";
import Recrutamento from "@/pages/Recrutamento";
import RecrutamentoDashboardVagas from "@/pages/RecrutamentoDashboardVagas";

import Aniversariantes from "@/pages/Aniversariantes";
import Saude from "@/pages/Saude";
import SaudeImportar from "@/pages/SaudeImportar";
import BeneficiosVR from "@/pages/BeneficiosVR";
import AccessDenied from "@/pages/AccessDenied";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route element={<PrivateRoute />}>
                <Route
                  element={
                    <CompanyGate>
                      <AppLayout />
                    </CompanyGate>
                  }
                >
                  <Route path="/" element={<ModuleGuard module="dashboard"><Dashboard /></ModuleGuard>} />
                  <Route path="/presenca" element={<ModuleGuard module="colaboradores"><Presenca /></ModuleGuard>} />
                  <Route path="/colaboradores" element={<ModuleGuard module="colaboradores"><Pessoas /></ModuleGuard>} />
                  <Route path="/recrutamento" element={<ModuleGuard module="recrutamento"><Recrutamento /></ModuleGuard>} />
                  <Route path="/recrutamento/dashboard-vagas" element={<ModuleGuard module="recrutamento"><RecrutamentoDashboardVagas /></ModuleGuard>} />
                  
                  <Route path="/aniversariantes" element={<ModuleGuard module="aniversariantes"><Aniversariantes /></ModuleGuard>} />
                  <Route path="/financeiro" element={<ModuleGuard module="folha"><Financeiro /></ModuleGuard>} />
                  <Route path="/folha/custo-pessoal" element={<ModuleGuard module="folha.custo"><CustoPessoal /></ModuleGuard>} />
                  <Route path="/saude" element={<ModuleGuard module="saude"><Saude /></ModuleGuard>} />
                  <Route path="/saude/importar" element={<ModuleGuard module="saude"><SaudeImportar /></ModuleGuard>} />
                  <Route path="/ferias" element={<ModuleGuard module="ferias"><Ferias /></ModuleGuard>} />
                  <Route path="/simulador-rescisao" element={<ModuleGuard module="simulador"><SimuladorRescisao /></ModuleGuard>} />
                  <Route path="/assistente" element={<ModuleGuard module="colaboradores"><Assistente /></ModuleGuard>} />
                  <Route path="/configuracoes" element={<ModuleGuard module="configuracoes"><Configuracoes /></ModuleGuard>} />
                  <Route path="/super-admin" element={<ModuleGuard module="configuracoes.acessos"><SuperAdmin /></ModuleGuard>} />
                  <Route path="/acesso-negado" element={<AccessDenied />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
