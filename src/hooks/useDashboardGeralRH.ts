import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function parseDateParts(ds: string) {
  const [y, m, d] = ds.split("T")[0].split("-").map(Number);
  return { year: y, month: m, day: d };
}

/**
 * Calculate the current período aquisitivo for an employee based on admission date.
 * Returns: { inicio, fim, vencimento }
 * - inicio: start of the current aquisitive period
 * - fim: end of the current aquisitive period
 * - vencimento: deadline to take the vacation (12 months after fim)
 */
function calcPeriodoAquisitivo(dataAdmissao: Date, referenceDate: Date) {
  const admDay = dataAdmissao.getDate();
  const admMonth = dataAdmissao.getMonth();
  let year = referenceDate.getFullYear();

  let aniversario = new Date(year, admMonth, admDay);
  if (aniversario > referenceDate) {
    aniversario = new Date(year - 1, admMonth, admDay);
  }

  const inicio = aniversario;
  const fim = new Date(inicio.getFullYear() + 1, inicio.getMonth(), inicio.getDate() - 1);
  const vencimento = new Date(fim.getFullYear() + 1, fim.getMonth(), fim.getDate());

  return { inicio, fim, vencimento };
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

  // Linha 4 - Aniversariantes
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

const EMPTY: Omit<DashboardGeralData, "loading" | "competencia" | "competencias" | "departamentos"> = {
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
};

export function useDashboardGeralRH(
  selectedCompetencia?: { mes: number; ano: number } | null,
  selectedDepartamento?: string | null
): DashboardGeralData {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY);
  const [competencias, setCompetencias] = useState<{ mes: number; ano: number }[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [detectedComp, setDetectedComp] = useState<{ mes: number; ano: number }>({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear() });

  const comp = selectedCompetencia || detectedComp;
  const dept = selectedDepartamento;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mes = comp.mes;
    const ano = comp.ano;

    const prevDate = new Date(ano, mes - 2, 1);
    const prevMes = prevDate.getMonth() + 1;
    const prevAno = prevDate.getFullYear();

    // ─── PARALLEL FETCH: all independent queries at once ───
    let empQ = supabase.from("rh_employees").select("id, nome_completo, status, data_admissao, data_demissao, data_nascimento, departamento, cargo, genero, grau_escolaridade, cursando, company_id, salario_base");
    if (companyId) empQ = empQ.eq("company_id", companyId);

    let compQ = supabase.from("rh_payroll_monthly_records").select("mes, ano").order("ano", { ascending: false }).order("mes", { ascending: false });
    if (companyId) compQ = compQ.eq("company_id", companyId);

    // Fetch current + previous month payroll in one go — also fetch sparkline data (6 months back)
    const sparklineStart = new Date(ano, mes - 7, 1); // 6 months before
    let allPayrollQ = supabase.from("rh_payroll_monthly_records")
      .select("*")
      .gte("ano", sparklineStart.getFullYear())
      .order("ano").order("mes")
      .limit(5000);
    if (companyId) allPayrollQ = allPayrollQ.eq("company_id", companyId);

    let hlQ = supabase.from("rh_health_invoices").select("valor_fatura, valor_cobrado, total_vidas").eq("competencia", `${ano}-${String(mes).padStart(2, "0")}-01`);
    if (companyId) hlQ = hlQ.eq("company_id", companyId);

    // Férias: fetch ALL records (not filtered by status) to correctly determine em_gozo vs programada
    let ferQ = supabase.from("rh_ferias").select("*");
    if (companyId) ferQ = ferQ.eq("company_id", companyId);

    let vagaQ = supabase.from("rh_empregare_vagas").select("situacao, total_contratados, dias_andamento, meta_encerramento_data");
    if (companyId) vagaQ = vagaQ.eq("company_id", companyId);

    const [empRes, compRes, allPayrollRes, hlRes, ferRes, vagaRes] = await Promise.all([
      empQ, compQ, allPayrollQ, hlQ, ferQ, vagaQ,
    ]);

    const allEmployees = empRes.data ?? [];
    const emps = allEmployees.filter(e => !dept || e.departamento === dept);
    const allPayrollRaw = allPayrollRes.data ?? [];

    // ─── COMPETENCIAS ───
    const uniqueComps: { mes: number; ano: number }[] = [];
    const compSet = new Set<string>();
    for (const r of (compRes.data ?? [])) {
      const k = `${r.ano}-${r.mes}`;
      if (!compSet.has(k)) { compSet.add(k); uniqueComps.push({ mes: r.mes, ano: r.ano }); }
    }
    setCompetencias(uniqueComps);
    if (!selectedCompetencia && uniqueComps.length > 0) {
      setDetectedComp(uniqueComps[0]);
    }

    // Departments
    const deptSet = new Set<string>();
    allEmployees.forEach(e => { if (e.departamento) deptSet.add(e.departamento); });
    setDepartamentos([...deptSet].sort());

    // ─── EMPLOYEES & HEADCOUNT ───
    const activeEmps = emps.filter(e => e.status === "ativo");
    const headcount = activeEmps.length;

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

    // ─── PAYROLL: filter by department via employees list ───
    // Build employee->dept map from employees data
    const empDeptMap = new Map<string, string>();
    for (const e of allEmployees) {
      if (e.departamento) {
        empDeptMap.set(e.id, e.departamento);
      }
    }

    // Filter payroll by selected department using employee's departamento
    const allPayroll = dept
      ? allPayrollRaw.filter(r => empDeptMap.get(r.employee_id) === dept)
      : allPayrollRaw;

    const pr = allPayroll.filter(r => r.ano === ano && r.mes === mes);
    const prevPr = allPayroll.filter(r => r.ano === prevAno && r.mes === prevMes);

    // ─── FOLHA BRUTA ───
    // Use consistent calculation: salario + he_total + dsr + adicional_noturno + insalubridade + bonus + gratificacao + dif_salario
    const calcFolha = (records: typeof pr) =>
      records.reduce((s, r) =>
        s + (Number(r.salario) || 0) + (Number(r.he_total) || 0) + (Number(r.dsr_horas) || 0)
        + (Number(r.adicional_noturno) || 0) + (Number(r.insalubridade) || 0)
        + (Number(r.bonus_gratificacao) || 0) + (Number(r.salario_gratificacao) || 0)
        + (Number(r.diferenca_salario) || 0),
      0);

    const folhaBruta = calcFolha(pr);
    const prevFolha = calcFolha(prevPr);
    const folhaDelta = prevFolha > 0 ? ((folhaBruta - prevFolha) / prevFolha) * 100 : 0;

    // ─── ENCARGOS ───
    // IMPORTANT: inss_20/inss_ferias/inss_13 store BASES (salary amounts), not actual contributions.
    // fgts_8 stores the actual FGTS value. The pre-calculated `encargos` field = inss_base + fgts_value.
    // Use the pre-calculated `encargos` field for consistency with Custo Pessoal dashboard.
    // For a more accurate calculation, we derive INSS patronal from bases * rate.
    const INSS_PATRONAL_RATE = 0.288; // 20% patronal + ~5.8% terceiros + ~3% RAT/FAP (approximation)
    const calcEncargos = (records: typeof pr) =>
      records.reduce((s, r) => {
        const inssBase = (Number(r.inss_20) || 0);
        const inssBaseFerias = (Number(r.inss_ferias) || 0);
        const inssBase13 = (Number(r.inss_13) || 0);
        const inssPatronal = (inssBase + inssBaseFerias + inssBase13) * INSS_PATRONAL_RATE;
        const fgts = (Number(r.fgts_8) || 0) + (Number(r.fgts_ferias) || 0) + (Number(r.fgts_13) || 0);
        return s + inssPatronal + fgts;
      }, 0);

    const encargos = calcEncargos(pr);
    const encargosPercentFolha = folhaBruta > 0 ? (encargos / folhaBruta) * 100 : 0;

    // ─── BENEFÍCIOS (da folha) ───
    const beneficiosFolha = pr.reduce((s, r) =>
      s + (Number(r.convenio_medico) || 0) + (Number(r.plano_odontologico) || 0)
      + (Number(r.plano_odontologico_empresa) || 0) + (Number(r.vale_transporte) || 0)
      + (Number(r.vr_alimentacao) || 0) + (Number(r.auxilio_alimentacao) || 0)
      + (Number(r.ajuda_de_custo) || 0) + (Number(r.vr_auto) || 0),
    0);

    // ─── SAÚDE ───
    const healthInv = hlRes.data ?? [];
    const saudeTotal = healthInv.reduce((s, r) => s + (Number(r.valor_cobrado) || Number(r.valor_fatura) || 0), 0);
    const saudeVidas = healthInv.reduce((s, r) => s + (Number(r.total_vidas) || 0), 0);

    const custoTotal = folhaBruta + encargos + beneficiosFolha + saudeTotal;
    const custoPerCapita = headcount > 0 ? custoTotal / headcount : 0;

    // ─── SPARKLINE (from already-fetched data, no extra queries) ───
    const sparkline: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const sd = new Date(ano, mes - 1 - i, 1);
      const sm = sd.getMonth() + 1;
      const sy = sd.getFullYear();
      const monthRecords = allPayroll.filter(r => r.ano === sy && r.mes === sm);
      sparkline.push(calcFolha(monthRecords));
    }

    // ─── CUSTO DE FÉRIAS ───
    const custoFerias = pr.reduce((s, r) =>
      s + (Number(r.ferias) || 0) + (Number(r.terco_ferias) || 0) + (Number(r.avos_ferias) || 0),
    0);
    const feriasCount = pr.filter(r => (Number(r.ferias) || 0) > 0).length;

    // ─── CUSTO DE AFASTAMENTO ───
    // Detect afastados by relacao_funcionarios containing relevant keywords
    const afastadoRecords = pr.filter(r =>
      r.relacao_funcionarios && /licen[cç]|afasta|aux[ií]lio\s*doen/i.test(r.relacao_funcionarios)
    );
    const afastadosCount = afastadoRecords.length;
    // Sum total_geral for afastados as their cost impact
    const custoAfastamento = afastadoRecords.reduce((s, r) => s + (Number(r.total_geral) || 0), 0);

    // ─── CUSTO DE RESCISÃO ───
    const rescisaoRecords = pr.filter(r => {
      if (r.desligamento) return true;
      const emp = emps.find(e => e.id === r.employee_id);
      return emp?.data_demissao && parseDateParts(emp.data_demissao).month === mes && parseDateParts(emp.data_demissao).year === ano;
    });
    const custoRescisao = rescisaoRecords.reduce((s, r) => s + (Number(r.total_geral) || 0), 0);
    const rescisoesList = [...new Set(rescisaoRecords.map(r => {
      const emp = emps.find(e => e.id === r.employee_id);
      return emp?.nome_completo?.split(" ")[0] || r.contrato_empregado || "?";
    }))];

    // ─── HORAS EXTRAS ───
    const custoHE = pr.reduce((s, r) =>
      s + (Number(r.he_total) || 0) + (Number(r.dsr_horas) || 0),
    0);
    const hePercentFolha = folhaBruta > 0 ? (custoHE / folhaBruta) * 100 : 0;

    const heDeptMap = new Map<string, number>();
    pr.forEach(r => {
      const d = empDeptMap.get(r.employee_id) || r.area || r.centro_custo || "Outros";
      const he = (Number(r.he_total) || 0) + (Number(r.dsr_horas) || 0);
      heDeptMap.set(d, (heDeptMap.get(d) || 0) + he);
    });
    const heTopDept = [...heDeptMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    // ─── TURNOVER ───
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
      // Use avg headcount for that month for proper turnover calc
      const monthActiveEnd = emps.filter(e => {
        const da = parseDateParts(e.data_admissao);
        const admD = new Date(da.year, da.month - 1, da.day);
        if (admD > new Date(ty, tm - 1, 28)) return false;
        if (e.data_demissao) {
          const dd = parseDateParts(e.data_demissao);
          const demD = new Date(dd.year, dd.month - 1, dd.day);
          if (demD < new Date(ty, tm - 1, 1)) return false;
        }
        return e.status === "ativo" || (e.data_demissao && parseDateParts(e.data_demissao).month >= tm);
      }).length;
      turnoverHistory.push({
        label: `${MONTH_LABELS[tm - 1]}/${String(ty).slice(2)}`,
        admitidos: adm,
        demitidos: dem,
        taxa: monthActiveEnd > 0 ? (dem / monthActiveEnd) * 100 : 0,
      });
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

    // ─── ABSENTEÍSMO ───
    const faltaRecords = pr.filter(r => (Number(r.falta) || 0) > 0);
    const taxaAbsenteismo = pr.length > 0 ? (faltaRecords.length / pr.length) * 100 : 0;
    const absDeptMap = new Map<string, { total: number; faltas: number }>();
    pr.forEach(r => {
      const d = empDeptMap.get(r.employee_id) || r.area || r.centro_custo || "Outros";
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

    // ─── FÉRIAS (corrigido: usar calcPeriodoAquisitivo como useFerias) ───
    const feriasData = (ferRes.data ?? []) as any[];

    // Em férias agora: status aprovada ou programada com datas abrangendo hoje
    const emFeriasAgora = feriasData.filter(f => {
      if (!f.data_inicio || !f.data_fim) return false;
      const ini = new Date(f.data_inicio + "T12:00:00");
      const fim = new Date(f.data_fim + "T12:00:00");
      return today >= ini && today <= fim && (f.status === "aprovada" || f.status === "programada" || f.status === "em_gozo");
    }).length;

    // Férias vencidas: usar mesma lógica do useFerias
    // Para cada employee ativo, calcular período aquisitivo atual e verificar se tem férias gozadas
    let feriasVencidas = 0;
    let feriasAVencer90 = 0;
    for (const emp of activeEmps) {
      const da = parseDateParts(emp.data_admissao);
      const admDate = new Date(da.year, da.month - 1, da.day);
      const { inicio, vencimento } = calcPeriodoAquisitivo(admDate, today);

      const periodoInicioStr = inicio.toISOString().split("T")[0];

      // Check if employee has vacation for this aquisitive period
      const empFerias = feriasData.filter(f => f.employee_id === emp.id);
      const hasVacationForPeriod = empFerias.some(f =>
        f.periodo_aquisitivo_inicio === periodoInicioStr &&
        (f.status === "gozada" || f.status === "aprovada" || f.status === "programada" || f.status === "em_gozo")
      );

      // Also check if currently in vacation (em_gozo)
      const isOnVacation = empFerias.some(f =>
        f.data_inicio && f.data_fim &&
        new Date(f.data_inicio + "T12:00:00") <= today &&
        new Date(f.data_fim + "T12:00:00") >= today
      );

      if (hasVacationForPeriod || isOnVacation) continue;

      const diasParaVencimento = Math.floor((vencimento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diasParaVencimento < 0) {
        feriasVencidas++;
      } else if (diasParaVencimento <= 90) {
        feriasAVencer90++;
      }
    }

    // Férias programadas: futuras
    const feriasProgramadas = feriasData.filter(f => {
      if (!f.data_inicio) return false;
      return new Date(f.data_inicio + "T12:00:00") > today &&
        (f.status === "aprovada" || f.status === "programada");
    }).length;

    // ─── ANIVERSARIANTES ───
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
      .sort((a, b) => {
        const da = new Date(today.getFullYear(), a.mes - 1, a.dia);
        const db = new Date(today.getFullYear(), b.mes - 1, b.dia);
        return da.getTime() - db.getTime();
      })
      .slice(0, 5);

    // ─── GÊNERO ───
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

    // ─── FAIXA ETÁRIA ───
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

    // ─── FORMAÇÃO ───
    const formMap = new Map<string, number>();
    activeEmps.forEach(e => {
      const grau = e.grau_escolaridade || "Não informado";
      formMap.set(grau, (formMap.get(grau) || 0) + 1);
    });
    const formacao = [...formMap.entries()]
      .map(([grau, count]) => ({ grau, count }))
      .sort((a, b) => b.count - a.count);
    const cursando = activeEmps.filter(e => e.cursando).length;

    // ─── RECRUTAMENTO ───
    const vagas = vagaRes.data ?? [];
    const vagasAbertas = vagas.filter(v => v.situacao?.toLowerCase().includes("andamento") || v.situacao?.toLowerCase().includes("aberta")).length;
    const vagasEncerradas = vagas.filter(v => v.situacao?.toLowerCase().includes("encerrada")).length;
    const contratados = vagas.reduce((s, v) => s + (Number(v.total_contratados) || 0), 0);
    const encerradasComContratados = vagas.filter(v => v.situacao?.toLowerCase().includes("encerrada") && (Number(v.total_contratados) || 0) > 0);
    const tempoMedioPreenchimento = encerradasComContratados.length > 0
      ? Math.round(encerradasComContratados.reduce((s, v) => s + (Number(v.dias_andamento) || 0), 0) / encerradasComContratados.length)
      : 0;
    const vagasMetaUltrapassada = vagas.filter(v => {
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
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setLoading(false);
    }
  }, [companyId, comp.mes, comp.ano, dept, selectedCompetencia]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { ...data, loading, competencia: comp, competencias, departamentos };
}
