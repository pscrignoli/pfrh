import { supabase } from "@/integrations/supabase/client";

export interface ConferenciaAlerta {
  tipo: "critico" | "atencao" | "informativo";
  categoria: string;
  nome: string;
  detalhe: string;
  fatura?: number;
  folha?: number;
}

export interface ConferenciaResult {
  competencia: string;
  criticos: ConferenciaAlerta[];
  atencao: ConferenciaAlerta[];
  informativos: ConferenciaAlerta[];
  total: number;
  folhaDisponivel: boolean;
  faturaDisponivel: boolean;
}

export async function conferirFaturaVsFolha(
  competencia: string,
  companyId: string
): Promise<ConferenciaResult> {
  const result: ConferenciaResult = {
    competencia,
    criticos: [],
    atencao: [],
    informativos: [],
    total: 0,
    folhaDisponivel: false,
    faturaDisponivel: false,
  };

  // Parse competencia "YYYY-MM-DD" to get mes/ano
  const parts = competencia.split("-");
  const ano = parseInt(parts[0]);
  const mes = parseInt(parts[1]);

  // 1. Fetch health_records (fatura) for this competencia - only titulares
  const { data: faturaRecords } = await supabase
    .from("health_records")
    .select("*, employees!health_records_employee_id_fkey(id, nome_completo, numero_cpf, cargo, departamento)")
    .eq("competencia", competencia)
    .eq("company_id", companyId)
    .eq("parentesco", "titular");

  // Also get ALL records (including dependentes) for informativo checks
  const { data: allFaturaRecords } = await supabase
    .from("health_records")
    .select("*")
    .eq("competencia", competencia)
    .eq("company_id", companyId);

  // Previous month records for diff
  const prevDate = new Date(ano, mes - 2, 1);
  const prevCompetencia = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;
  const { data: prevRecords } = await supabase
    .from("health_records")
    .select("nome_beneficiario, cpf_beneficiario, parentesco, codigo_plano, titular_cpf")
    .eq("competencia", prevCompetencia)
    .eq("company_id", companyId);

  // 2. Fetch payroll for same month
  const { data: folhaRecords } = await supabase
    .from("payroll_monthly_records")
    .select("*, employees!payroll_monthly_records_employee_id_fkey(id, nome_completo, numero_cpf, cargo)")
    .eq("mes", mes)
    .eq("ano", ano)
    .eq("company_id", companyId);

  result.faturaDisponivel = (faturaRecords?.length ?? 0) > 0;
  result.folhaDisponivel = (folhaRecords?.length ?? 0) > 0;

  if (!result.faturaDisponivel || !result.folhaDisponivel) {
    return result;
  }

  const fatura = faturaRecords ?? [];
  const folha = folhaRecords ?? [];
  const allFatura = allFaturaRecords ?? [];
  const prev = prevRecords ?? [];

  // Build maps by CPF
  const faturaMap = new Map<string, any>();
  for (const r of fatura) {
    const cpf = r.cpf_beneficiario?.replace(/\D/g, "");
    if (cpf) faturaMap.set(cpf, r);
  }

  const folhaMap = new Map<string, any>();
  for (const r of folha) {
    const emp = (r as any).employees;
    const cpf = emp?.numero_cpf?.replace(/\D/g, "");
    if (cpf) folhaMap.set(cpf, { ...r, emp });
  }

  // CRITICO 1: Titular na fatura mas NÃO na folha
  for (const [cpf, fr] of faturaMap) {
    if (!folhaMap.has(cpf)) {
      result.criticos.push({
        tipo: "critico",
        categoria: "fatura_sem_folha",
        nome: fr.nome_beneficiario,
        detalhe: `${fr.nome_beneficiario} está na fatura ${fr.fonte === "unimed" ? "Unimed" : "Bradesco"} ${mes.toString().padStart(2, "0")}/${ano} mas não aparece na folha do mês.`,
      });
    }
  }

  // CRITICO 2: Tem desconto na folha (convenio_medico > 0) mas NÃO está na fatura
  for (const [cpf, fl] of folhaMap) {
    const temDesconto = (Number(fl.convenio_medico) || 0) > 0;
    if (temDesconto && !faturaMap.has(cpf)) {
      result.criticos.push({
        tipo: "critico",
        categoria: "folha_sem_fatura",
        nome: fl.emp?.nome_completo || fl.contrato_empregado || "Desconhecido",
        detalhe: `${fl.emp?.nome_completo || "Colaborador"} tem desconto de plano na folha (R$ ${Number(fl.convenio_medico).toFixed(2)}) mas não está na fatura.`,
      });
    }
  }

  // ATENCAO 3: Divergência parte colaborador (fatura vs folha convenio_medico)
  for (const [cpf, fr] of faturaMap) {
    const fl = folhaMap.get(cpf);
    if (!fl) continue;

    const faturaColab = Number(fr.parte_colaborador) || 0;
    const folhaConvenio = Number(fl.convenio_medico) || 0;

    if (Math.abs(faturaColab - folhaConvenio) > 2) {
      result.atencao.push({
        tipo: "atencao",
        categoria: "divergencia_colaborador",
        nome: fr.nome_beneficiario,
        detalhe: `${fr.nome_beneficiario}: Fatura cobra R$ ${faturaColab.toFixed(2)} do colaborador, folha desconta R$ ${folhaConvenio.toFixed(2)}.`,
        fatura: faturaColab,
        folha: folhaConvenio,
      });
    }

    // ATENCAO 4: Divergência coparticipação
    const faturaCopart = Number(fr.coparticipacao) || 0;
    const folhaPlanoOdonto = Number(fl.plano_odontologico) || 0; // rubrica 1819 mapped here
    if (faturaCopart > 0 && Math.abs(faturaCopart - folhaPlanoOdonto) > 5) {
      result.atencao.push({
        tipo: "atencao",
        categoria: "divergencia_coparticipacao",
        nome: fr.nome_beneficiario,
        detalhe: `${fr.nome_beneficiario}: Fatura copart R$ ${faturaCopart.toFixed(2)}, folha desconta R$ ${folhaPlanoOdonto.toFixed(2)}.`,
        fatura: faturaCopart,
        folha: folhaPlanoOdonto,
      });
    }
  }

  // INFORMATIVO 6/7: Novos dependentes e dependentes removidos
  const prevDepSet = new Set(prev.filter(r => r.parentesco !== "titular").map(r => `${r.cpf_beneficiario || r.nome_beneficiario}__${r.titular_cpf}`));
  const currDepSet = new Set(allFatura.filter(r => r.parentesco !== "titular").map(r => `${r.cpf_beneficiario || r.nome_beneficiario}__${r.titular_cpf}`));

  for (const r of allFatura) {
    if (r.parentesco === "titular") continue;
    const key = `${r.cpf_beneficiario || r.nome_beneficiario}__${r.titular_cpf}`;
    if (!prevDepSet.has(key) && prev.length > 0) {
      result.informativos.push({
        tipo: "informativo",
        categoria: "novo_dependente",
        nome: r.titular_nome || "Titular",
        detalhe: `${r.titular_nome || "Titular"}: novo dependente ${r.nome_beneficiario} incluído em ${mes.toString().padStart(2, "0")}/${ano}.`,
      });
    }
  }

  if (prev.length > 0) {
    for (const r of prev) {
      if (r.parentesco === "titular") continue;
      const key = `${r.cpf_beneficiario || r.nome_beneficiario}__${r.titular_cpf}`;
      if (!currDepSet.has(key)) {
        result.informativos.push({
          tipo: "informativo",
          categoria: "dependente_removido",
          nome: r.titular_cpf || "Titular",
          detalhe: `Dependente ${r.nome_beneficiario} removido em ${mes.toString().padStart(2, "0")}/${ano}.`,
        });
      }
    }
  }

  // INFORMATIVO 8: Mudança de plano
  if (prev.length > 0) {
    const prevPlanMap = new Map<string, string>();
    for (const r of prev) {
      if (r.parentesco === "titular" && r.cpf_beneficiario) {
        prevPlanMap.set(r.cpf_beneficiario.replace(/\D/g, ""), r.codigo_plano || "");
      }
    }
    for (const r of fatura) {
      const cpf = r.cpf_beneficiario?.replace(/\D/g, "");
      if (!cpf) continue;
      const prevPlano = prevPlanMap.get(cpf);
      if (prevPlano && prevPlano !== (r.codigo_plano || "") && prevPlano !== "") {
        result.informativos.push({
          tipo: "informativo",
          categoria: "mudanca_plano",
          nome: r.nome_beneficiario,
          detalhe: `${r.nome_beneficiario}: mudou de ${prevPlano} para ${r.codigo_plano}.`,
        });
      }
    }
  }

  result.total = result.criticos.length + result.atencao.length + result.informativos.length;
  return result;
}
