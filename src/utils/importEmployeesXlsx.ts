import * as XLSX from "xlsx";

/** Normalized null-like values */
const NULL_VALUES = new Set(["n.a.", "n/a", "na", "n.a", ""]);

function cleanValue(val: any): string | null {
  if (val == null) return null;
  const str = String(val).trim();
  if (NULL_VALUES.has(str.toLowerCase())) return null;
  return str;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseDate(val: any): string | null {
  if (!val) return null;
  // XLSX serial number
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const str = cleanValue(val);
  if (!str) return null;
  // dd/mm/yyyy
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

function parseJornada(val: any): number | null {
  const str = cleanValue(val);
  if (!str) return null;
  const lower = str.toLowerCase();
  if (lower.includes("flexivel") || lower.includes("flexível")) return 44;
  const m = str.match(/^(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function mapStatus(val: string | null): string {
  if (!val) return "ativo";
  const lower = val.trim().toLowerCase();
  if (lower === "ativo") return "ativo";
  if (lower === "inativo") return "inativo";
  if (lower.includes("ferias") || lower.includes("férias")) return "ferias";
  if (lower.includes("afastado")) return "afastado";
  if (lower.includes("desligado")) return "desligado";
  return "ativo";
}

function mapGenero(val: string | null): string | null {
  if (!val) return null;
  const lower = val.trim().toLowerCase();
  if (lower === "feminino") return "feminino";
  if (lower === "masculino") return "masculino";
  if (lower === "outro") return "outro";
  return "nao_informado";
}

function mapTipoContrato(val: string | null): string {
  if (!val) return "clt";
  const lower = val.trim().toLowerCase();
  if (lower === "pj") return "pj";
  if (lower.includes("estagio") || lower.includes("estágio")) return "estagio";
  if (lower.includes("temporario") || lower.includes("temporário")) return "temporario";
  if (lower.includes("aprendiz")) return "aprendiz";
  return "clt";
}

/** Column header -> employee field mapping */
const COLUMN_MAP: Record<string, string> = {
  "matricula e-social": "numero_funcional",
  "matricula esocial": "numero_funcional",
  "matrícula e-social": "numero_funcional",
  "matricula interna": "matricula_interna",
  "matrícula interna": "matricula_interna",
  "colaborador": "nome_completo",
  "nome": "nome_completo",
  "nome completo": "nome_completo",
  "status": "status",
  "data de admissao": "data_admissao",
  "data de admissão": "data_admissao",
  "data admissao": "data_admissao",
  "empresa": "empresa",
  "departamento": "departamento",
  "cargo": "cargo",
  "data de nascimento": "data_nascimento",
  "data nascimento": "data_nascimento",
  "numero rg": "numero_rg",
  "número rg": "numero_rg",
  "rg": "numero_rg",
  "numero cpf": "numero_cpf",
  "número cpf": "numero_cpf",
  "cpf": "numero_cpf",
  "ctps": "ctps",
  "numero pis/nit": "numero_pis_nit",
  "número pis/nit": "numero_pis_nit",
  "pis": "numero_pis_nit",
  "pis/nit": "numero_pis_nit",
  "genero": "genero",
  "gênero": "genero",
  "telefone": "telefone",
  "telefone de emergencia": "telefone_emergencia",
  "telefone de emergência": "telefone_emergencia",
  "telefone emergencia": "telefone_emergencia",
  "nome do contato de emergencia": "nome_contato_emergencia",
  "nome do contato de emergência": "nome_contato_emergencia",
  "contato emergencia": "nome_contato_emergencia",
  "grau de parentesco": "grau_parentesco",
  "parentesco": "grau_parentesco",
  "tipo de contrato": "tipo_contrato",
  "tipo contrato": "tipo_contrato",
  "jornada semanal": "jornada_semanal",
  "jornada": "jornada_semanal",
  "e-mail para holerite": "email_holerite",
  "email holerite": "email_holerite",
  "email": "email_holerite",
  "e-mail": "email_holerite",
};

export interface ParsedEmployeeRow {
  /** Raw mapped fields */
  data: Record<string, any>;
  /** The row index from XLSX */
  rowIndex: number;
}

export interface MatchedRow {
  xlsxData: Record<string, any>;
  rowIndex: number;
  existingEmployee: any | null;
  action: "update" | "create" | "conflict" | "no_matricula";
  matchMethod: "funcional" | "name" | null;
}

export function parseEmployeesXlsx(file: ArrayBuffer): ParsedEmployeeRow[] {
  const wb = XLSX.read(file, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (raw.length === 0) return [];

  // Map headers
  const firstRow = raw[0];
  const headerMap: Record<string, string> = {};
  for (const key of Object.keys(firstRow)) {
    const normalized = key
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    const mapped = COLUMN_MAP[normalized];
    if (mapped) headerMap[key] = mapped;
  }

  return raw.map((row, i) => {
    const data: Record<string, any> = {};
    for (const [xlsxCol, field] of Object.entries(headerMap)) {
      const rawVal = row[xlsxCol];
      switch (field) {
        case "data_admissao":
        case "data_nascimento":
          data[field] = parseDate(rawVal);
          break;
        case "status":
          data[field] = mapStatus(cleanValue(rawVal));
          break;
        case "genero":
          data[field] = mapGenero(cleanValue(rawVal));
          break;
        case "tipo_contrato":
          data[field] = mapTipoContrato(cleanValue(rawVal));
          break;
        case "jornada_semanal":
          data[field] = parseJornada(rawVal);
          break;
        default:
          data[field] = cleanValue(rawVal);
      }
    }
    return { data, rowIndex: i };
  });
}

export function matchRows(
  parsed: ParsedEmployeeRow[],
  existingEmployees: any[]
): MatchedRow[] {
  // Build lookup maps
  const byFuncional = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const emp of existingEmployees) {
    if (emp.numero_funcional) {
      byFuncional.set(String(emp.numero_funcional).trim(), emp);
    }
    byName.set(normalizeName(emp.nome_completo), emp);
  }

  return parsed.map(({ data, rowIndex }) => {
    const funcional = data.numero_funcional ? String(data.numero_funcional).trim() : null;
    const xlsxName = data.nome_completo ? normalizeName(data.nome_completo) : "";

    let existing: any = null;
    let matchMethod: "funcional" | "name" | null = null;

    if (funcional) {
      existing = byFuncional.get(funcional) ?? null;
      if (existing) matchMethod = "funcional";
    }

    if (!existing && xlsxName) {
      existing = byName.get(xlsxName) ?? null;
      if (existing) matchMethod = "name";
    }

    let action: MatchedRow["action"];
    if (!funcional) {
      action = existing ? "update" : "no_matricula";
      if (existing) matchMethod = "name";
    } else if (!existing) {
      action = "create";
    } else {
      // Check name conflict
      const existingName = normalizeName(existing.nome_completo);
      if (matchMethod === "funcional" && xlsxName && existingName !== xlsxName) {
        action = "conflict";
      } else {
        action = "update";
      }
    }

    return { xlsxData: data, rowIndex, existingEmployee: existing, action, matchMethod };
  });
}

/** Fields that always overwrite even if existing has a value */
const ALWAYS_OVERWRITE_FIELDS = new Set(["status", "cargo"]);

export function buildUpdatePayload(
  xlsxData: Record<string, any>,
  existing: any,
  overwriteAll: boolean
): Record<string, any> {
  const updates: Record<string, any> = {};
  for (const [field, value] of Object.entries(xlsxData)) {
    if (value == null) continue;
    if (field === "nome_completo" || field === "numero_funcional") continue; // don't overwrite key fields
    if (overwriteAll || ALWAYS_OVERWRITE_FIELDS.has(field) || existing[field] == null || existing[field] === "") {
      updates[field] = value;
    }
  }
  return updates;
}

export function buildInsertPayload(
  xlsxData: Record<string, any>,
  companyId: string | null
): Record<string, any> {
  const payload: Record<string, any> = { ...xlsxData };
  if (companyId) payload.company_id = companyId;
  if (!payload.data_admissao) payload.data_admissao = new Date().toISOString().split("T")[0];
  if (!payload.status) payload.status = "ativo";
  if (!payload.tipo_contrato) payload.tipo_contrato = "clt";
  return payload;
}

export function isCadastroCompleto(emp: Record<string, any>): boolean {
  return !!(
    emp.nome_completo &&
    emp.numero_funcional &&
    emp.numero_cpf &&
    emp.data_nascimento &&
    emp.cargo &&
    emp.data_admissao
  );
}
