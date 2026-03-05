import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function CompanySelector() {
  const { companyId, companies, setCompanyId, companyName, companyTheme } = useCompany();

  return (
    <Select
      value={companyId ?? ""}
      onValueChange={(v) => setCompanyId(v)}
    >
      <SelectTrigger className="w-[210px] h-8 text-xs border-primary/20 hover:border-primary/40 transition-colors">
        <div className="flex items-center gap-2 truncate">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0 animate-pulse"
            style={{
              backgroundColor: `hsl(var(--primary))`,
              boxShadow: `0 0 8px rgba(var(--company-glow), 0.5)`,
              animationDuration: '2s',
            }}
          />
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary/60" />
          <SelectValue>
            {companyName ?? "Selecione..."}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => {
          const isPF = (c.name ?? "").toLowerCase().includes("p&f");
          return (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: isPF ? 'hsl(348 100% 55%)' : 'hsl(218 100% 58%)',
                  }}
                />
                {c.name}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full theme-transition">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-14 flex items-center bg-card px-4 gap-3 shrink-0 relative"
            style={{
              borderBottom: `1px solid hsl(var(--header-accent) / 0.15)`,
            }}
          >
            {/* Subtle glow line at bottom of header */}
            <div
              className="absolute bottom-0 left-0 right-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.4) 50%, transparent 100%)`,
              }}
            />
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
