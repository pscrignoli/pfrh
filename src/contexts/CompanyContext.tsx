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

interface CompanyContextValue {
  companyId: string | null;
  companyName: string | null;
  companies: Company[];
  setCompanyId: (id: string | null) => void;
  isAllCompanies: boolean;
  loading: boolean;
}

const STORAGE_KEY = "selected_company_id";

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored !== "null" ? stored : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("status", "active")
      .order("name");
    setCompanies((data as Company[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const setCompanyId = useCallback((id: string | null) => {
    setCompanyIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const companyName = companyId
    ? companies.find((c) => c.id === companyId)?.name ?? null
    : null;

  return (
    <CompanyContext.Provider
      value={{
        companyId,
        companyName,
        companies,
        setCompanyId,
        isAllCompanies: companyId === null,
        loading,
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
