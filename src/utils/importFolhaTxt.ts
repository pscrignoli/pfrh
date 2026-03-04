/**
 * Service: Import parsed TXT payroll data.
 * 1. Upserts employees by numero_funcional + company_id
 * 2. Creates payroll_monthly_records mapped from rubricas
 */

import { supabase } from "@/integrations/supabase/client";
import type { FuncionarioParsed, ParsedPayroll } from "./parseFolhaTxt";

export interface ImportResult {
  employees_created: number;
  employees_updated: number;
  payroll_records: number;
  errors: string[];
}

// ── Status mapping ──

function mapSituacaoToStatus(situacao: string): string {
  const s = situacao.toLowerCase();
  if (s.includes("demitid")) return "desligado";
  if (s.includes("afastad")) return "afastado";
  if (s.includes("feria")) return "ferias";
  if (s.includes("inativ")) return "inativo";
  return "ativo";
}

// ── Rubrica helpers ──

function rubricaVal(func: FuncionarioParsed, ...codes: number[]): number {
  let total = 0;
  for (const r of func.rubricas) {
    if (codes.includes(r.codigo)) total += r.valor;
  }
  return total;
}

// ── Build payroll record fields from parsed employee ──

function buildPayrollFields(func: FuncionarioParsed): Record<string, unknown> {
  return {
    salario_base: func.salario_base,
    salario: func.totais.proventos,
    cargo: func.cargo,
    admissao: func.data_admissao,
    desligamento: func.data_demissao,
    area: func.organograma,

    // Horas extras
    hora_50: rubricaVal(func, 35),
    hora_60: rubricaVal(func, 36),
    hora_80: rubricaVal(func, 37),
    hora_100: rubricaVal(func, 38),
    he_total: rubricaVal(func, 35, 36, 37, 38),
    dsr_horas: rubricaVal(func, 59),
    adicional_noturno: rubricaVal(func, 40),

    // 13o e férias
    decimo_terceiro: rubricaVal(func, 510, 511, 512),
    ferias: rubricaVal(func, 658, 659, 660),
    terco_ferias: rubricaVal(func, 678, 679),

    // Encargos (from bases)
    inss_20: func.bases.inss_empresa.normal,
    inss_13: func.bases.inss.decimo_terceiro,
    inss_ferias: func.bases.inss.ferias,
    fgts_8: func.bases.fgts_gfip.valor + func.bases.fgts_grrf.valor,
    encargos: func.bases.inss_empresa.normal + func.bases.fgts_gfip.valor + func.bases.fgts_grrf.valor,

    // Descontos
    desconto_vale_transporte: rubricaVal(func, 1816),
    vale_transporte: rubricaVal(func, 1816),
    falta: rubricaVal(func, 1826, 1827, 1828),
    insalubridade: rubricaVal(func, 50),

    // Benefícios
    convenio_medico: func.plano_saude.total,

    // Totais
    total_folha: func.totais.proventos,
    total_geral: func.totais.liquido,
    soma: func.totais.proventos - func.totais.descontos,
    beneficios: func.plano_saude.total,

    // Identificação
    relacao_funcionarios: String(func.numero),
    contrato_empregado: String(func.numero),
  };
}

// ── Main import function ──

export async function importFolhaTxt(
  parsed: ParsedPayroll,
  companyId: string,
  ano: number,
  mes: number,
): Promise<ImportResult> {
  const result: ImportResult = {
    employees_created: 0,
    employees_updated: 0,
    payroll_records: 0,
    errors: [],
  };

  // 1. Fetch existing employees by numero_funcional for this company
  const { data: existingEmployees, error: fetchErr } = await supabase
    .from("employees")
    .select("id, numero_funcional, nome_completo, cargo")
    .eq("company_id", companyId)
    .not("numero_funcional", "is", null);

  if (fetchErr) {
    result.errors.push(`Erro ao buscar colaboradores: ${fetchErr.message}`);
    return result;
  }

  const empByNumFunc = new Map<string, { id: string; nome: string; cargo: string | null }>();
  for (const e of existingEmployees ?? []) {
    if (e.numero_funcional) {
      empByNumFunc.set(e.numero_funcional, { id: e.id, nome: e.nome_completo, cargo: e.cargo });
    }
  }

  // 2. Process each funcionario
  const payrollRecords: Record<string, unknown>[] = [];

  for (const func of parsed.funcionarios) {
    const numFunc = String(func.numero);
    const existing = empByNumFunc.get(numFunc);

    let employeeId: string;

    if (existing) {
      // Update salary/status if changed
      employeeId = existing.id;
      const newStatus = mapSituacaoToStatus(func.situacao);
      const updates: Record<string, unknown> = {};

      if (func.cargo && func.cargo !== existing.cargo) {
        updates.cargo = func.cargo;
      }
      // Always could update status
      updates.status = newStatus;
      if (func.data_demissao) {
        updates.data_demissao = func.data_demissao;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabase
          .from("employees")
          .update(updates as any)
          .eq("id", employeeId);

        if (updErr) {
          result.errors.push(`Erro ao atualizar ${func.nome}: ${updErr.message}`);
        } else {
          result.employees_updated++;
        }
      }
    } else {
      // Create new employee
      const newEmployee = {
        nome_completo: func.nome,
        numero_funcional: numFunc,
        company_id: companyId,
        data_admissao: func.data_admissao ?? new Date().toISOString().slice(0, 10),
        cargo: func.cargo || null,
        status: mapSituacaoToStatus(func.situacao),
        numero_cpf: null,
        empresa: parsed.empresa.nome || null,
      };

      const { data: created, error: createErr } = await supabase
        .from("employees")
        .insert(newEmployee as any)
        .select("id")
        .single();

      if (createErr) {
        result.errors.push(`Erro ao criar ${func.nome}: ${createErr.message}`);
        continue;
      }

      employeeId = created.id;
      empByNumFunc.set(numFunc, { id: employeeId, nome: func.nome, cargo: func.cargo });
      result.employees_created++;
    }

    // 3. Build payroll record
    const fields = buildPayrollFields(func);
    payrollRecords.push({
      ...fields,
      employee_id: employeeId,
      ano,
      mes,
      company_id: companyId,
      status: "importado",
    });
  }

  // 4. Upsert payroll records in batches
  const batchSize = 50;
  for (let i = 0; i < payrollRecords.length; i += batchSize) {
    const batch = payrollRecords.slice(i, i + batchSize);
    const { error: upsertErr } = await supabase
      .from("payroll_monthly_records")
      .upsert(batch as any, { onConflict: "employee_id,ano,mes" });

    if (upsertErr) {
      result.errors.push(`Erro ao importar lote ${Math.floor(i / batchSize) + 1}: ${upsertErr.message}`);
    } else {
      result.payroll_records += batch.length;
    }
  }

  return result;
}
