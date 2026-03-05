/**
 * Service: Import parsed TXT payroll data.
 * 1. Upserts employees by numero_funcional + company_id
 * 2. Creates payroll_monthly_records mapped from rubricas
 * 3. Enriches employees with Empregare candidate data (name matching)
 */

import { supabase } from "@/integrations/supabase/client";
import type { FuncionarioParsed, ParsedPayroll } from "./parseFolhaTxt";

export interface ImportResult {
  employees_created: number;
  employees_updated: number;
  payroll_records: number;
  enriched_from_empregare: number;
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

// ── Contract type mapping ──

function mapTipoContrato(situacao: string): string {
  const s = situacao.toLowerCase();
  if (s.includes("diretor")) return "clt";
  if (s.includes("estagi")) return "estagio";
  if (s.includes("tempor")) return "temporario";
  if (s.includes("aprend")) return "aprendiz";
  return "clt";
}

// ── Carga horária mensal → jornada semanal ──

function chmToJornadaSemanal(chm: number): number {
  if (chm <= 0) return 44;
  if (chm <= 150) return 30;
  if (chm <= 180) return 36;
  return 44;
}

// ── Cadastro completude check ──

function isCadastroCompleto(emp: Record<string, unknown>): boolean {
  return !!(
    emp.nome_completo &&
    emp.numero_funcional &&
    emp.numero_cpf &&
    emp.data_nascimento &&
    emp.cargo &&
    emp.data_admissao
  );
}

// ── Normalize name for matching ──

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
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

// ── Build employee fields from parsed TXT ──

function buildEmployeeFields(func: FuncionarioParsed, companyId: string, empresaNome: string | null): Record<string, unknown> {
  const status = mapSituacaoToStatus(func.situacao);
  return {
    nome_completo: func.nome,
    numero_funcional: String(func.numero),
    company_id: companyId,
    data_admissao: func.data_admissao ?? new Date().toISOString().slice(0, 10),
    data_demissao: func.data_demissao || null,
    cargo: func.cargo || null,
    status,
    numero_cpf: null,
    empresa: empresaNome || null,
    salario_base: func.salario_base || null,
    cbo: func.cbo || null,
    jornada_semanal: chmToJornadaSemanal(func.carga_horaria),
    departamento: func.organograma || null,
    tipo_contrato: mapTipoContrato(func.situacao),
    dependentes_ir: func.dependentes_ir,
    dependentes_sf: func.dependentes_sf,
    sindicato_codigo: func.sindicato_codigo || null,
    cadastro_completo: false,
  };
}

// ── Empregare enrichment ──

async function enrichWithEmpregare(
  newEmployees: Array<{ id: string; nome: string; cargo: string | null }>,
  companyId: string,
): Promise<{ enriched: number; errors: string[] }> {
  const result = { enriched: 0, errors: [] as string[] };
  if (newEmployees.length === 0) return result;

  // Fetch unlinked hired candidates
  const { data: candidatos, error: fetchErr } = await supabase
    .from("empregare_candidatos")
    .select("*")
    .eq("status", "contratado")
    .eq("company_id", companyId);

  if (fetchErr || !candidatos || candidatos.length === 0) return result;

  // Build normalized name map for candidates
  const candidatoMap = new Map<string, typeof candidatos[0]>();
  for (const c of candidatos) {
    if (c.nome) {
      candidatoMap.set(normalizeName(c.nome), c);
    }
  }

  for (const emp of newEmployees) {
    const normalizedEmpName = normalizeName(emp.nome);
    const match = candidatoMap.get(normalizedEmpName);

    if (!match) continue;

    // Enrich employee with Empregare data
    const updates: Record<string, unknown> = {
      empregare_pessoa_id: match.empregare_pessoa_id,
    };

    if (match.email) updates.email_holerite = match.email;
    if (match.telefone) updates.telefone = match.telefone;

    // Compute cadastro_completo
    const empData = {
      nome_completo: emp.nome,
      numero_funcional: true,
      numero_cpf: null, // Empregare doesn't provide CPF
      data_nascimento: null,
      cargo: emp.cargo,
      data_admissao: true,
    };
    updates.cadastro_completo = isCadastroCompleto(empData);

    const { error: updErr } = await supabase
      .from("employees")
      .update(updates as any)
      .eq("id", emp.id);

    if (updErr) {
      result.errors.push(`Erro ao enriquecer ${emp.nome}: ${updErr.message}`);
    } else {
      result.enriched++;
      // Remove from map to avoid double-matching
      candidatoMap.delete(normalizedEmpName);
    }
  }

  return result;
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
    enriched_from_empregare: 0,
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
  const newlyCreatedEmployees: Array<{ id: string; nome: string; cargo: string | null }> = [];

  for (const func of parsed.funcionarios) {
    const numFunc = String(func.numero);
    const existing = empByNumFunc.get(numFunc);

    let employeeId: string;

    if (existing) {
      // Update all extractable fields
      employeeId = existing.id;
      const newStatus = mapSituacaoToStatus(func.situacao);
      const updates: Record<string, unknown> = {
        status: newStatus,
        salario_base: func.salario_base || undefined,
        cbo: func.cbo || undefined,
        jornada_semanal: chmToJornadaSemanal(func.carga_horaria),
        dependentes_ir: func.dependentes_ir,
        dependentes_sf: func.dependentes_sf,
        sindicato_codigo: func.sindicato_codigo || undefined,
        tipo_contrato: mapTipoContrato(func.situacao),
      };

      if (func.cargo && func.cargo !== existing.cargo) {
        updates.cargo = func.cargo;
      }
      if (func.data_demissao) {
        updates.data_demissao = func.data_demissao;
      }
      if (func.organograma) {
        updates.departamento = func.organograma;
      }

      // Remove undefined values
      for (const key of Object.keys(updates)) {
        if (updates[key] === undefined) delete updates[key];
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
      // Create new employee with all available fields
      const newEmployee = buildEmployeeFields(func, companyId, parsed.empresa.nome);

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
      newlyCreatedEmployees.push({ id: employeeId, nome: func.nome, cargo: func.cargo });
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

  // 5. Enrich new employees with Empregare data
  if (newlyCreatedEmployees.length > 0) {
    const enrichResult = await enrichWithEmpregare(newlyCreatedEmployees, companyId);
    result.enriched_from_empregare = enrichResult.enriched;
    result.errors.push(...enrichResult.errors);
  }

  return result;
}
