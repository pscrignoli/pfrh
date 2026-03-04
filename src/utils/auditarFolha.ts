/**
 * Audit engine for parsed payroll data.
 * Runs anomaly detection rules before importing into the database.
 */

import type { FuncionarioParsed } from "./parseFolhaTxt";

// ── Types ──

export type AlertSeverity = "critico" | "atencao" | "informativo";

export interface AuditAlert {
  severity: AlertSeverity;
  funcionario: string;
  numero: number;
  regra: string;
  descricao: string;
  valores: Record<string, unknown>;
}

export interface AuditResult {
  criticos: AuditAlert[];
  atencao: AuditAlert[];
  informativos: AuditAlert[];
}

export interface PreviousRecord {
  employee_id: string;
  numero_funcional: string | null;
  nome: string;
  salario_base: number | null;
  salario: number | null;
  fgts_8: number | null;
  he_total: number | null;
  total_folha: number | null;
}

// ── Helpers ──

const SALARIO_MINIMO = 1_518; // 2025

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stddev(vals: number[], avg: number): number {
  if (vals.length < 2) return 0;
  const sqDiffs = vals.map(v => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (vals.length - 1));
}

function isDemitido(f: FuncionarioParsed): boolean {
  return /demitid/i.test(f.situacao);
}

function isAfastado(f: FuncionarioParsed): boolean {
  return /afastad|aux[ií]lio|licen[çc]a|doen[çc]a/i.test(f.situacao);
}

function fgtsTotal(f: FuncionarioParsed): number {
  return f.bases.fgts_gfip.valor + f.bases.fgts_grrf.valor;
}

function heTotal(f: FuncionarioParsed): number {
  return f.rubricas
    .filter(r => [35, 36, 37, 38].includes(r.codigo))
    .reduce((s, r) => s + r.valor, 0);
}

// ── Main Audit Function ──

export function auditarFolha(
  funcionarios: FuncionarioParsed[],
  mesCompetencia: number,
  anoCompetencia: number,
  folhaAnterior?: PreviousRecord[],
): AuditResult {
  const result: AuditResult = { criticos: [], atencao: [], informativos: [] };

  // Pre-compute salary stats (exclude demitidos and zero salaries)
  const salarios = funcionarios
    .filter(f => !isDemitido(f) && f.salario_base > 0)
    .map(f => f.salario_base);
  const avgSalario = mean(salarios);
  const sdSalario = stddev(salarios, avgSalario);

  // Map previous records by numero_funcional
  const prevMap = new Map<string, PreviousRecord>();
  (folhaAnterior ?? []).forEach(r => {
    if (r.numero_funcional) prevMap.set(r.numero_funcional, r);
  });

  // Track duplicates
  const seenNums = new Map<number, number>();

  for (const f of funcionarios) {
    const ctx = { funcionario: f.nome, numero: f.numero };
    const dem = isDemitido(f);
    const afast = isAfastado(f);
    const fgts = fgtsTotal(f);
    const he = heTotal(f);

    // ── CRÍTICOS ──

    // Proventos = 0 para não-demitido
    if (f.totais.proventos === 0 && !dem) {
      result.criticos.push({
        ...ctx, severity: "critico",
        regra: "proventos_zero",
        descricao: "Proventos zerados — funcionário não é demitido",
        valores: { proventos: f.totais.proventos, situacao: f.situacao },
      });
    }

    // Líquido negativo
    if (f.totais.liquido < 0 && !dem) {
      result.criticos.push({
        ...ctx, severity: "critico",
        regra: "liquido_negativo",
        descricao: "Líquido negativo — descontos excedem proventos",
        valores: { liquido: f.totais.liquido, proventos: f.totais.proventos, descontos: f.totais.descontos },
      });
    }

    // Salário base = 0
    if (f.salario_base === 0 && !dem) {
      result.criticos.push({
        ...ctx, severity: "critico",
        regra: "salario_zero",
        descricao: "Salário base zerado — possível falha no parser",
        valores: { salario_base: 0, proventos: f.totais.proventos },
      });
    }

    // FGTS = 0 para quem tem salário e não está afastado
    if (fgts === 0 && f.salario_base > 0 && !afast && !dem && f.totais.proventos > 0) {
      result.criticos.push({
        ...ctx, severity: "critico",
        regra: "fgts_zero",
        descricao: "FGTS zerado para funcionário com salário ativo",
        valores: { fgts: 0, salario_base: f.salario_base, situacao: f.situacao },
      });
    }

    // Duplicado
    const prevCount = seenNums.get(f.numero) ?? 0;
    seenNums.set(f.numero, prevCount + 1);
    if (prevCount > 0) {
      result.criticos.push({
        ...ctx, severity: "critico",
        regra: "duplicado",
        descricao: `Número funcional ${f.numero} duplicado no arquivo`,
        valores: { numero_funcional: f.numero, ocorrencia: prevCount + 1 },
      });
    }

    // Descontos > 80% dos proventos (não demitido)
    if (!dem && f.totais.proventos > 0 && f.totais.descontos > f.totais.proventos * 0.8) {
      result.criticos.push({
        ...ctx, severity: "critico",
        regra: "desconto_excessivo",
        descricao: "Descontos excedem 80% dos proventos",
        valores: {
          descontos: f.totais.descontos,
          proventos: f.totais.proventos,
          pct: Math.round((f.totais.descontos / f.totais.proventos) * 100),
        },
      });
    }

    // ── ATENÇÃO ──

    if (!dem && f.salario_base > 0 && sdSalario > 0) {
      // Salário muito acima da média
      if (f.salario_base > avgSalario + 2 * sdSalario) {
        result.atencao.push({
          ...ctx, severity: "atencao",
          regra: "salario_acima_media",
          descricao: "Salário muito acima da média da folha",
          valores: { salario: f.salario_base, media: Math.round(avgSalario), desvio: Math.round(sdSalario) },
        });
      }
      // Salário muito abaixo da média
      if (f.salario_base < avgSalario - 1.5 * sdSalario && f.salario_base > 0) {
        result.atencao.push({
          ...ctx, severity: "atencao",
          regra: "salario_abaixo_media",
          descricao: "Salário muito abaixo da média da folha",
          valores: { salario: f.salario_base, media: Math.round(avgSalario), desvio: Math.round(sdSalario) },
        });
      }
    }

    // HE > 30% do salário base
    if (he > 0 && f.salario_base > 0 && he > f.salario_base * 0.3) {
      result.atencao.push({
        ...ctx, severity: "atencao",
        regra: "he_excessiva",
        descricao: "Horas extras excedem 30% do salário base",
        valores: { he, salario_base: f.salario_base, pct: Math.round((he / f.salario_base) * 100) },
      });
    }

    // Proventos divergem muito do salário (>20%)
    if (!dem && f.salario_base > 0 && f.totais.proventos > 0) {
      const diff = Math.abs(f.totais.proventos - f.salario_base);
      if (diff > f.salario_base * 0.2) {
        result.atencao.push({
          ...ctx, severity: "atencao",
          regra: "proventos_divergentes",
          descricao: "Proventos divergem mais de 20% do salário base",
          valores: { proventos: f.totais.proventos, salario_base: f.salario_base, diferenca: diff },
        });
      }
    }

    // Situação vazia
    if (!f.situacao || f.situacao.trim() === "") {
      result.atencao.push({
        ...ctx, severity: "atencao",
        regra: "situacao_vazia",
        descricao: "Situação não identificada pelo parser",
        valores: {},
      });
    }

    // Salário abaixo do piso
    if (!dem && f.salario_base > 0 && f.salario_base < SALARIO_MINIMO) {
      result.atencao.push({
        ...ctx, severity: "atencao",
        regra: "abaixo_piso",
        descricao: `Salário abaixo do piso (R$ ${SALARIO_MINIMO.toLocaleString("pt-BR")})`,
        valores: { salario_base: f.salario_base, piso: SALARIO_MINIMO },
      });
    }

    // FGTS divergente do esperado (|fgts - salario*0.08| > 10%)
    if (fgts > 0 && f.salario_base > 0) {
      const expected = f.salario_base * 0.08;
      if (Math.abs(fgts - expected) > expected * 0.1) {
        result.atencao.push({
          ...ctx, severity: "atencao",
          regra: "fgts_divergente",
          descricao: "FGTS diverge do esperado (8% do salário base)",
          valores: { fgts, esperado: Math.round(expected * 100) / 100, salario_base: f.salario_base },
        });
      }
    }

    // ── INFORMATIVOS ──

    // Admissão no mês da competência
    if (f.data_admissao) {
      const admMatch = f.data_admissao.match(/^(\d{4})-(\d{2})/);
      if (admMatch && Number(admMatch[1]) === anoCompetencia && Number(admMatch[2]) === mesCompetencia) {
        result.informativos.push({
          ...ctx, severity: "informativo",
          regra: "admissao_no_mes",
          descricao: "Funcionário admitido neste mês",
          valores: { data_admissao: f.data_admissao },
        });
      }
    }

    // Demitido no mês
    if (dem) {
      result.informativos.push({
        ...ctx, severity: "informativo",
        regra: "demitido_no_mes",
        descricao: "Funcionário demitido",
        valores: { data_demissao: f.data_demissao, situacao: f.situacao },
      });
    }

    // Licença/auxílio
    if (afast) {
      result.informativos.push({
        ...ctx, severity: "informativo",
        regra: "afastamento",
        descricao: "Funcionário afastado/licença",
        valores: { situacao: f.situacao },
      });
    }

    // Dependentes IR > 5
    if (f.dependentes_ir > 5) {
      result.informativos.push({
        ...ctx, severity: "informativo",
        regra: "muitos_dependentes",
        descricao: `${f.dependentes_ir} dependentes de IR declarados`,
        valores: { dependentes_ir: f.dependentes_ir },
      });
    }

    // ── COMPARATIVOS (se existir folha anterior) ──
    if (prevMap.size > 0) {
      const numFunc = String(f.numero);
      const prev = prevMap.get(numFunc);

      if (!prev && !dem) {
        result.informativos.push({
          ...ctx, severity: "informativo",
          regra: "novo_vs_anterior",
          descricao: "Funcionário não existia na folha anterior",
          valores: {},
        });
      }

      if (prev && prev.salario_base && f.salario_base > 0) {
        const delta = Math.abs(f.salario_base - prev.salario_base);
        if (delta > prev.salario_base * 0.1) {
          result.atencao.push({
            ...ctx, severity: "atencao",
            regra: "salario_reajustado",
            descricao: "Salário variou mais de 10% vs mês anterior",
            valores: {
              salario_atual: f.salario_base,
              salario_anterior: prev.salario_base,
              variacao_pct: Math.round((delta / prev.salario_base) * 100),
            },
          });
        }
      }
    }
  }

  // ── Comparativos globais ──
  if (prevMap.size > 0) {
    // Funcionários que sumiram
    for (const [numFunc, prev] of prevMap.entries()) {
      const found = funcionarios.find(f => String(f.numero) === numFunc);
      if (!found) {
        result.atencao.push({
          severity: "atencao",
          funcionario: prev.nome,
          numero: Number(numFunc) || 0,
          regra: "sumiu_da_folha",
          descricao: "Funcionário presente no mês anterior não aparece neste mês",
          valores: { numero_funcional: numFunc },
        });
      }
    }
  }

  return result;
}

/** Total count of alerts */
export function totalAlerts(r: AuditResult): number {
  return r.criticos.length + r.atencao.length + r.informativos.length;
}
