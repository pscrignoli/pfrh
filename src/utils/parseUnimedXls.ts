import * as XLSX from "xlsx";

export interface UnimedRecord {
  nome_beneficiario: string;
  carteirinha: string;
  cpf_titular: string;
  cpf_beneficiario: string;
  data_nascimento: string | null;
  idade: number | null;
  codigo_plano: string;
  descricao_plano: string;
  parentesco: string; // 'titular' | 'conjuge' | 'filho' | 'filha' | 'dependente'
  titular_nome: string | null;
  titular_cpf: string | null;
  mensalidade: number;
  parte_empresa: number;
  parte_colaborador: number;
  coparticipacao: number;
  taxa_cartao: number;
  taxa_inscricao: number;
  lancamento_manual: number;
  outros: number;
  valor_total: number;
}

export interface UnimedParseResult {
  competencia: Date; // first day of month
  apolice: string | null;
  records: UnimedRecord[];
  totalMensalidade: number;
  totalEmpresa: number;
  totalColaborador: number;
  totalCopart: number;
  totalGeral: number;
  totalTitulares: number;
  totalDependentes: number;
}

function parseNum(val: any): number {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  const s = String(val).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function cleanCpf(val: any): string {
  if (!val) return "";
  return String(val).replace(/\D/g, "").padStart(11, "0");
}

function parseDateBR(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Excel serial date
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}

export function parseUnimedXls(data: ArrayBuffer): UnimedParseResult {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // 1. Detect competencia from line 2 (index 1): "Mensalidade: MM/AAAA"
  let competencia = new Date();
  let apolice: string | null = null;

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const line = rows[i]?.join(" ") ?? "";
    const compMatch = line.match(/Mensalidade[:\s]*(\d{2})\/(\d{4})/i);
    if (compMatch) {
      competencia = new Date(parseInt(compMatch[2]), parseInt(compMatch[1]) - 1, 1);
    }
    const apolMatch = line.match(/^(\d{3,6})\s*-\s*\d/);
    if (apolMatch) {
      apolice = apolMatch[1];
    }
  }

  // 2. Find header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const joined = rows[i]?.map((c: any) => String(c).toLowerCase()).join("|") ?? "";
    if (joined.includes("nome") && joined.includes("cpf") && joined.includes("mensalidade")) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error("Cabeçalho não encontrado no arquivo XLS. Verifique o formato.");
  }

  // Map column indices
  const headers = rows[headerIdx].map((h: any) => String(h).toLowerCase().trim());
  const col = (keywords: string[]): number => {
    return headers.findIndex((h: string) =>
      keywords.some((k) => h.includes(k))
    );
  };

  const iNome = col(["nome"]);
  const iCarteirinha = col(["carteirinha"]);
  const iCpfTitular = col(["cpf titular"]);
  const iCpf = headers.findIndex((h: string, idx: number) =>
    h.includes("cpf") && idx !== iCpfTitular
  );
  const iNasc = col(["nascimento"]);
  const iIdade = col(["idade"]);
  const iPlano = col(["plano"]);
  const iDescPlano = col(["descri"]);
  const iMens = col(["mensalidade"]);
  const iEmpresa = col(["empresa"]);
  const iColab = col(["colaborador"]);
  const iCopart = headers.findIndex((h: string) => h === "copart" || h.includes("copart por"));
  const iCopartTotal = headers.lastIndexOf(headers.find((h: string) => h.includes("copart")) ?? "");
  const iTxCartao = col(["tx cart", "cartao", "cartão"]);
  const iTxInsc = col(["tx insc", "inscri"]);
  const iLancManual = col(["lanc", "manual"]);
  const iOutros = col(["outros"]);

  const records: UnimedRecord[] = [];
  let currentTitular: { nome: string; cpf: string } | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;

    const nome = String(row[iNome] ?? "").trim();
    if (!nome) continue;

    const mensalidade = parseNum(row[iMens]);
    // Skip separator rows (all zeros)
    if (mensalidade === 0 && parseNum(row[iEmpresa]) === 0 && !nome.match(/[a-zA-Z]/)) continue;

    const cpfTitular = cleanCpf(row[iCpfTitular]);
    const cpf = cleanCpf(row[iCpf >= 0 ? iCpf : iCpfTitular]);

    const isTitular = !cpfTitular || !cpf || cpfTitular === cpf;

    if (isTitular) {
      currentTitular = { nome, cpf: cpf || cpfTitular };
    }

    const rec: UnimedRecord = {
      nome_beneficiario: nome,
      carteirinha: String(row[iCarteirinha] ?? "").trim(),
      cpf_titular: isTitular ? (cpf || cpfTitular) : (cpfTitular || currentTitular?.cpf || ""),
      cpf_beneficiario: cpf || cpfTitular,
      data_nascimento: parseDateBR(row[iNasc]),
      idade: iIdade >= 0 ? parseNum(row[iIdade]) || null : null,
      codigo_plano: iPlano >= 0 ? String(row[iPlano] ?? "").trim() : "",
      descricao_plano: iDescPlano >= 0 ? String(row[iDescPlano] ?? "").trim() : "",
      parentesco: isTitular ? "titular" : "dependente",
      titular_nome: isTitular ? null : (currentTitular?.nome ?? null),
      titular_cpf: isTitular ? null : (currentTitular?.cpf ?? null),
      mensalidade,
      parte_empresa: parseNum(row[iEmpresa]),
      parte_colaborador: parseNum(row[iColab]),
      coparticipacao: iCopart >= 0 ? parseNum(row[iCopart]) : 0,
      taxa_cartao: iTxCartao >= 0 ? parseNum(row[iTxCartao]) : 0,
      taxa_inscricao: iTxInsc >= 0 ? parseNum(row[iTxInsc]) : 0,
      lancamento_manual: iLancManual >= 0 ? parseNum(row[iLancManual]) : 0,
      outros: iOutros >= 0 ? parseNum(row[iOutros]) : 0,
      valor_total: 0,
    };

    rec.valor_total = rec.mensalidade + rec.coparticipacao + rec.taxa_cartao +
      rec.taxa_inscricao + rec.lancamento_manual + rec.outros;

    records.push(rec);
  }

  const titulares = records.filter((r) => r.parentesco === "titular");
  const dependentes = records.filter((r) => r.parentesco !== "titular");

  return {
    competencia,
    apolice,
    records,
    totalMensalidade: records.reduce((s, r) => s + r.mensalidade, 0),
    totalEmpresa: records.reduce((s, r) => s + r.parte_empresa, 0),
    totalColaborador: records.reduce((s, r) => s + r.parte_colaborador, 0),
    totalCopart: records.reduce((s, r) => s + r.coparticipacao, 0),
    totalGeral: records.reduce((s, r) => s + r.valor_total, 0),
    totalTitulares: titulares.length,
    totalDependentes: dependentes.length,
  };
}
