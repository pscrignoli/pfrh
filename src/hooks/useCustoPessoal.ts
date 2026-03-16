import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface MonthCostData {
  ano: number;
  mes: number;
  headcount: number;
  salarios: number;
  encargos: number;
  beneficios: number;
  fgts: number;
  inss_empresa: number;
  provisao_ferias: number;
  provisao_13: number;
  horas_extras: number;
  plano_saude: number;
  total: number;
  salario_liquido: number;
}

export interface DeptCost {
  departamento: string;
  total: number;
  headcount: number;
  perCapita: number;
}

export interface TopEmployee {
  nome: string;
  cargo: string;
  departamento: string;
  total: number;
}

export interface CostBreakdownRow {
  label: string;
  value: number;
  pct: number;
  perCapita: number;
  deltaVsAnterior: number | null;
}

export function useCustoPessoal(ano: number, departamento?: string | null) {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [monthsData, setMonthsData] = useState<MonthCostData[]>([]);
  const [deptCosts, setDeptCosts] = useState<DeptCost[]>([]);
  const [topEmployees, setTopEmployees] = useState<TopEmployee[]>([]);
  const [rawRecords, setRawRecords] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("payroll_monthly_records")
        .select("*, employees!inner(nome_completo, departamento, cargo)")
        .eq("ano", ano)
        .order("mes");

      if (companyId) query = query.eq("company_id", companyId);

      const { data } = await query;
      const records = data ?? [];
      setRawRecords(records);

      // Group by month
      const byMonth = new Map<number, any[]>();
      for (const r of records) {
        const list = byMonth.get(r.mes) || [];
        list.push(r);
        byMonth.set(r.mes, list);
      }

      const months: MonthCostData[] = [];
      for (const [mes, recs] of byMonth.entries()) {
        const filtered = departamento
          ? recs.filter((r: any) => r.employees?.departamento === departamento)
          : recs;
        if (filtered.length === 0) continue;

        const sum = (fn: (r: any) => number) => filtered.reduce((a: number, r: any) => a + fn(r), 0);

        const salarios = sum(r => (r.salario ?? 0) + (r.he_total ?? 0) + (r.dsr_horas ?? 0) + (r.adicional_noturno ?? 0) + (r.insalubridade ?? 0) + (r.diferenca_salario ?? 0) + (r.bonus_gratificacao ?? 0) + (r.salario_gratificacao ?? 0));
        const fgts = sum(r => (r.fgts_8 ?? 0) + (r.fgts_13 ?? 0) + (r.fgts_ferias ?? 0));
        // IMPORTANT: inss_20/inss_ferias/inss_13 store BASES not actual values.
        // Calculate actual INSS patronal contribution from bases * rate (~28.8%)
        const INSS_RATE = 0.288;
        const inss_empresa = sum(r => ((r.inss_20 ?? 0) + (r.inss_13 ?? 0) + (r.inss_ferias ?? 0)) * INSS_RATE);
        const plano_saude = sum(r => (r.convenio_medico ?? 0) + (r.plano_odontologico ?? 0) + (r.plano_odontologico_empresa ?? 0));
        const beneficios = sum(r => (r.beneficios ?? 0)) || (plano_saude + sum(r => (r.vale_transporte ?? 0) + (r.vr_alimentacao ?? 0) + (r.auxilio_alimentacao ?? 0) + (r.ajuda_de_custo ?? 0) + (r.vr_auto ?? 0)));
        const provisao_ferias = sum(r => (r.ferias ?? 0) + (r.terco_ferias ?? 0) + (r.avos_ferias ?? 0));
        const provisao_13 = sum(r => (r.decimo_terceiro ?? 0) + (r.ferias_13 ?? 0));
        const horas_extras = sum(r => (r.he_total ?? 0));
        const encargos = fgts + inss_empresa;
        const total = salarios + encargos + beneficios;
        const salario_liquido = sum(r => (r.total_geral ?? 0));

        months.push({
          ano, mes,
          headcount: filtered.length,
          salarios, encargos, beneficios, fgts, inss_empresa,
          provisao_ferias, provisao_13, horas_extras, plano_saude, total,
          salario_liquido,
        });
      }

      months.sort((a, b) => a.mes - b.mes);
      setMonthsData(months);

      // Dept costs for latest month
      const latestMes = months.length > 0 ? months[months.length - 1].mes : 0;
      const latestRecs = records.filter((r: any) => r.mes === latestMes);
      const deptMap = new Map<string, { total: number; count: number }>();
      for (const r of latestRecs) {
        const dept = (r as any).employees?.departamento ?? "Não informado";
        const entry = deptMap.get(dept) || { total: 0, count: 0 };
        entry.total += r.total_geral ?? 0;
        entry.count += 1;
        deptMap.set(dept, entry);
      }
      const depts: DeptCost[] = Array.from(deptMap.entries())
        .map(([departamento, { total, count }]) => ({
          departamento,
          total,
          headcount: count,
          perCapita: count > 0 ? total / count : 0,
        }))
        .sort((a, b) => b.total - a.total);
      setDeptCosts(depts);

      // Top 10
      const empMap = new Map<string, { nome: string; cargo: string; departamento: string; total: number }>();
      for (const r of latestRecs) {
        const emp = (r as any).employees;
        const id = r.employee_id;
        const entry = empMap.get(id) || {
          nome: emp?.nome_completo ?? "—",
          cargo: emp?.cargo ?? "—",
          departamento: emp?.departamento ?? "—",
          total: 0,
        };
        entry.total += r.total_geral ?? 0;
        empMap.set(id, entry);
      }
      const top = Array.from(empMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);
      setTopEmployees(top);
    } finally {
      setLoading(false);
    }
  }, [ano, companyId, departamento]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentMonth = useMemo(() => {
    if (monthsData.length === 0) return null;
    return monthsData[monthsData.length - 1];
  }, [monthsData]);

  const previousMonth = useMemo(() => {
    if (monthsData.length < 2) return null;
    return monthsData[monthsData.length - 2];
  }, [monthsData]);

  const costBreakdown = useMemo((): CostBreakdownRow[] => {
    if (!currentMonth) return [];
    const cur = currentMonth;
    const prev = previousMonth;
    const total = cur.total || 1;
    const hc = cur.headcount || 1;

    const rows: { label: string; value: number; prevValue?: number }[] = [
      { label: "Salários Base", value: cur.salarios - cur.horas_extras, prevValue: prev ? prev.salarios - prev.horas_extras : undefined },
      { label: "Horas Extras", value: cur.horas_extras, prevValue: prev?.horas_extras },
      { label: "INSS Empresa", value: cur.inss_empresa, prevValue: prev?.inss_empresa },
      { label: "FGTS", value: cur.fgts, prevValue: prev?.fgts },
      { label: "Plano de Saúde", value: cur.plano_saude, prevValue: prev?.plano_saude },
      { label: "Provisão Férias", value: cur.provisao_ferias, prevValue: prev?.provisao_ferias },
      { label: "Provisão 13º", value: cur.provisao_13, prevValue: prev?.provisao_13 },
      { label: "Benefícios (outros)", value: cur.beneficios - cur.plano_saude, prevValue: prev ? prev.beneficios - prev.plano_saude : undefined },
    ];

    return rows.map(r => ({
      label: r.label,
      value: r.value,
      pct: (r.value / total) * 100,
      perCapita: r.value / hc,
      deltaVsAnterior: r.prevValue != null && r.prevValue > 0
        ? ((r.value - r.prevValue) / r.prevValue) * 100
        : null,
    }));
  }, [currentMonth, previousMonth]);

  const alerts = useMemo(() => {
    if (!currentMonth) return [];
    const result: string[] = [];
    const cur = currentMonth;
    const prev = previousMonth;

    if (cur.salarios > 0 && (cur.horas_extras / cur.salarios) > 0.10) {
      result.push(`Horas extras representam ${((cur.horas_extras / cur.salarios) * 100).toFixed(1)}% da folha bruta`);
    }
    if (prev && prev.total > 0) {
      const perCapitaCur = cur.total / (cur.headcount || 1);
      const perCapitaPrev = prev.total / (prev.headcount || 1);
      const delta = ((perCapitaCur - perCapitaPrev) / perCapitaPrev) * 100;
      if (delta > 10) {
        result.push(`Custo per capita subiu ${delta.toFixed(1)}% vs mês anterior`);
      }
    }
    return result;
  }, [currentMonth, previousMonth]);

  // Available departments from raw records
  const departamentos = useMemo(() => {
    const set = new Set<string>();
    for (const r of rawRecords) {
      const dept = (r as any).employees?.departamento;
      if (dept) set.add(dept);
    }
    return Array.from(set).sort();
  }, [rawRecords]);

  return {
    loading, monthsData, currentMonth, previousMonth,
    deptCosts, topEmployees, costBreakdown, alerts, departamentos,
    refetch: fetchData,
  };
}
