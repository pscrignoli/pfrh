import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { CompanyGate } from "@/components/CompanyGate";
import { PrivateRoute } from "@/components/PrivateRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ResetPassword from "@/pages/ResetPassword";
import Placeholder from "@/pages/Placeholder";
import Presenca from "@/pages/Presenca";
import Pessoas from "@/pages/Pessoas";
import Financeiro from "@/pages/Financeiro";
import CustoPessoal from "@/pages/CustoPessoal";
import Assistente from "@/pages/Assistente";
import Configuracoes from "@/pages/Configuracoes";
import SuperAdmin from "@/pages/SuperAdmin";
import Recrutamento from "@/pages/Recrutamento";
import Aniversariantes from "@/pages/Aniversariantes";

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
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<PrivateRoute />}>
                <Route
                  element={
                    <CompanyGate>
                      <AppLayout />
                    </CompanyGate>
                  }
                >
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/presenca" element={<Presenca />} />
                  <Route path="/colaboradores" element={<Pessoas />} />
                  <Route path="/recrutamento" element={<Recrutamento />} />
                  <Route path="/aniversariantes" element={<Aniversariantes />} />
                  
                  <Route path="/financeiro" element={<Financeiro />} />
                  <Route path="/folha/custo-pessoal" element={<CustoPessoal />} />
                  <Route path="/assistente" element={<Assistente />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route path="/super-admin" element={<SuperAdmin />} />
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
