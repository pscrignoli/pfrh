import { useState } from "react";
import {
  LayoutDashboard, Clock, Users, UserSearch, Bot, Settings, LogOut,
  Shield, Cake, FileSpreadsheet, ChevronDown, FileText, BarChart3,
  Palmtree, Calculator, HeartPulse, Upload, Briefcase, ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

const mainItems = [
  { title: "Dashboards", url: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "Presença e Jornada", url: "/presenca", icon: Clock, module: "colaboradores" },
  { title: "Colaboradores", url: "/colaboradores", icon: Users, module: "colaboradores" },
  { title: "Aniversariantes", url: "/aniversariantes", icon: Cake, module: "aniversariantes" },
];

const recrutamentoSubItems = [
  { title: "Vagas", url: "/recrutamento", icon: Briefcase, module: "recrutamento" },
  { title: "Dashboard Vagas", url: "/recrutamento/dashboard-vagas", icon: BarChart3, module: "recrutamento" },
  { title: "Dashboard Requisições", url: "/recrutamento/dashboard-requisicoes", icon: ClipboardList, module: "recrutamento" },
];

const saudeSubItems = [
  { title: "Dashboard", url: "/saude", icon: BarChart3, module: "saude" },
  { title: "Importar Fatura", url: "/saude/importar", icon: Upload, module: "saude" },
];

const folhaSubItems = [
  { title: "Fechamentos Mensais", url: "/financeiro", icon: FileText, module: "folha" },
  { title: "Custo de Pessoal", url: "/folha/custo-pessoal", icon: BarChart3, module: "folha.custo" },
  { title: "Simulador Rescisão", url: "/simulador-rescisao", icon: Calculator, module: "simulador" },
];

const bottomItems = [
  { title: "Férias", url: "/ferias", icon: Palmtree, module: "ferias" },
  { title: "Assistente de RH (IA)", url: "/assistente", icon: Bot, module: "colaboradores" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const { canView, isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const visibleMainItems = mainItems.filter((item) => canView(item.module));
  const visibleRecrutamentoItems = recrutamentoSubItems.filter((item) => canView(item.module));
  const visibleSaudeItems = saudeSubItems.filter((item) => canView(item.module));
  const visibleFolhaItems = folhaSubItems.filter((item) => canView(item.module));
  const visibleBottomItems = bottomItems.filter((item) => canView(item.module));
  const showRecrutamento = visibleRecrutamentoItems.length > 0;
  const showSaude = visibleSaudeItems.length > 0;
  const showFolha = visibleFolhaItems.length > 0;
  const showConfig = canView("configuracoes");

  const recrutamentoActive = location.pathname.startsWith("/recrutamento");
  const [recrutamentoOpen, setRecrutamentoOpen] = useState(recrutamentoActive);

  const saudeActive = location.pathname.startsWith("/saude");
  const [saudeOpen, setSaudeOpen] = useState(saudeActive);

  const folhaActive =
    location.pathname === "/financeiro" ||
    location.pathname.startsWith("/folha") ||
    location.pathname === "/simulador-rescisao";
  const [folhaOpen, setFolhaOpen] = useState(folhaActive);

  const renderCollapsible = (
    label: string, icon: React.ElementType, isOpen: boolean, setOpen: (v: boolean) => void,
    active: boolean, items: typeof folhaSubItems
  ) => {
    const Icon = icon;
    return (
      <SidebarMenuItem>
        <Collapsible open={isOpen} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={label} isActive={active} className="justify-between">
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
              {items.map((sub) => (
                <SidebarMenuItem key={sub.url}>
                  <SidebarMenuButton asChild isActive={location.pathname === sub.url} tooltip={sub.title} className="h-8 text-xs">
                    <NavLink to={sub.url}>
                      <sub.icon className="h-3.5 w-3.5" />
                      <span>{sub.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            RH
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-sidebar-foreground truncate">People Analytics</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {showRecrutamento && renderCollapsible("Recrutamento", UserSearch, recrutamentoOpen, setRecrutamentoOpen, recrutamentoActive, visibleRecrutamentoItems)}
              {showFolha && renderCollapsible("Fechamento da Folha", FileSpreadsheet, folhaOpen, setFolhaOpen, folhaActive, visibleFolhaItems)}
              {showSaude && renderCollapsible("Saúde", HeartPulse, saudeOpen, setSaudeOpen, saudeActive, visibleSaudeItems)}

              {visibleBottomItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/super-admin")} tooltip="Super Admin">
                <NavLink to="/super-admin"><Shield className="h-4 w-4" /><span>Super Admin</span></NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {showConfig && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/configuracoes")} tooltip="Configurações">
                <NavLink to="/configuracoes"><Settings className="h-4 w-4" /><span>Configurações</span></NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" onClick={handleSignOut} className="text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" /><span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
