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

const normalize = (s: string) =>
  s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

export async function conferirFaturaVsFolha(
  competencia: string,
  companyId: string,
  tipoCobertura: "medico" | "odontologico" | "todos" = "todos"
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

  const parts = competencia.split("-");
  const ano = parseInt(parts[0]);
  const mes = parseInt(parts[1]);

  // 1. Fetch health_records (fatura) - titulares only, filtered by tipo
  let qTitulares = supabase
    .from("health_records")
    .select("*, employees!health_records_employee_id_fkey(id, nome_completo, numero_cpf, cargo, departamento)")
    .eq("competencia", competencia)
    .eq("company_id", companyId)
    .eq("parentesco", "titular");
  if (tipoCobertura !== "todos") {
    qTitulares = qTitulares.eq("tipo_cobertura", tipoCobertura);
  }
  const { data: faturaRecords } = await qTitulares;

  // All records (including dependentes) for informativo checks
  let qAll = supabase
    .from("health_records")
    .select("*")
    .eq("competencia", competencia)
    .eq("company_id", companyId);
  if (tipoCobertura !== "todos") {
    qAll = qAll.eq("tipo_cobertura", tipoCobertura);
  }
  const { data: allFaturaRecords } = await qAll;

  // Previous month records for diff
  const prevDate = new Date(ano, mes - 2, 1);
  const prevCompetencia = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;
  let qPrev = supabase
    .from("health_records")
    .select("nome_beneficiario, cpf_beneficiario, parentesco, codigo_plano, titular_cpf")
    .eq("competencia", prevCompetencia)
    .eq("company_id", companyId);
  if (tipoCobertura !== "todos") {
    qPrev = qPrev.eq("tipo_cobertura", tipoCobertura);
  }
  const { data: prevRecords } = await qPrev;

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
  const faturaByName = new Map<string, any>();
  for (const r of fatura) {
    const cpf = r.cpf_beneficiario?.replace(/\D/g, "");
    if (cpf) faturaMap.set(cpf, r);
    if (r.nome_beneficiario) faturaByName.set(normalize(r.nome_beneficiario), r);
  }

  const folhaMap = new Map<string, any>();
  const folhaByName = new Map<string, any>();
  for (const r of folha) {
    const emp = (r as any).employees;
    const cpf = emp?.numero_cpf?.replace(/\D/g, "");
    const entry = { ...r, emp };
    if (cpf) folhaMap.set(cpf, entry);
    if (emp?.nome_completo) folhaByName.set(normalize(emp.nome_completo), entry);
  }

  // Helper: find in folha by CPF then name
  function findInFolha(cpf: string | null, nome: string | null) {
    if (cpf) {
      const clean = cpf.replace(/\D/g, "");
      if (folhaMap.has(clean)) return folhaMap.get(clean);
    }
    if (nome) {
      return folhaByName.get(normalize(nome)) || null;
    }
    return null;
  }

  // Helper: find in fatura by CPF then name
  function findInFatura(cpf: string | null, nome: string | null) {
    if (cpf) {
      const clean = cpf.replace(/\D/g, "");
      if (faturaMap.has(clean)) return faturaMap.get(clean);
    }
    if (nome) {
      return faturaByName.get(normalize(nome)) || null;
    }
    return null;
  }

  // Determine if this is a dental check
  const isDental = tipoCobertura === "odontologico";
  const fonteLabel = isDental ? "Dental" : "Saúde";

  // CRITICO 1: Titular na fatura mas NÃO na folha
  for (const fr of fatura) {
    const fl = findInFolha(fr.cpf_beneficiario, fr.nome_beneficiario);
    if (!fl) {
      result.criticos.push({
        tipo: "critico",
        categoria: "fatura_sem_folha",
        nome: fr.nome_beneficiario,
        detalhe: `${fr.nome_beneficiario} está na fatura ${fonteLabel} ${mes.toString().padStart(2, "0")}/${ano} mas não aparece na folha do mês.`,
      });
    }
  }

  // CRITICO 2: Tem desconto na folha mas NÃO está na fatura
  for (const [, fl] of folhaMap) {
    const campoFolha = isDental
      ? (Number(fl.plano_odontologico) || 0)
      : (Number(fl.convenio_medico) || 0);
    if (campoFolha > 0) {
      const cpf = fl.emp?.numero_cpf;
      const nome = fl.emp?.nome_completo;
      const fr = findInFatura(cpf, nome);
      if (!fr) {
        result.criticos.push({
          tipo: "critico",
          categoria: "folha_sem_fatura",
          nome: fl.emp?.nome_completo || fl.contrato_empregado || "Desconhecido",
          detalhe: `${fl.emp?.nome_completo || "Colaborador"} tem desconto de ${isDental ? "odonto" : "plano"} na folha (R$ ${campoFolha.toFixed(2)}) mas não está na fatura ${fonteLabel}.`,
        });
      }
    }
  }

  // ATENCAO 3: Divergência parte colaborador (fatura vs folha)
  for (const fr of fatura) {
    const fl = findInFolha(fr.cpf_beneficiario, fr.nome_beneficiario);
    if (!fl) continue;

    const faturaColab = Number(fr.parte_colaborador) || 0;
    const folhaConvenio = isDental
      ? (Number(fl.plano_odontologico) || 0)
      : (Number(fl.convenio_medico) || 0);

    if (Math.abs(faturaColab - folhaConvenio) > 2) {
      result.atencao.push({
        tipo: "atencao",
        categoria: "divergencia_colaborador",
        nome: fr.nome_beneficiario,
        detalhe: `${fr.nome_beneficiario}: Fatura ${fonteLabel} cobra R$ ${faturaColab.toFixed(2)} do colaborador, folha desconta R$ ${folhaConvenio.toFixed(2)}.`,
        fatura: faturaColab,
        folha: folhaConvenio,
      });
    }

    // ATENCAO 4: Divergência coparticipação (only for medical)
    if (!isDental) {
      const faturaCopart = Number(fr.coparticipacao) || 0;
      if (faturaCopart > 0) {
        // coparticipação doesn't have a separate dental field in payroll
        const folhaCopart = Number(fl.plano_odontologico) || 0; // rubrica 1819
        if (Math.abs(faturaCopart - folhaCopart) > 5) {
          result.atencao.push({
            tipo: "atencao",
            categoria: "divergencia_coparticipacao",
            nome: fr.nome_beneficiario,
            detalhe: `${fr.nome_beneficiario}: Fatura copart R$ ${faturaCopart.toFixed(2)}, folha desconta R$ ${folhaCopart.toFixed(2)}.`,
            fatura: faturaCopart,
            folha: folhaCopart,
          });
        }
      }
    }
  }

  // INFORMATIVO: Novos dependentes e dependentes removidos
  const prevDepSet = new Set(
    prev.filter(r => r.parentesco !== "titular").map(r => normalize(r.nome_beneficiario))
  );
  const currDepSet = new Set(
    allFatura.filter(r => r.parentesco !== "titular").map(r => normalize(r.nome_beneficiario))
  );

  for (const r of allFatura) {
    if (r.parentesco === "titular") continue;
    const key = normalize(r.nome_beneficiario);
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
      const key = normalize(r.nome_beneficiario);
      if (!currDepSet.has(key)) {
        result.informativos.push({
          tipo: "informativo",
          categoria: "dependente_removido",
          nome: r.nome_beneficiario,
          detalhe: `Dependente ${r.nome_beneficiario} removido em ${mes.toString().padStart(2, "0")}/${ano}.`,
        });
      }
    }
  }

  // INFORMATIVO: Mudança de plano
  if (prev.length > 0) {
    const prevPlanMap = new Map<string, string>();
    for (const r of prev) {
      if (r.parentesco === "titular") {
        const key = r.cpf_beneficiario?.replace(/\D/g, "") || normalize(r.nome_beneficiario);
        prevPlanMap.set(key, r.codigo_plano || "");
      }
    }
    for (const r of fatura) {
      const key = r.cpf_beneficiario?.replace(/\D/g, "") || normalize(r.nome_beneficiario);
      const prevPlano = prevPlanMap.get(key);
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
