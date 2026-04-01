import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface HealthRecord {
  id: string;
  health_plan_id: string;
  employee_id: string | null;
  competencia: string;
  nome_beneficiario: string;
  cpf_beneficiario: string | null;
  data_nascimento: string | null;
  idade: number | null;
  sexo: string | null;
  parentesco: string | null;
  titular_nome: string | null;
  titular_cpf: string | null;
  codigo_plano: string | null;
  descricao_plano: string | null;
  carteirinha: string | null;
  data_inicio: string | null;
  mensalidade: number;
  parte_empresa: number;
  parte_colaborador: number;
  coparticipacao: number;
  taxa_cartao: number;
  taxa_inscricao: number;
  lancamento_manual: number;
  outros: number;
  valor_total: number;
  tipo_cobertura: string;
  fonte: string;
}

export interface HealthInvoice {
  id: string;
  health_plan_id: string;
  competencia: string;
  total_titulares: number;
  total_dependentes: number;
  total_vidas: number;
  valor_fatura: number;
  valor_iof: number;
  valor_cobrado: number;
  total_parte_empresa: number;
  total_parte_colaborador: number;
  total_coparticipacao: number;
  fonte: string | null;
  arquivo_nome: string | null;
}

export interface HealthPlanInfo {
  id: string;
  nome: string;
  fornecedor: string | null;
}

export interface HealthSummary {
  custoTotal: number;
  parteEmpresa: number;
  parteColaborador: number;
  titulares: number;
  dependentes: number;
  vidas: number;
  custoPerCapita: number;
  deltaPct: number | null;
}

export interface MonthEvolution {
  label: string;
  competencia: string;
  unimedMedico: number;
  bradescoMedico: number;
  dental: number;
  coparticipacao: number;
  total: number;
  vidas: number;
}

export interface PlanSlice {
  name: string;
  value: number;
}

export interface EmpresaVsColab {
  plano: string;
  empresa: number;
  colaborador: number;
}

export interface DeptHealth {
  departamento: string;
  custo: number;
  vidas: number;
  perCapita: number;
}

export interface TopCost {
  nome: string;
  cargo: string | null;
  custo: number;
  vidas: number;
  plano: string;
  isDiretor: boolean;
}

export interface AgeBand {
  faixa: string;
  vidas: number;
  custoMedio: number;
}

export interface TitularVsDep {
  titulares: { count: number; custo: number; media: number };
  dependentes: { count: number; custo: number; media: number };
  ratio: number;
}

export interface HealthAlert {
  tipo: "critico" | "atencao" | "info";
  msg: string;
}

export interface TitularGroup {
  nome: string;
  vidas: number;
  custoTotal: number;
  records: HealthRecord[];
}

export function useHealthDashboard(competencia: string | null, planoFilter: string | null) {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [prevRecords, setPrevRecords] = useState<HealthRecord[]>([]);
  const [plans, setPlans] = useState<HealthPlanInfo[]>([]);
  const [invoices, setInvoices] = useState<HealthInvoice[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [competencias, setCompetencias] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    // Fetch plans
    const { data: plansData } = await supabase
      .from("rh_health_plans" as any)
      .select("id, nome, fornecedor")
      .eq("company_id", companyId)
      .eq("ativo", true);
    setPlans((plansData as any) ?? []);

    // Fetch all competencias
    const { data: compData } = await supabase
      .from("rh_health_records" as any)
      .select("competencia")
      .eq("company_id", companyId)
      .order("competencia", { ascending: false });

    const uniqueComps = [...new Set((compData as any[] ?? []).map((r: any) => r.competencia))];
    setCompetencias(uniqueComps as string[]);

    const targetComp = competencia ?? (uniqueComps[0] as string | undefined) ?? null;
    if (!targetComp) {
      setLoading(false);
      return;
    }

    // Fetch current month records
    let query = supabase
      .from("rh_health_records" as any)
      .select("*")
      .eq("company_id", companyId)
      .eq("competencia", targetComp);
    if (planoFilter) {
      query = query.eq("fonte", planoFilter);
    }
    const { data: recsData } = await query;
    setRecords((recsData as any) ?? []);

    // Fetch previous month
    const prevIdx = uniqueComps.indexOf(targetComp);
    if (prevIdx >= 0 && prevIdx < uniqueComps.length - 1) {
      let prevQuery = supabase
        .from("rh_health_records" as any)
        .select("*")
        .eq("company_id", companyId)
        .eq("competencia", uniqueComps[prevIdx + 1]);
      if (planoFilter) prevQuery = prevQuery.eq("fonte", planoFilter);
      const { data: prevData } = await prevQuery;
      setPrevRecords((prevData as any) ?? []);
    } else {
      setPrevRecords([]);
    }

    // Fetch invoices
    const { data: invData } = await supabase
      .from("rh_health_invoices" as any)
      .select("*")
      .eq("company_id", companyId);
    setInvoices((invData as any) ?? []);

    // Fetch employees for dept/cargo matching
    const { data: empData } = await supabase
      .from("rh_employees")
      .select("id, nome_completo, departamento, cargo")
      .eq("company_id", companyId);
    setEmployees(empData ?? []);

    setLoading(false);
  }, [companyId, competencia, planoFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const empMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const summary = useMemo((): HealthSummary => {
    const custoTotal = records.reduce((s, r) => s + (r.valor_total || r.mensalidade || 0), 0);
    const parteEmpresa = records.reduce((s, r) => s + (r.parte_empresa || 0), 0);
    const parteColaborador = records.reduce((s, r) => s + (r.parte_colaborador || 0), 0);
    const tits = records.filter(r => r.parentesco === "titular");
    const deps = records.filter(r => r.parentesco !== "titular");
    const vidas = records.length;

    const prevTotal = prevRecords.reduce((s, r) => s + (r.valor_total || r.mensalidade || 0), 0);
    const deltaPct = prevTotal > 0 ? ((custoTotal - prevTotal) / prevTotal) * 100 : null;

    return {
      custoTotal, parteEmpresa, parteColaborador,
      titulares: tits.length, dependentes: deps.length, vidas,
      custoPerCapita: vidas > 0 ? custoTotal / vidas : 0,
      deltaPct,
    };
  }, [records, prevRecords]);

  const evolution = useMemo((): MonthEvolution[] => {
    // Group invoices by competencia
    const compMap = new Map<string, MonthEvolution>();

    for (const inv of invoices) {
      const key = inv.competencia;
      const plan = plans.find(p => p.id === inv.health_plan_id);
      const isUnimed = plan?.fornecedor?.toLowerCase().includes("unimed");
      const isBradesco = plan?.fornecedor?.toLowerCase().includes("bradesco");

      const existing = compMap.get(key) || {
        label: "", competencia: key,
        unimedMedico: 0, bradescoMedico: 0, dental: 0, coparticipacao: 0, total: 0, vidas: 0,
      };

      if (isUnimed) {
        existing.unimedMedico += inv.valor_fatura || 0;
        existing.coparticipacao += inv.total_coparticipacao || 0;
      } else if (isBradesco) {
        existing.bradescoMedico += inv.valor_fatura || 0;
      }
      existing.total += inv.valor_cobrado || inv.valor_fatura || 0;
      existing.vidas += inv.total_vidas || 0;

      const d = new Date(key + "T00:00:00");
      existing.label = `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;

      compMap.set(key, existing);
    }

    return Array.from(compMap.values()).sort((a, b) => a.competencia.localeCompare(b.competencia)).slice(-12);
  }, [invoices, plans]);

  const planSlices = useMemo((): PlanSlice[] => {
    const map = new Map<string, number>();
    for (const r of records) {
      const key = r.descricao_plano || r.codigo_plano || r.fonte || "Outro";
      map.set(key, (map.get(key) || 0) + (r.valor_total || r.mensalidade || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  const empresaVsColab = useMemo((): EmpresaVsColab[] => {
    const map = new Map<string, { empresa: number; colaborador: number }>();
    for (const r of records) {
      const key = r.fonte === "bradesco" ? "Bradesco Saúde" : "Unimed";
      const entry = map.get(key) || { empresa: 0, colaborador: 0 };
      entry.empresa += r.parte_empresa || 0;
      entry.colaborador += r.parte_colaborador || 0;
      map.set(key, entry);
    }
    return Array.from(map.entries()).map(([plano, v]) => ({ plano, ...v }));
  }, [records]);

  const deptHealth = useMemo((): DeptHealth[] => {
    const map = new Map<string, { custo: number; vidas: number }>();
    for (const r of records) {
      const emp = r.employee_id ? empMap.get(r.employee_id) : null;
      const dept = emp?.departamento || "Não vinculado";
      const entry = map.get(dept) || { custo: 0, vidas: 0 };
      entry.custo += r.valor_total || r.mensalidade || 0;
      entry.vidas += 1;
      map.set(dept, entry);
    }
    return Array.from(map.entries())
      .map(([departamento, v]) => ({
        departamento,
        custo: v.custo,
        vidas: v.vidas,
        perCapita: v.vidas > 0 ? v.custo / v.vidas : 0,
      }))
      .sort((a, b) => b.custo - a.custo);
  }, [records, empMap]);

  const topCosts = useMemo((): TopCost[] => {
    // Group by titular
    const map = new Map<string, { custo: number; vidas: number; plano: string; emp: any }>();
    for (const r of records) {
      const titularKey = r.parentesco === "titular"
        ? r.nome_beneficiario
        : (r.titular_nome || r.nome_beneficiario);
      const entry = map.get(titularKey) || { custo: 0, vidas: 0, plano: "", emp: null };
      entry.custo += r.valor_total || r.mensalidade || 0;
      entry.vidas += 1;
      entry.plano = r.descricao_plano || r.codigo_plano || r.fonte || "";
      if (r.parentesco === "titular" && r.employee_id) {
        entry.emp = empMap.get(r.employee_id);
      }
      map.set(titularKey, entry);
    }

    const isDiretorCheck = (cargo: string | null) => {
      if (!cargo) return false;
      const l = cargo.toLowerCase();
      return l.includes("diretor") || l.includes("ceo") || l.includes("presidente");
    };

    return Array.from(map.entries())
      .map(([nome, v]) => ({
        nome,
        cargo: v.emp?.cargo || null,
        custo: v.custo,
        vidas: v.vidas,
        plano: v.plano,
        isDiretor: isDiretorCheck(v.emp?.cargo),
      }))
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 10);
  }, [records, empMap]);

  const ageBands = useMemo((): AgeBand[] => {
    const bands = [
      { faixa: "0-18", min: 0, max: 18 },
      { faixa: "19-23", min: 19, max: 23 },
      { faixa: "24-28", min: 24, max: 28 },
      { faixa: "29-33", min: 29, max: 33 },
      { faixa: "34-38", min: 34, max: 38 },
      { faixa: "39-43", min: 39, max: 43 },
      { faixa: "44-48", min: 44, max: 48 },
      { faixa: "49-53", min: 49, max: 53 },
      { faixa: "54-58", min: 54, max: 58 },
      { faixa: "59+", min: 59, max: 999 },
    ];

    return bands.map(b => {
      const matching = records.filter(r => {
        const age = r.idade ?? (r.data_nascimento
          ? Math.floor((Date.now() - new Date(r.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
          : null);
        return age !== null && age >= b.min && age <= b.max;
      });
      const custo = matching.reduce((s, r) => s + (r.valor_total || r.mensalidade || 0), 0);
      return {
        faixa: b.faixa,
        vidas: matching.length,
        custoMedio: matching.length > 0 ? custo / matching.length : 0,
      };
    }).filter(b => b.vidas > 0);
  }, [records]);

  const titularVsDep = useMemo((): TitularVsDep => {
    const tits = records.filter(r => r.parentesco === "titular");
    const deps = records.filter(r => r.parentesco !== "titular");
    const titCusto = tits.reduce((s, r) => s + (r.valor_total || r.mensalidade || 0), 0);
    const depCusto = deps.reduce((s, r) => s + (r.valor_total || r.mensalidade || 0), 0);
    return {
      titulares: { count: tits.length, custo: titCusto, media: tits.length > 0 ? titCusto / tits.length : 0 },
      dependentes: { count: deps.length, custo: depCusto, media: deps.length > 0 ? depCusto / deps.length : 0 },
      ratio: tits.length > 0 ? deps.length / tits.length : 0,
    };
  }, [records]);

  const alerts = useMemo((): HealthAlert[] => {
    const result: HealthAlert[] = [];
    if (summary.deltaPct !== null && summary.deltaPct > 10) {
      result.push({ tipo: "critico", msg: `Custo total subiu ${summary.deltaPct.toFixed(1)}% vs mês anterior` });
    }
    // Check high coparticipacao
    for (const r of records) {
      if (r.coparticipacao > 500) {
        result.push({ tipo: "atencao", msg: `${r.nome_beneficiario}: coparticipação alta R$ ${r.coparticipacao.toFixed(2)}` });
      }
    }
    // Check new dependents
    if (prevRecords.length > 0) {
      const prevNames = new Set(prevRecords.map(r => r.cpf_beneficiario || r.nome_beneficiario));
      const newDeps = records.filter(r => r.parentesco !== "titular" && !prevNames.has(r.cpf_beneficiario || r.nome_beneficiario));
      for (const d of newDeps) {
        result.push({ tipo: "info", msg: `Novo dependente: ${d.nome_beneficiario} (${d.parentesco})` });
      }
      // Check excluded
      const curNames = new Set(records.map(r => r.cpf_beneficiario || r.nome_beneficiario));
      const removed = prevRecords.filter(r => !curNames.has(r.cpf_beneficiario || r.nome_beneficiario));
      for (const d of removed) {
        result.push({ tipo: "info", msg: `Excluído: ${d.nome_beneficiario}` });
      }
    }
    return result;
  }, [records, prevRecords, summary]);

  const titularGroups = useMemo((): TitularGroup[] => {
    const map = new Map<string, HealthRecord[]>();
    // Group records by titular
    for (const r of records) {
      const key = r.parentesco === "titular"
        ? r.nome_beneficiario
        : (r.titular_nome || r.nome_beneficiario);
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .map(([nome, recs]) => ({
        nome,
        vidas: recs.length,
        custoTotal: recs.reduce((s, r) => s + (r.valor_total || r.mensalidade || 0), 0),
        records: recs,
      }))
      .sort((a, b) => b.custoTotal - a.custoTotal);
  }, [records]);

  return {
    loading, records, plans, competencias,
    summary, evolution, planSlices, empresaVsColab,
    deptHealth, topCosts, ageBands, titularVsDep,
    alerts, titularGroups,
    currentCompetencia: competencia ?? competencias[0] ?? null,
  };
}
