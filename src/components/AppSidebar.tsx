import {
  LayoutDashboard,
  Clock,
  Users,
  UserSearch,
  DollarSign,
  Bot,
  Settings,
  LogOut,
  Shield,
  Cake,
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

const mainItems = [
  { title: "Dashboards", url: "/", icon: LayoutDashboard },
  { title: "Presença e Jornada", url: "/presenca", icon: Clock },
  { title: "Colaboradores", url: "/colaboradores", icon: Users },
  { title: "Aniversariantes", url: "/aniversariantes", icon: Cake },
  { title: "Recrutamento", url: "/recrutamento", icon: UserSearch },
  { title: "Fechamento da Folha", url: "/financeiro", icon: DollarSign },
  { title: "Assistente de RH (IA)", url: "/assistente", icon: Bot },
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
