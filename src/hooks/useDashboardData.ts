import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface DashboardData {
  headcount: number;
  custoTotalFolha: number;
  horasExtras: number;
  evolucaoFolha: { mes: string; total: number }[];
  distribuicaoCustos: { name: string; value: number }[];
  loading: boolean;
}

export function useDashboardData(): DashboardData {
  const { companyId } = useCompany();
  const [headcount, setHeadcount] = useState(0);
  const [custoTotalFolha, setCustoTotalFolha] = useState(0);
  const [horasExtras, setHorasExtras] = useState(0);
  const [evolucaoFolha, setEvolucaoFolha] = useState<{ mes: string; total: number }[]>([]);
  const [distribuicaoCustos, setDistribuicaoCustos] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  async function fetchAll() {
    setLoading(true);

    // Headcount
    let hcQuery = supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo");
    if (companyId) hcQuery = hcQuery.eq("company_id", companyId);
    const { count } = await hcQuery;
    setHeadcount(count ?? 0);

    // Current month payroll
    let prQuery = supabase
      .from("payroll_monthly_records")
      .select("total_geral, he_total, salario_gratificacao, encargos, beneficios")
      .eq("ano", currentYear)
      .eq("mes", currentMonth);
    if (companyId) prQuery = prQuery.eq("company_id", companyId);
    const { data: currentPayroll } = await prQuery;

    const totalFolha = (currentPayroll ?? []).reduce((s, r) => s + (Number(r.total_geral) || 0), 0);
    const totalHE = (currentPayroll ?? []).reduce((s, r) => s + (Number(r.he_total) || 0), 0);
    setCustoTotalFolha(totalFolha);
    setHorasExtras(totalHE);

    const salarios = (currentPayroll ?? []).reduce((s, r) => s + (Number(r.salario_gratificacao) || 0), 0);
    const enc = (currentPayroll ?? []).reduce((s, r) => s + (Number(r.encargos) || 0), 0);
    const ben = (currentPayroll ?? []).reduce((s, r) => s + (Number(r.beneficios) || 0), 0);
    setDistribuicaoCustos([
      { name: "Salários", value: salarios },
      { name: "Encargos", value: enc },
      { name: "Benefícios", value: ben },
    ]);

    // Evolution last 6 months
    const months: { ano: number; mes: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      months.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    }

    let evoQuery = supabase
      .from("payroll_monthly_records")
      .select("ano, mes, total_geral")
      .gte("ano", months[0].ano)
      .order("ano")
      .order("mes");
    if (companyId) evoQuery = evoQuery.eq("company_id", companyId);
    const { data: evoData } = await evoQuery;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const evo = months.map((m) => {
      const recs = (evoData ?? []).filter((r) => r.ano === m.ano && r.mes === m.mes);
      const total = recs.reduce((s, r) => s + (Number(r.total_geral) || 0), 0);
      return { mes: `${monthNames[m.mes - 1]}/${String(m.ano).slice(2)}`, total };
    });
    setEvolucaoFolha(evo);

    setLoading(false);
  }

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_monthly_records" }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return { headcount, custoTotalFolha, horasExtras, evolucaoFolha, distribuicaoCustos, loading };
}
