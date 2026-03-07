import { useState } from "react";
import {
  LayoutDashboard,
  Clock,
  Users,
  UserSearch,
  Bot,
  Settings,
  LogOut,
  Shield,
  Cake,
  FileSpreadsheet,
  ChevronDown,
  FileText,
  BarChart3,
  Palmtree,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const mainItems = [
  { title: "Dashboards", url: "/", icon: LayoutDashboard },
  { title: "Presença e Jornada", url: "/presenca", icon: Clock },
  { title: "Colaboradores", url: "/colaboradores", icon: Users },
  { title: "Aniversariantes", url: "/aniversariantes", icon: Cake },
  { title: "Recrutamento", url: "/recrutamento", icon: UserSearch },
  { title: "Férias", url: "/ferias", icon: Palmtree },
  { title: "Assistente de RH (IA)", url: "/assistente", icon: Bot },
];

const folhaSubItems = [
  { title: "Fechamentos Mensais", url: "/financeiro", icon: FileText },
  { title: "Custo de Pessoal", url: "/folha/custo-pessoal", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, roles } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = roles.includes("super_admin");

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const folhaActive = location.pathname === "/financeiro" || location.pathname.startsWith("/folha");
  const [folhaOpen, setFolhaOpen] = useState(folhaActive);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            RH
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-sidebar-foreground truncate">
              People Analytics
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Fechamento da Folha — collapsible */}
              <SidebarMenuItem>
                <Collapsible open={folhaOpen} onOpenChange={setFolhaOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Fechamento da Folha"
                      isActive={folhaActive}
                      className="justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Fechamento da Folha</span>
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${folhaOpen ? "rotate-180" : ""}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
                      {folhaSubItems.map((sub) => (
                        <SidebarMenuItem key={sub.url}>
                          <SidebarMenuButton
                            asChild
                            isActive={location.pathname === sub.url}
                            tooltip={sub.title}
                            className="h-8 text-xs"
                          >
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive("/super-admin")}
                tooltip="Super Admin"
              >
                <NavLink to="/super-admin">
                  <Shield className="h-4 w-4" />
                  <span>Super Admin</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/configuracoes")}
              tooltip="Configurações"
            >
              <NavLink to="/configuracoes">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              onClick={handleSignOut}
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
