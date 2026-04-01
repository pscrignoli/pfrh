import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface HealthPlan {
  id: string;
  company_id: string | null;
  nome: string;
  tipo: string;
  fornecedor: string | null;
  numero_apolice: string | null;
  cnpj_fornecedor: string | null;
  ativo: boolean;
  created_at: string;
}

export function useHealthPlans() {
  const { companyId } = useCompany();
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("rh_health_plans" as any)
      .select("*")
      .eq("company_id", companyId)
      .eq("ativo", true)
      .order("nome");
    setPlans((data as any as HealthPlan[]) ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { plans, loading, refetch: fetch };
}
