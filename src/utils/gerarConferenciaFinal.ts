/**
 * Generates reconciliation/conference data for the final review step
 * before importing payroll data into the database.
 */

import type { FuncionarioParsed, ParsedPayroll } from "./parseFolhaTxt";
import type { CorrectionLog } from "@/components/financeiro/AuditAlertCard";

// ── Types ──

export interface TotalizadorRow {
  label: string;
  valorTxt: number;
  valorCorrigido: number;
  confere: boolean;
  delta: number;
  detalhamento?: string;
}

export interface HeadcountRow {
  situacao: string;
  qtd: number;
  proventos: number;
  pctFolha: number;
}

export interface EncargosData {
  inssFuncionarios: number;
  inssEmpresa: number;
  irrfTotal: number;
  fgtsGfip: number;
  fgtsGrrf: number;
  ratFap: number;
  terceiros: number;
  gpsTotal: number;
  pctFolhaBruta: number;
}

export interface FaixaSalarial {
  label: string;
  min: number;
  max: number;
  count: number;
  pct: number;
}

export interface EstatisticasSalariais {
  menor: { valor: number; nome: string };
  maior: { valor: number; nome: string };
  mediana: number;
  media: number;
}

export interface TipoContratoRow {
  tipo: string;
  qtd: number;
  proventos: number;
}

export interface CargaHorariaRow {
  horas: number;
  qtd: number;
  pct: number;
}

export interface DestaquesMes {
  admissoes: { nome: string; data: string | null }[];
  demissoes: { nome: string; data: string | null }[];
  licencas: { nome: string; situacao: string }[];
  afastamentos: { nome: string; situacao: string }[];
  heTotal: number;
  heFuncionarios: number;
  planoSaudeTotal: number;
}

export interface ConferenciaFinalData {
  totalizadores: TotalizadorRow[];
  provaReal: { proventos: number; descontos: number; calculado: number; informado: number; confere: boolean };
  headcount: HeadcountRow[];
  encargos: EncargosData;
  faixasSalariais: FaixaSalarial[];
  estatisticas: EstatisticasSalariais;
  tiposContrato: TipoContratoRow[];
  cargasHorarias: CargaHorariaRow[];
  destaques: DestaquesMes;
  correctionLogs: CorrectionLog[];
  correctionCount: number;
  reviewedCount: number;
}

// ── Helpers ──

function normalizeSituacao(s: string): string {
  if (!s || s.trim() === "") return "Não identificado";
  if (/demitid/i.test(s)) return "Demitido";
  if (/licen[çc]a.*matern/i.test(s)) return "Lic. Maternidade";
  if (/aux[ií]lio.*doen[çc]a/i.test(s)) return "Auxílio Doença";
  if (/afastad/i.test(s)) return "Afastado";
  if (/trabalhando/i.test(s) || /ativo/i.test(s) || /normal/i.test(s)) return "Trabalhando";
  return s;
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function heTotal(f: FuncionarioParsed): number {
  return f.rubricas
    .filter(r => [35, 36, 37, 38].includes(r.codigo))
    .reduce((s, r) => s + r.valor, 0);
}

// ── Main ──

export function gerarConferenciaFinal(
  parsedOriginal: ParsedPayroll,
  parsedCorrigido: ParsedPayroll,
  corrLogs: CorrectionLog[],
  corrCount: number,
  revCount: number,
  mesCompetencia: number,
  anoCompetencia: number,
): ConferenciaFinalData {
  const funcs = parsedCorrigido.funcionarios;
  const totaisArquivo = parsedOriginal.totais_gerais;

  // ── 1. Totalizadores ──
  const sumProventos = funcs.reduce((s, f) => s + f.totais.proventos, 0);
  const sumDescontos = funcs.reduce((s, f) => s + f.totais.descontos, 0);
  const sumLiquido = funcs.reduce((s, f) => s + f.totais.liquido, 0);
  const sumFgtsGfip = funcs.reduce((s, f) => s + f.bases.fgts_gfip.valor, 0);
  const sumFgtsGrrf = funcs.reduce((s, f) => s + f.bases.fgts_grrf.valor, 0);
  const sumFgts = sumFgtsGfip + sumFgtsGrrf;

  const mkRow = (label: string, txt: number, corr: number, det?: string): TotalizadorRow => ({
    label,
    valorTxt: txt,
    valorCorrigido: corr,
    confere: Math.abs(txt - corr) < 0.02,
    delta: corr - txt,
    detalhamento: det,
  });

  const totalizadores: TotalizadorRow[] = [
    mkRow("Proventos", totaisArquivo.proventos, sumProventos),
    mkRow("Descontos", totaisArquivo.descontos, sumDescontos),
    mkRow("Líquido", totaisArquivo.liquido, sumLiquido),
    mkRow("FGTS Total", sumFgts, sumFgts, `GFIP ${fmt(sumFgtsGfip)} + GRRF ${fmt(sumFgtsGrrf)}`),
  ];

  const provaRealCalc = sumProventos - sumDescontos;
  const provaReal = {
    proventos: sumProventos,
    descontos: sumDescontos,
    calculado: provaRealCalc,
    informado: sumLiquido,
    confere: Math.abs(provaRealCalc - sumLiquido) < 0.02,
  };

  // ── 2. Headcount por Situação ──
  const sitMap = new Map<string, { qtd: number; proventos: number }>();
  funcs.forEach(f => {
    const sit = normalizeSituacao(f.situacao);
    const cur = sitMap.get(sit) ?? { qtd: 0, proventos: 0 };
    cur.qtd++;
    cur.proventos += f.totais.proventos;
    sitMap.set(sit, cur);
  });
  const headcount: HeadcountRow[] = Array.from(sitMap.entries())
    .sort((a, b) => b[1].proventos - a[1].proventos)
    .map(([situacao, d]) => ({
      situacao,
      qtd: d.qtd,
      proventos: d.proventos,
      pctFolha: sumProventos > 0 ? (d.proventos / sumProventos) * 100 : 0,
    }));

  // ── 3. Encargos ──
  const inssFunc = funcs.reduce((s, f) => s + f.bases.inss.normal, 0);
  const inssEmp = funcs.reduce((s, f) => s + f.bases.inss_empresa.normal, 0);
  const irrfTotal = funcs.reduce((s, f) => s + f.bases.irrf.normal, 0);

  const encargos: EncargosData = {
    inssFuncionarios: inssFunc,
    inssEmpresa: inssEmp,
    irrfTotal,
    fgtsGfip: sumFgtsGfip,
    fgtsGrrf: sumFgtsGrrf,
    ratFap: 0,
    terceiros: 0,
    gpsTotal: inssEmp,
    pctFolhaBruta: sumProventos > 0 ? ((inssEmp + sumFgts) / sumProventos) * 100 : 0,
  };

  // ── 4. Distribuição Salarial ──
  const faixasDef = [
    { label: "Até R$ 2.000", min: 0, max: 2000 },
    { label: "R$ 2.001 - 4.000", min: 2001, max: 4000 },
    { label: "R$ 4.001 - 7.000", min: 4001, max: 7000 },
    { label: "R$ 7.001 - 12.000", min: 7001, max: 12000 },
    { label: "R$ 12.001 - 20.000", min: 12001, max: 20000 },
    { label: "Acima de R$ 20.000", min: 20001, max: Infinity },
  ];

  const ativos = funcs.filter(f => !/demitid/i.test(f.situacao) && f.salario_base > 0);
  const salarios = ativos.map(f => f.salario_base);

  const faixasSalariais: FaixaSalarial[] = faixasDef.map(fd => {
    const count = ativos.filter(f => f.salario_base >= fd.min && f.salario_base <= fd.max).length;
    return { ...fd, count, pct: ativos.length > 0 ? (count / ativos.length) * 100 : 0 };
  });

  let menor = { valor: Infinity, nome: "" };
  let maior = { valor: -Infinity, nome: "" };
  ativos.forEach(f => {
    if (f.salario_base < menor.valor) menor = { valor: f.salario_base, nome: f.nome };
    if (f.salario_base > maior.valor) maior = { valor: f.salario_base, nome: f.nome };
  });
  if (menor.valor === Infinity) menor = { valor: 0, nome: "—" };
  if (maior.valor === -Infinity) maior = { valor: 0, nome: "—" };

  const estatisticas: EstatisticasSalariais = {
    menor,
    maior,
    mediana: median(salarios),
    media: salarios.length > 0 ? salarios.reduce((a, b) => a + b, 0) / salarios.length : 0,
  };

  // ── 5. Tipo de Contrato ──
  const contratoMap = new Map<string, { qtd: number; proventos: number }>();
  funcs.forEach(f => {
    const tipo = f.organograma || "CLT";
    const cur = contratoMap.get(tipo) ?? { qtd: 0, proventos: 0 };
    cur.qtd++;
    cur.proventos += f.totais.proventos;
    contratoMap.set(tipo, cur);
  });
  const tiposContrato: TipoContratoRow[] = Array.from(contratoMap.entries())
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .map(([tipo, d]) => ({ tipo, qtd: d.qtd, proventos: d.proventos }));

  // ── 6. Carga Horária ──
  const chMap = new Map<number, number>();
  funcs.forEach(f => {
    const ch = f.carga_horaria || 220;
    chMap.set(ch, (chMap.get(ch) ?? 0) + 1);
  });
  const cargasHorarias: CargaHorariaRow[] = Array.from(chMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([horas, qtd]) => ({ horas, qtd, pct: (qtd / funcs.length) * 100 }));

  // ── 7. Destaques do Mês ──
  const admissoes: { nome: string; data: string | null }[] = [];
  const demissoes: { nome: string; data: string | null }[] = [];
  const licencas: { nome: string; situacao: string }[] = [];
  const afastamentos: { nome: string; situacao: string }[] = [];
  let heSum = 0;
  let heFuncs = 0;
  let planoSaudeTotal = 0;

  funcs.forEach(f => {
    // Admissão no mês
    if (f.data_admissao) {
      const m = f.data_admissao.match(/^(\d{4})-(\d{2})/);
      if (m && Number(m[1]) === anoCompetencia && Number(m[2]) === mesCompetencia) {
        admissoes.push({ nome: f.nome, data: f.data_admissao });
      }
    }
    // Demissão
    if (/demitid/i.test(f.situacao)) {
      demissoes.push({ nome: f.nome, data: f.data_demissao });
    }
    // Licenças
    if (/licen[çc]a.*matern/i.test(f.situacao)) {
      licencas.push({ nome: f.nome, situacao: f.situacao });
    }
    // Afastamentos
    if (/aux[ií]lio.*doen[çc]a/i.test(f.situacao) || /afastad/i.test(f.situacao)) {
      afastamentos.push({ nome: f.nome, situacao: f.situacao });
    }
    // HE
    const fHe = heTotal(f);
    if (fHe > 0) {
      heSum += fHe;
      heFuncs++;
    }
    // Plano de saúde
    planoSaudeTotal += f.plano_saude.total;
  });

  const destaques: DestaquesMes = {
    admissoes,
    demissoes,
    licencas,
    afastamentos,
    heTotal: heSum,
    heFuncionarios: heFuncs,
    planoSaudeTotal,
  };

  return {
    totalizadores,
    provaReal,
    headcount,
    encargos,
    faixasSalariais,
    estatisticas,
    tiposContrato,
    cargasHorarias,
    destaques,
    correctionLogs: corrLogs,
    correctionCount: corrCount,
    reviewedCount: revCount,
  };
}

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
