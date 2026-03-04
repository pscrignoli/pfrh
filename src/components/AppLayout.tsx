import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function CompanySelector() {
  const { companyId, companies, setCompanyId, isAllCompanies, companyName } = useCompany();

  return (
    <Select
      value={companyId ?? "__all__"}
      onValueChange={(v) => setCompanyId(v === "__all__" ? null : v)}
    >
      <SelectTrigger className="w-[200px] h-8 text-xs border-dashed">
        <div className="flex items-center gap-1.5 truncate">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SelectValue>
            {isAllCompanies ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                Todas as empresas
              </Badge>
            ) : (
              <Badge className="text-[10px] px-1.5 py-0 font-normal bg-primary/90">
                {companyName}
              </Badge>
            )}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">
          <span className="text-muted-foreground">Todas as empresas</span>
        </SelectItem>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3 shrink-0">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">
              Gestão de RH
            </span>
            <div className="ml-auto">
              <CompanySelector />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
