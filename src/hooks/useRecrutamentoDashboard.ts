import { useMemo } from "react";
import { differenceInDays, parseISO, isAfter, isBefore, isValid } from "date-fns";
import type { EmpregareVaga } from "@/hooks/useEmpregareVagas";

export interface RecrutamentoFilters {
  dateFrom: Date | null;
  dateTo: Date | null;
  status: string; // "todas" | "Aberta" | "Encerrada" | "Cancelada"
  companyId: string | null;
}

export interface VagaDashboardRow {
  id: string;
  empregare_id: number;
  titulo: string;
  totalVagas: number;
  totalCandidaturas: number;
  totalReprovados: number;
  totalCancelados: number;
  totalEmAndamento: number;
  totalContratados: number;
  diasAndamento: number;
  metaEncerramentoData: string | null;
  diasMeta: number | null; // >0 = remaining, <0 = overdue
  dataCadastro: string | null;
  motivoAbertura: string | null;
  situacao: string;
  cidade: string | null;
  estado: string | null;
  nivelHierarquico: string | null;
  tipoRecrutamento: string | null;
  regimeContratacao: string | null;
  modalidadeTrabalho: string | null;
  setor: string | null;
  filial: string | null;
  pcd: boolean;
  salarioMin: number | null;
  salarioMax: number | null;
  salarioCombinar: boolean;
  responsaveis: string[];
  raw: EmpregareVaga;
}

export interface DistributionItem {
  name: string;
  abertas: number;
  encerradas: number;
  total: number;
}

export interface VagasSummary {
  abertas: number;
  encerradas: number;
  canceladas: number;
  contratados: number;
  totalCandidaturas: number;
  taxaConversao: number;
  tempoMedioPreenchimento: number;
  metaUltrapassada: number;
}

function safeDate(d: string | null): Date | null {
  if (!d) return null;
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function useRecrutamentoDashboard(vagas: EmpregareVaga[], filters: RecrutamentoFilters) {
  const filtered = useMemo(() => {
    return vagas.filter(v => {
      // Company filter
      if (filters.companyId && v.company_id !== filters.companyId) return false;
      
      // Status filter
      if (filters.status !== "todas") {
        const sit = (v.situacao ?? "").toLowerCase();
        if (filters.status.toLowerCase() !== sit) return false;
      }
      
      // Date range
      const dc = safeDate(v.data_cadastro);
      if (filters.dateFrom && dc && isBefore(dc, filters.dateFrom)) return false;
      if (filters.dateTo && dc && isAfter(dc, filters.dateTo)) return false;
      
      return true;
    });
  }, [vagas, filters]);

  const rows = useMemo((): VagaDashboardRow[] => {
    return filtered.map(v => {
      const etapas = v.etapas || [];
      let totalCandidaturas = (v as any).total_candidaturas || 0;
      let totalContratados = (v as any).total_contratados || 0;
      
      // Fallback from etapas if new columns not populated
      if (!totalCandidaturas) {
        for (const e of etapas) {
          const nome = (e.nome ?? e.Nome ?? "").toLowerCase();
          if (nome === "todos" || nome === "all") {
            totalCandidaturas = Number(e.qntde ?? e.Qntde ?? e.qtd ?? 0) || 0;
          }
        }
      }
      if (!totalContratados) {
        for (const e of etapas) {
          const nome = (e.nome ?? e.Nome ?? e.titulo ?? "").toLowerCase();
          if (nome.includes("contratad")) {
            totalContratados = Number(e.qntde ?? e.Qntde ?? e.qtd ?? e.totalCandidatos ?? 0) || 0;
          }
        }
      }

      const dc = safeDate(v.data_cadastro);
      const diasAndamento = (v as any).dias_andamento || (dc ? differenceInDays(new Date(), dc) : 0);
      
      const metaStr = (v as any).meta_encerramento_data || v.meta_encerramento;
      const metaDate = safeDate(metaStr);
      const diasMeta = metaDate ? differenceInDays(metaDate, new Date()) : null;

      const responsaveis = (v.responsaveis || []).map((r: any) => r.nome ?? r.Nome ?? "").filter(Boolean);

      return {
        id: v.id,
        empregare_id: v.empregare_id,
        titulo: v.titulo,
        totalVagas: v.total_vagas,
        totalCandidaturas,
        totalReprovados: (v as any).total_reprovados || 0,
        totalCancelados: (v as any).total_cancelados || 0,
        totalEmAndamento: (v as any).total_em_andamento || Math.max(0, totalCandidaturas - totalContratados),
        totalContratados,
        diasAndamento,
        metaEncerramentoData: metaStr,
        diasMeta,
        dataCadastro: v.data_cadastro,
        motivoAbertura: (v as any).motivo_abertura || null,
        situacao: v.situacao ?? "Aberta",
        cidade: v.cidade,
        estado: v.estado,
        nivelHierarquico: (v as any).nivel_hierarquico || null,
        tipoRecrutamento: v.tipo_recrutamento,
        regimeContratacao: (v as any).regime_contratacao || null,
        modalidadeTrabalho: (v as any).modalidade_trabalho || v.trabalho_remoto || null,
        setor: (v as any).setor || null,
        filial: (v as any).filial || null,
        pcd: (v as any).pcd || false,
        salarioMin: v.salario_min,
        salarioMax: v.salario_max,
        salarioCombinar: v.salario_combinar,
        responsaveis,
        raw: v,
      };
    });
  }, [filtered]);

  const summary = useMemo((): VagasSummary => {
    const abertas = rows.filter(r => r.situacao.toLowerCase() === "aberta").length;
    const encerradas = rows.filter(r => r.situacao.toLowerCase() === "encerrada").length;
    const canceladas = rows.filter(r => r.situacao.toLowerCase() === "cancelada").length;
    const contratados = rows.reduce((s, r) => s + r.totalContratados, 0);
    const totalCandidaturas = rows.reduce((s, r) => s + r.totalCandidaturas, 0);
    const taxaConversao = totalCandidaturas > 0 ? (contratados / totalCandidaturas) * 100 : 0;
    
    const encerradasComContratados = rows.filter(r => 
      r.situacao.toLowerCase() === "encerrada" && r.totalContratados > 0 && r.diasAndamento > 0
    );
    const tempoMedio = encerradasComContratados.length > 0
      ? encerradasComContratados.reduce((s, r) => s + r.diasAndamento, 0) / encerradasComContratados.length
      : 0;
    
    const metaUltrapassada = rows.filter(r => 
      r.situacao.toLowerCase() === "aberta" && r.diasMeta !== null && r.diasMeta < 0
    ).length;

    return { abertas, encerradas, canceladas, contratados, totalCandidaturas, taxaConversao, tempoMedioPreenchimento: tempoMedio, metaUltrapassada };
  }, [rows]);

  const buildDistribution = (key: keyof VagaDashboardRow): DistributionItem[] => {
    const map = new Map<string, { abertas: number; encerradas: number }>();
    for (const r of rows) {
      const val = String(r[key] ?? "Não informado");
      const entry = map.get(val) || { abertas: 0, encerradas: 0 };
      if (r.situacao.toLowerCase() === "aberta") entry.abertas++;
      else if (r.situacao.toLowerCase() === "encerrada") entry.encerradas++;
      map.set(val, entry);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, total: v.abertas + v.encerradas }))
      .sort((a, b) => b.total - a.total);
  };

  const distributions = useMemo(() => ({
    setores: buildDistribution("setor"),
    filiais: buildDistribution("filial"),
    cidades: rows.length > 0 ? buildDistribution("cidade" as any) : [],
    nivelHierarquico: buildDistribution("nivelHierarquico"),
    motivoAbertura: buildDistribution("motivoAbertura"),
    tipoRecrutamento: buildDistribution("tipoRecrutamento"),
    cargos: (() => {
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.titulo, (map.get(r.titulo) || 0) + 1);
      return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    })(),
    faixasSalariais: (() => {
      const map = new Map<string, number>();
      for (const r of rows) {
        const faixa = r.salarioCombinar ? "A combinar" 
          : r.salarioMin ? `R$ ${r.salarioMin.toLocaleString("pt-BR")}` 
          : "Não informado";
        map.set(faixa, (map.get(faixa) || 0) + 1);
      }
      return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    })(),
    pcd: {
      sim: rows.filter(r => r.pcd).length,
      nao: rows.filter(r => !r.pcd).length,
    },
    responsaveis: (() => {
      const map = new Map<string, { abertas: number; encerradas: number }>();
      for (const r of rows) {
        for (const resp of r.responsaveis) {
          const entry = map.get(resp) || { abertas: 0, encerradas: 0 };
          if (r.situacao.toLowerCase() === "aberta") entry.abertas++;
          else if (r.situacao.toLowerCase() === "encerrada") entry.encerradas++;
          map.set(resp, entry);
        }
      }
      return Array.from(map.entries())
        .map(([name, v]) => ({ name, ...v, total: v.abertas + v.encerradas }))
        .sort((a, b) => b.total - a.total);
    })(),
  }), [rows]);

  const funnel = useMemo(() => {
    const totalCand = rows.reduce((s, r) => s + r.totalCandidaturas, 0);
    const emAndamento = rows.reduce((s, r) => s + r.totalEmAndamento, 0);
    const contratados = rows.reduce((s, r) => s + r.totalContratados, 0);
    return [
      { name: "Candidaturas", value: totalCand },
      { name: "Em Andamento", value: emAndamento },
      { name: "Contratados", value: contratados },
    ];
  }, [rows]);

  return { rows, summary, distributions, funnel, filtered };
}
