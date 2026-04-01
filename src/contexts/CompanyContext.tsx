import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  razao_social: string | null;
  status: string;
  created_at: string;
}

type CompanyTheme = "pf" | "biocollagen";

interface CompanyContextValue {
  companyId: string | null;
  companyName: string | null;
  companies: Company[];
  setCompanyId: (id: string) => void;
  loading: boolean;
  companyTheme: CompanyTheme;
}

const STORAGE_KEY = "selected_company_id";

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

function resolveTheme(name: string | null): CompanyTheme {
  if (!name) return "pf";
  const lower = name.toLowerCase();
  if (lower.includes("biocollagen") || lower.includes("bio")) return "biocollagen";
  return "pf";
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored !== "null" ? stored : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("rh_companies")
      .select("*")
      .eq("status", "active");
    // P&F always first
    (data ?? []).sort((a: any, b: any) => {
      const aName = (a.name ?? "").toLowerCase();
      const bName = (b.name ?? "").toLowerCase();
      if (aName.includes("p&f")) return -1;
      if (bName.includes("p&f")) return 1;
      return aName.localeCompare(bName);
    });
    const list = (data as Company[]) ?? [];
    setCompanies(list);

    // If stored companyId is not valid, reset
    if (companyId && !list.find((c) => c.id === companyId)) {
      setCompanyIdState(null);
      localStorage.removeItem(STORAGE_KEY);
    }

    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const companyName = companyId
    ? companies.find((c) => c.id === companyId)?.name ?? null
    : null;

  const companyTheme = resolveTheme(companyName);

  // Apply data-company attribute to html element for CSS theme switching
  useEffect(() => {
    document.documentElement.setAttribute("data-company", companyTheme);
  }, [companyTheme]);

  return (
    <CompanyContext.Provider
      value={{
        companyId,
        companyName,
        companies,
        setCompanyId,
        loading,
        companyTheme,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
