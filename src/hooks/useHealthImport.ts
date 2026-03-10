import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { UnimedParseResult, UnimedRecord } from "@/utils/parseUnimedXls";
import type { BradescoParseResult, BradescoRecord } from "@/utils/parseBradescoSaudePdf";

interface MatchedRecord {
  record: UnimedRecord | BradescoRecord;
  employee_id: string | null;
  employee_nome: string | null;
  matched: boolean;
}

export function useHealthImport() {
  const { companyId } = useCompany();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  async function matchEmployees(
    records: (UnimedRecord | BradescoRecord)[]
  ): Promise<MatchedRecord[]> {
    if (!companyId) return records.map((r) => ({ record: r, employee_id: null, employee_nome: null, matched: false }));

    const { data: employees } = await supabase
      .from("employees")
      .select("id, nome_completo, numero_cpf")
      .eq("company_id", companyId);

    const empList = employees ?? [];

    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

    return records.map((rec) => {
      const cpf = "cpf_beneficiario" in rec ? (rec as UnimedRecord).cpf_beneficiario : null;
      const nome = rec.nome_beneficiario;
      const parentesco = rec.parentesco;

      // Only try to match titulares
      if (parentesco !== "titular") {
        // Try to match by titular CPF/name
        const titCpf = "titular_cpf" in rec ? (rec as any).titular_cpf : null;
        const titNome = rec.titular_nome;
        let emp = null;
        if (titCpf) {
          emp = empList.find((e) => e.numero_cpf?.replace(/\D/g, "") === titCpf.replace(/\D/g, ""));
        }
        if (!emp && titNome) {
          const normTit = normalize(titNome);
          emp = empList.find((e) => normalize(e.nome_completo) === normTit);
        }
        return {
          record: rec,
          employee_id: emp?.id ?? null,
          employee_nome: emp?.nome_completo ?? null,
          matched: !!emp,
        };
      }

      // Match titular by CPF first, then name
      let emp = null;
      if (cpf) {
        emp = empList.find((e) => e.numero_cpf?.replace(/\D/g, "") === cpf.replace(/\D/g, ""));
      }
      if (!emp) {
        const normName = normalize(nome);
        emp = empList.find((e) => normalize(e.nome_completo) === normName);
      }

      return {
        record: rec,
        employee_id: emp?.id ?? null,
        employee_nome: emp?.nome_completo ?? null,
        matched: !!emp,
      };
    });
  }

  async function importUnimed(
    planId: string,
    result: UnimedParseResult,
    matched: MatchedRecord[]
  ) {
    setImporting(true);
    setProgress(0);

    const competenciaStr = result.competencia.toISOString().split("T")[0];
    const total = matched.length;

    for (let i = 0; i < matched.length; i++) {
      const m = matched[i];
      const r = m.record as UnimedRecord;

      await (supabase.from("health_records" as any) as any).upsert({
        health_plan_id: planId,
        company_id: companyId,
        employee_id: m.employee_id,
        competencia: competenciaStr,
        nome_beneficiario: r.nome_beneficiario,
        cpf_beneficiario: r.cpf_beneficiario,
        data_nascimento: r.data_nascimento,
        idade: r.idade,
        parentesco: r.parentesco,
        titular_nome: r.titular_nome,
        titular_cpf: r.titular_cpf,
        codigo_plano: r.codigo_plano,
        descricao_plano: r.descricao_plano,
        carteirinha: r.carteirinha,
        mensalidade: r.mensalidade,
        parte_empresa: r.parte_empresa,
        parte_colaborador: r.parte_colaborador,
        coparticipacao: r.coparticipacao,
        taxa_cartao: r.taxa_cartao,
        taxa_inscricao: r.taxa_inscricao,
        lancamento_manual: r.lancamento_manual,
        outros: r.outros,
        valor_total: r.valor_total,
        tipo_cobertura: "medico",
        fonte: "unimed",
      }, { onConflict: "health_plan_id,cpf_beneficiario,competencia,tipo_cobertura" });

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Upsert invoice summary
    await (supabase.from("health_invoices" as any) as any).upsert({
      health_plan_id: planId,
      company_id: companyId,
      competencia: competenciaStr,
      total_titulares: result.totalTitulares,
      total_dependentes: result.totalDependentes,
      total_vidas: result.totalTitulares + result.totalDependentes,
      valor_fatura: result.totalGeral,
      total_parte_empresa: result.totalEmpresa,
      total_parte_colaborador: result.totalColaborador,
      total_coparticipacao: result.totalCopart,
      fonte: "unimed",
    }, { onConflict: "health_plan_id,competencia" });

    setImporting(false);
    return { imported: matched.length, vidas: matched.length };
  }

  async function importBradesco(
    planId: string,
    result: BradescoParseResult,
    matched: MatchedRecord[]
  ) {
    setImporting(true);
    setProgress(0);

    const competenciaStr = result.competencia.toISOString().split("T")[0];
    const total = matched.length;

    for (let i = 0; i < matched.length; i++) {
      const m = matched[i];
      const r = m.record as BradescoRecord;

      await (supabase.from("health_records" as any) as any).upsert({
        health_plan_id: planId,
        company_id: companyId,
        employee_id: m.employee_id,
        competencia: competenciaStr,
        nome_beneficiario: r.nome_beneficiario,
        data_nascimento: r.data_nascimento,
        sexo: r.sexo,
        parentesco: r.parentesco,
        titular_nome: r.titular_nome,
        codigo_plano: r.codigo_plano,
        carteirinha: r.certificado,
        data_inicio: r.data_inicio,
        mensalidade: r.mensalidade,
        parte_empresa: r.mensalidade - r.parte_colaborador,
        parte_colaborador: r.parte_colaborador,
        valor_total: r.mensalidade,
        tipo_cobertura: r.tipo_cobertura,
        fonte: "bradesco",
      }, { onConflict: "health_plan_id,cpf_beneficiario,competencia,tipo_cobertura" });

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Upsert invoice summary
    await (supabase.from("health_invoices" as any) as any).upsert({
      health_plan_id: planId,
      company_id: companyId,
      competencia: competenciaStr,
      total_titulares: result.totalTitulares,
      total_dependentes: result.totalDependentes,
      total_vidas: result.totalVidas,
      valor_fatura: result.valorFatura,
      valor_iof: result.valorIof,
      valor_cobrado: result.valorCobrado,
      fonte: "bradesco",
    }, { onConflict: "health_plan_id,competencia" });

    setImporting(false);
    return { imported: matched.length, vidas: matched.length };
  }

  return { matchEmployees, importUnimed, importBradesco, importing, progress };
}
