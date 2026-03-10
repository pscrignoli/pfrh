import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function parseDateParts(ds: string) {
  const [y, m, d] = ds.split("T")[0].split("-").map(Number);
  return { year: y, month: m, day: d };
}

export interface DashboardGeralData {
  loading: boolean;
  competencia: { mes: number; ano: number };
  competencias: { mes: number; ano: number }[];
  departamentos: string[];

  headcount: number;
  headcountDelta: number;
  folhaBruta: number;
  folhaDelta: number;
  encargos: number;
  encargosPercentFolha: number;
  saudeTotal: number;
  saudeVidas: number;
  custoTotal: number;
  custoPerCapita: number;

  // Linha 2
  custoFolha: number;
  sparkline: number[];
  custoFerias: number;
  feriasCount: number;
  custoAfastamento: number;
  afastadosCount: number;
  custoRescisao: number;
  rescisoesList: string[];
  custoHE: number;
  hePercentFolha: number;
  heTopDept: string;

  // Linha 3 - Turnover
  admitidos: number;
  demitidos: number;
  taxaTurnover: number;
  turnoverHistory: { label: string; admitidos: number; demitidos: number; taxa: number }[];
  turnoverByDept: { dept: string; admitidos: number; demitidos: number; taxa: number }[];

  // Linha 3 - Absenteísmo
  taxaAbsenteismo: number;
  absenteismoByDept: { dept: string; taxa: number }[];

  // Linha 4 - Férias
  emFeriasAgora: number;
  feriasVencidas: number;
  feriasAVencer90: number;
  feriasProgramadas: number;

  // Linha 4 - Aniversariantes (reused from birthday hook)
  aniversariantesHoje: { nome: string; dept: string }[];
  aniversariantesMes: number;
  proximosAniversariantes: { nome: string; dia: number; mes: number }[];

  // Linha 5 - Perfil
  genero: { feminino: number; masculino: number; naoInformado: number };
  generoPorDept: { dept: string; fem: number; masc: number }[];
  faixaEtaria: { faixa: string; count: number }[];
  idadeMedia: number;
  idadeMaisJovem: number;
  idadeMaisExperiente: number;

  // Linha 6
  formacao: { grau: string; count: number }[];
  cursando: number;
  vagasAbertas: number;
  vagasEncerradas: number;
  contratados: number;
  tempoMedioPreenchimento: number;
  vagasMetaUltrapassada: number;
}

export function useDashboardGeralRH(
  selectedCompetencia?: { mes: number; ano: number } | null,
  selectedDepartamento?: string | null
): DashboardGeralData {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Omit<DashboardGeralData, "loading" | "competencia" | "competencias" | "departamentos">>({
    headcount: 0, headcountDelta: 0, folhaBruta: 0, folhaDelta: 0,
    encargos: 0, encargosPercentFolha: 0, saudeTotal: 0, saudeVidas: 0,
    custoTotal: 0, custoPerCapita: 0,
    custoFolha: 0, sparkline: [], custoFerias: 0, feriasCount: 0,
    custoAfastamento: 0, afastadosCount: 0, custoRescisao: 0, rescisoesList: [],
    custoHE: 0, hePercentFolha: 0, heTopDept: "",
    admitidos: 0, demitidos: 0, taxaTurnover: 0, turnoverHistory: [], turnoverByDept: [],
    taxaAbsenteismo: 0, absenteismoByDept: [],
    emFeriasAgora: 0, feriasVencidas: 0, feriasAVencer90: 0, feriasProgramadas: 0,
    aniversariantesHoje: [], aniversariantesMes: 0, proximosAniversariantes: [],
    genero: { feminino: 0, masculino: 0, naoInformado: 0 },
    generoPorDept: [], faixaEtaria: [], idadeMedia: 0, idadeMaisJovem: 0, idadeMaisExperiente: 0,
    formacao: [], cursando: 0,
    vagasAbertas: 0, vagasEncerradas: 0, contratados: 0, tempoMedioPreenchimento: 0, vagasMetaUltrapassada: 0,
  });
  const [competencias, setCompetencias] = useState<{ mes: number; ano: number }[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [detectedComp, setDetectedComp] = useState<{ mes: number; ano: number }>({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear() });

  const comp = selectedCompetencia || detectedComp;
  const dept = selectedDepartamento;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const mes = comp.mes;
    const ano = comp.ano;

    // Helper: previous month
    const prevDate = new Date(ano, mes - 2, 1);
    const prevMes = prevDate.getMonth() + 1;
    const prevAno = prevDate.getFullYear();

    // Fetch employees
    let empQ = supabase.from("employees").select("id, nome_completo, status, data_admissao, data_demissao, data_nascimento, departamento, cargo, genero, grau_escolaridade, cursando, company_id, salario_base");
    if (companyId) empQ = empQ.eq("company_id", companyId);
    const { data: allEmployees } = await empQ;
    const emps = (allEmployees ?? []).filter(e => !dept || e.departamento === dept);

    // Detect available competencias from payroll
    let compQ = supabase.from("payroll_monthly_records").select("mes, ano").order("ano", { ascending: false }).order("mes", { ascending: false });
    if (companyId) compQ = compQ.eq("company_id", companyId);
    const { data: compData } = await compQ;
    const uniqueComps: { mes: number; ano: number }[] = [];
    const compSet = new Set<string>();
    for (const r of (compData ?? [])) {
      const k = `${r.ano}-${r.mes}`;
      if (!compSet.has(k)) { compSet.add(k); uniqueComps.push({ mes: r.mes, ano: r.ano }); }
    }
    setCompetencias(uniqueComps);
    if (!selectedCompetencia && uniqueComps.length > 0) {
      setDetectedComp(uniqueComps[0]);
    }

    // Departments
    const deptSet = new Set<string>();
    (allEmployees ?? []).forEach(e => { if (e.departamento) deptSet.add(e.departamento); });
    setDepartamentos([...deptSet].sort());

    // Active employees
    const activeEmps = emps.filter(e => e.status === "ativo");
    const headcount = activeEmps.length;

    // Previous month headcount (approx: active + those demitted this month)
    const demittedThisMonth = emps.filter(e => {
      if (!e.data_demissao) return false;
      const dd = parseDateParts(e.data_demissao);
      return dd.month === mes && dd.year === ano;
    });
    const admittedThisMonth = emps.filter(e => {
      const da = parseDateParts(e.data_admissao);
      return da.month === mes && da.year === ano;
    });
    const prevHeadcount = headcount - admittedThisMonth.length + demittedThisMonth.length;
    const headcountDelta = headcount - prevHeadcount;

    // Payroll current month
    let prQ = supabase.from("payroll_monthly_records").select("*").eq("ano", ano).eq("mes", mes);
    if (companyId) prQ = prQ.eq("company_id", companyId);
    const { data: payroll } = await prQ;
    const pr = (payroll ?? []).filter(r => !dept || r.area === dept || r.centro_custo === dept);

    // Previous month payroll
    let prPrevQ = supabase.from("payroll_monthly_records").select("total_folha, total_geral").eq("ano", prevAno).eq("mes", prevMes);
    if (companyId) prPrevQ = prPrevQ.eq("company_id", companyId);
    const { data: prevPayroll } = await prPrevQ;

    const folhaBruta = pr.reduce((s, r) => s + (Number(r.total_folha) || Number(r.soma) || 0), 0);
    const prevFolha = (prevPayroll ?? []).reduce((s, r) => s + (Number(r.total_folha) || 0), 0);
    const folhaDelta = prevFolha > 0 ? ((folhaBruta - prevFolha) / prevFolha) * 100 : 0;

    const encargos = pr.reduce((s, r) => s + (Number(r.encargos) || (Number(r.inss_20) || 0) + (Number(r.fgts_8) || 0) + (Number(r.fgts_ferias) || 0) + (Number(r.fgts_13) || 0) + (Number(r.inss_ferias) || 0) + (Number(r.inss_13) || 0)), 0);
    const encargosPercentFolha = folhaBruta > 0 ? (encargos / folhaBruta) * 100 : 0;

    // Health
    let hlQ = supabase.from("health_invoices").select("valor_fatura, valor_cobrado, total_vidas").eq("competencia", `${ano}-${String(mes).padStart(2, "0")}-01`);
    if (companyId) hlQ = hlQ.eq("company_id", companyId);
    const { data: healthInv } = await hlQ;
    const saudeTotal = (healthInv ?? []).reduce((s, r) => s + (Number(r.valor_cobrado) || Number(r.valor_fatura) || 0), 0);
    const saudeVidas = (healthInv ?? []).reduce((s, r) => s + (Number(r.total_vidas) || 0), 0);

    const custoTotal = folhaBruta + encargos + saudeTotal;
    const custoPerCapita = headcount > 0 ? custoTotal / headcount : 0;

    // Sparkline (last 6 months)
    const sparkline: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const sd = new Date(ano, mes - 1 - i, 1);
      const sm = sd.getMonth() + 1;
      const sy = sd.getFullYear();
      let spQ = supabase.from("payroll_monthly_records").select("total_folha, soma").eq("ano", sy).eq("mes", sm);
      if (companyId) spQ = spQ.eq("company_id", companyId);
      const { data: spData } = await spQ;
      sparkline.push((spData ?? []).reduce((s, r) => s + (Number(r.total_folha) || Number(r.soma) || 0), 0));
    }

    // Férias cost from payroll
    const custoFerias = pr.reduce((s, r) => s + (Number(r.ferias) || 0) + (Number(r.terco_ferias) || 0), 0);
    const feriasCount = pr.filter(r => (Number(r.ferias) || 0) > 0).length;

    // Afastamento
    const custoAfastamento = pr.reduce((s, r) => s + (Number(r.salario_familia) || 0), 0); // simplified
    const afastadosCount = pr.filter(r => r.relacao_funcionarios && /licen|afasta|auxil/i.test(r.relacao_funcionarios)).length;

    // Rescisão
    const rescisaoRecords = pr.filter(r => {
      if (r.desligamento) return true;
      const emp = emps.find(e => e.id === r.employee_id);
      return emp?.data_demissao && parseDateParts(emp.data_demissao).month === mes && parseDateParts(emp.data_demissao).year === ano;
    });
    const custoRescisao = rescisaoRecords.reduce((s, r) => s + (Number(r.total_geral) || 0), 0);
    const rescisoesList = rescisaoRecords.map(r => {
      const emp = emps.find(e => e.id === r.employee_id);
      return emp?.nome_completo?.split(" ")[0] || r.contrato_empregado || "?";
    }).filter((v, i, a) => a.indexOf(v) === i);

    // Horas extras
    const custoHE = pr.reduce((s, r) => s + (Number(r.he_total) || 0) + (Number(r.hora_50) || 0) + (Number(r.hora_60) || 0) + (Number(r.hora_80) || 0) + (Number(r.hora_100) || 0) + (Number(r.dsr_horas) || 0), 0);
    const hePercentFolha = folhaBruta > 0 ? (custoHE / folhaBruta) * 100 : 0;
    // Top dept for HE
    const heDeptMap = new Map<string, number>();
    pr.forEach(r => {
      const d = r.area || r.centro_custo || "Outros";
      const he = (Number(r.he_total) || 0) + (Number(r.hora_50) || 0) + (Number(r.hora_60) || 0) + (Number(r.hora_80) || 0) + (Number(r.hora_100) || 0);
      heDeptMap.set(d, (heDeptMap.get(d) || 0) + he);
    });
    const heTopDept = [...heDeptMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    // Turnover
    const admitidos = admittedThisMonth.length;
    const demitidos = demittedThisMonth.length;
    const avgHeadcount = (prevHeadcount + headcount) / 2;
    const taxaTurnover = avgHeadcount > 0 ? (demitidos / avgHeadcount) * 100 : 0;

    // Turnover history (12 months)
    const turnoverHistory: DashboardGeralData["turnoverHistory"] = [];
    for (let i = 11; i >= 0; i--) {
      const td = new Date(ano, mes - 1 - i, 1);
      const tm = td.getMonth() + 1;
      const ty = td.getFullYear();
      const adm = emps.filter(e => { const p = parseDateParts(e.data_admissao); return p.month === tm && p.year === ty; }).length;
      const dem = emps.filter(e => { if (!e.data_demissao) return false; const p = parseDateParts(e.data_demissao); return p.month === tm && p.year === ty; }).length;
      turnoverHistory.push({ label: `${MONTH_LABELS[tm - 1]}/${String(ty).slice(2)}`, admitidos: adm, demitidos: dem, taxa: headcount > 0 ? (dem / headcount) * 100 : 0 });
    }

    // Turnover by dept
    const deptTurnover = new Map<string, { adm: number; dem: number; total: number }>();
    emps.forEach(e => {
      const d = e.departamento || "Outros";
      if (!deptTurnover.has(d)) deptTurnover.set(d, { adm: 0, dem: 0, total: 0 });
      const entry = deptTurnover.get(d)!;
      if (e.status === "ativo") entry.total++;
      const da = parseDateParts(e.data_admissao);
      if (da.month === mes && da.year === ano) entry.adm++;
      if (e.data_demissao) {
        const dd = parseDateParts(e.data_demissao);
        if (dd.month === mes && dd.year === ano) entry.dem++;
      }
    });
    const turnoverByDept = [...deptTurnover.entries()]
      .map(([dept, v]) => ({ dept, admitidos: v.adm, demitidos: v.dem, taxa: v.total > 0 ? (v.dem / v.total) * 100 : 0 }))
      .filter(d => d.admitidos > 0 || d.demitidos > 0)
      .sort((a, b) => b.demitidos - a.demitidos)
      .slice(0, 5);

    // Absenteísmo (simplified: count employees with falta > 0)
    const faltaRecords = pr.filter(r => (Number(r.falta) || 0) > 0);
    const taxaAbsenteismo = pr.length > 0 ? (faltaRecords.length / pr.length) * 100 : 0;
    const absDeptMap = new Map<string, { total: number; faltas: number }>();
    pr.forEach(r => {
      const d = r.area || r.centro_custo || "Outros";
      if (!absDeptMap.has(d)) absDeptMap.set(d, { total: 0, faltas: 0 });
      const entry = absDeptMap.get(d)!;
      entry.total++;
      if ((Number(r.falta) || 0) > 0) entry.faltas++;
    });
    const absenteismoByDept = [...absDeptMap.entries()]
      .map(([dept, v]) => ({ dept, taxa: v.total > 0 ? (v.faltas / v.total) * 100 : 0 }))
      .filter(d => d.taxa > 0)
      .sort((a, b) => b.taxa - a.taxa)
      .slice(0, 5);

    // Férias
    let ferQ = supabase.from("ferias").select("*").eq("status", "programada");
    if (companyId) ferQ = ferQ.eq("company_id", companyId);
    const { data: feriasData } = await ferQ;

    const emFeriasAgora = (feriasData ?? []).filter(f => {
      if (!f.data_inicio || !f.data_fim) return false;
      const ini = new Date(f.data_inicio + "T12:00:00");
      const fim = new Date(f.data_fim + "T12:00:00");
      return today >= ini && today <= fim;
    }).length;

    // Férias vencidas: employees with > 23 months since admission without ferias
    let allFerQ = supabase.from("ferias").select("employee_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim");
    if (companyId) allFerQ = allFerQ.eq("company_id", companyId);
    const { data: allFerias } = await allFerQ;
    const ferEmployeeIds = new Set((allFerias ?? []).map(f => f.employee_id));

    const feriasVencidas = activeEmps.filter(e => {
      const da = parseDateParts(e.data_admissao);
      const admDate = new Date(da.year, da.month - 1, da.day);
      const monthsDiff = (today.getFullYear() - admDate.getFullYear()) * 12 + (today.getMonth() - admDate.getMonth());
      return monthsDiff >= 23 && !ferEmployeeIds.has(e.id);
    }).length;

    const feriasAVencer90 = activeEmps.filter(e => {
      const da = parseDateParts(e.data_admissao);
      const admDate = new Date(da.year, da.month - 1, da.day);
      const monthsDiff = (today.getFullYear() - admDate.getFullYear()) * 12 + (today.getMonth() - admDate.getMonth());
      return monthsDiff >= 20 && monthsDiff < 23 && !ferEmployeeIds.has(e.id);
    }).length;

    const feriasProgramadas = (feriasData ?? []).filter(f => {
      if (!f.data_inicio) return false;
      return new Date(f.data_inicio + "T12:00:00") > today;
    }).length;

    // Aniversariantes
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;
    const aniversariantesHoje = activeEmps
      .filter(e => {
        if (!e.data_nascimento) return false;
        const p = parseDateParts(e.data_nascimento);
        return p.day === todayDay && p.month === todayMonth;
      })
      .map(e => ({ nome: e.nome_completo, dept: e.departamento || "" }));

    const aniversariantesMes = activeEmps.filter(e => {
      if (!e.data_nascimento) return false;
      return parseDateParts(e.data_nascimento).month === todayMonth;
    }).length;

    const proximosAniversariantes = activeEmps
      .filter(e => {
        if (!e.data_nascimento) return false;
        const p = parseDateParts(e.data_nascimento);
        const thisYear = new Date(today.getFullYear(), p.month - 1, p.day);
        const diff = (thisYear.getTime() - today.getTime()) / 86400000;
        return diff > 0 && diff <= 7;
      })
      .map(e => {
        const p = parseDateParts(e.data_nascimento!);
        return { nome: e.nome_completo, dia: p.day, mes: p.month };
      })
      .slice(0, 5);

    // Gênero
    const genero = { feminino: 0, masculino: 0, naoInformado: 0 };
    activeEmps.forEach(e => {
      if (e.genero === "feminino") genero.feminino++;
      else if (e.genero === "masculino") genero.masculino++;
      else genero.naoInformado++;
    });

    const generoDeptMap = new Map<string, { fem: number; masc: number }>();
    activeEmps.forEach(e => {
      const d = e.departamento || "Outros";
      if (!generoDeptMap.has(d)) generoDeptMap.set(d, { fem: 0, masc: 0 });
      const entry = generoDeptMap.get(d)!;
      if (e.genero === "feminino") entry.fem++;
      else if (e.genero === "masculino") entry.masc++;
    });
    const generoPorDept = [...generoDeptMap.entries()]
      .map(([dept, v]) => ({ dept, fem: v.fem, masc: v.masc }))
      .sort((a, b) => (b.fem + b.masc) - (a.fem + a.masc))
      .slice(0, 5);

    // Faixa etária
    const ages = activeEmps
      .filter(e => e.data_nascimento)
      .map(e => {
        const p = parseDateParts(e.data_nascimento!);
        let age = today.getFullYear() - p.year;
        if (today.getMonth() + 1 < p.month || (today.getMonth() + 1 === p.month && today.getDate() < p.day)) age--;
        return age;
      });

    const faixas = [
      { faixa: "18-25", min: 18, max: 25 },
      { faixa: "26-35", min: 26, max: 35 },
      { faixa: "36-45", min: 36, max: 45 },
      { faixa: "46-55", min: 46, max: 55 },
      { faixa: "56+", min: 56, max: 999 },
    ];
    const faixaEtaria = faixas.map(f => ({
      faixa: f.faixa,
      count: ages.filter(a => a >= f.min && a <= f.max).length,
    }));
    const idadeMedia = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const idadeMaisJovem = ages.length > 0 ? Math.min(...ages) : 0;
    const idadeMaisExperiente = ages.length > 0 ? Math.max(...ages) : 0;

    // Formação
    const formMap = new Map<string, number>();
    activeEmps.forEach(e => {
      const grau = e.grau_escolaridade || "Não informado";
      formMap.set(grau, (formMap.get(grau) || 0) + 1);
    });
    const formacao = [...formMap.entries()]
      .map(([grau, count]) => ({ grau, count }))
      .sort((a, b) => b.count - a.count);
    const cursando = activeEmps.filter(e => e.cursando).length;

    // Recrutamento
    let vagaQ = supabase.from("empregare_vagas").select("situacao, total_contratados, dias_andamento, meta_encerramento_data");
    if (companyId) vagaQ = vagaQ.eq("company_id", companyId);
    const { data: vagas } = await vagaQ;

    const vagasAbertas = (vagas ?? []).filter(v => v.situacao?.toLowerCase().includes("andamento") || v.situacao?.toLowerCase().includes("aberta")).length;
    const vagasEncerradas = (vagas ?? []).filter(v => v.situacao?.toLowerCase().includes("encerrada")).length;
    const contratados = (vagas ?? []).reduce((s, v) => s + (Number(v.total_contratados) || 0), 0);
    const encerradasComContratados = (vagas ?? []).filter(v => v.situacao?.toLowerCase().includes("encerrada") && (Number(v.total_contratados) || 0) > 0);
    const tempoMedioPreenchimento = encerradasComContratados.length > 0
      ? Math.round(encerradasComContratados.reduce((s, v) => s + (Number(v.dias_andamento) || 0), 0) / encerradasComContratados.length)
      : 0;
    const vagasMetaUltrapassada = (vagas ?? []).filter(v => {
      if (!v.meta_encerramento_data) return false;
      if (!v.situacao?.toLowerCase().includes("andamento")) return false;
      return new Date(v.meta_encerramento_data) < today;
    }).length;

    setData({
      headcount, headcountDelta, folhaBruta, folhaDelta: Number(folhaDelta.toFixed(1)),
      encargos, encargosPercentFolha: Number(encargosPercentFolha.toFixed(1)),
      saudeTotal, saudeVidas, custoTotal, custoPerCapita,
      custoFolha: folhaBruta, sparkline, custoFerias, feriasCount,
      custoAfastamento, afastadosCount, custoRescisao, rescisoesList,
      custoHE, hePercentFolha: Number(hePercentFolha.toFixed(1)), heTopDept,
      admitidos, demitidos, taxaTurnover: Number(taxaTurnover.toFixed(1)),
      turnoverHistory, turnoverByDept,
      taxaAbsenteismo: Number(taxaAbsenteismo.toFixed(1)), absenteismoByDept,
      emFeriasAgora, feriasVencidas, feriasAVencer90, feriasProgramadas,
      aniversariantesHoje, aniversariantesMes, proximosAniversariantes,
      genero, generoPorDept, faixaEtaria, idadeMedia, idadeMaisJovem, idadeMaisExperiente,
      formacao, cursando,
      vagasAbertas, vagasEncerradas, contratados, tempoMedioPreenchimento, vagasMetaUltrapassada,
    });
    setLoading(false);
  }, [companyId, comp.mes, comp.ano, dept, selectedCompetencia]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { ...data, loading, competencia: comp, competencias, departamentos };
}
