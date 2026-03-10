/**
 * Parser for Bradesco Saude PDF invoices.
 * Uses pdf.js via CDN to extract text, then regex-parses the beneficiary table.
 */

export interface BradescoRecord {
  certificado: string;
  nome_beneficiario: string;
  data_nascimento: string | null;
  sexo: string;
  parentesco: string; // 'titular' | 'conjuge' | 'filho' | 'filha'
  codigo_plano: string;
  data_inicio: string | null;
  mensalidade: number;
  parte_colaborador: number; // Part.Seg
  tipo_cobertura: "medico" | "odontologico";
  titular_nome: string | null;
  titular_cpf: string | null;
}

export interface BradescoParseResult {
  competencia: Date;
  records: BradescoRecord[];
  totalTitulares: number;
  totalDependentes: number;
  totalVidas: number;
  valorFatura: number;
  valorIof: number;
  valorCobrado: number;
}

// Dynamically load pdf.js from CDN
async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(lib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function parseDateBR(val: string): string | null {
  const m = val.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseMoneyBR(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

export async function parseBradescoSaudePdf(data: ArrayBuffer): Promise<BradescoParseResult> {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;

    for (const item of content.items as any[]) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 3) {
        lines.push("\n");
      }
      lines.push(item.str);
      lastY = item.transform[5];
    }
    fullText += lines.join("") + "\n---PAGE---\n";
  }

  // Extract competencia: "Fatura M/A nr" or "01/2026"
  let competencia = new Date();
  const compMatch = fullText.match(/(\d{2})\/(\d{4})\s+\d{2}/);
  if (compMatch) {
    competencia = new Date(parseInt(compMatch[2]), parseInt(compMatch[1]) - 1, 1);
  } else {
    const altMatch = fullText.match(/Vigência[:\s]*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (altMatch) {
      competencia = new Date(parseInt(altMatch[3]), parseInt(altMatch[2]) - 1, 1);
    }
  }

  // Extract summary numbers
  let totalTitulares = 0;
  let totalDependentes = 0;
  let totalVidas = 0;
  let valorFatura = 0;
  let valorIof = 0;
  let valorCobrado = 0;

  const titMatch = fullText.match(/(\d+)\s*Titular/i);
  if (titMatch) totalTitulares = parseInt(titMatch[1]);

  const depMatch = fullText.match(/(\d+)\s*Dependent/i);
  if (depMatch) totalDependentes = parseInt(depMatch[1]);

  const segMatch = fullText.match(/(\d+)\s*Segurad/i);
  if (segMatch) totalVidas = parseInt(segMatch[1]);
  if (!totalVidas) totalVidas = totalTitulares + totalDependentes;

  // Extract IOF
  const iofMatch = fullText.match(/IOF[:\s]*R?\$?\s*([\d.,]+)/i);
  if (iofMatch) valorIof = parseMoneyBR(iofMatch[1]);

  // Extract total value
  const totalMatch = fullText.match(/Total\s*(?:a\s*pagar|cobrado|da\s*fatura)[:\s]*R?\$?\s*([\d.,]+)/i);
  if (totalMatch) valorCobrado = parseMoneyBR(totalMatch[1]);

  // Parse beneficiary lines
  // Format: CERTIF NOME DATANASC SEXO ESTCIVIL PARENT PLANO DATAINICIO COMPETENCIA VALOR PARTSEG
  const records: BradescoRecord[] = [];
  const lines = fullText.split("\n");

  // Track current section: medico or dental
  let currentCoverage: "medico" | "odontologico" = "medico";
  const titularMap = new Map<string, string>(); // certif base -> name

  for (const line of lines) {
    // Detect dental section
    if (line.match(/dent|odont/i) && line.match(/subfatura|cobertura/i)) {
      currentCoverage = "odontologico";
    }

    // Try to parse beneficiary line
    // Certificado pattern: 0000035/00
    const certMatch = line.match(/(\d{5,7}\/\d{2})/);
    if (!certMatch) continue;

    const certif = certMatch[1];
    const certBase = certif.split("/")[0];
    const certSuffix = certif.split("/")[1];

    // Extract remaining fields after certificado
    const afterCert = line.substring(line.indexOf(certif) + certif.length).trim();

    // Try to extract name (sequence of words before a date)
    const nameMatch = afterCert.match(/^(.+?)(\d{2}\/\d{2}\/\d{4})/);
    if (!nameMatch) continue;

    const nome = nameMatch[1].trim();
    const dataNasc = parseDateBR(nameMatch[2]);

    // Extract sex
    const sexMatch = afterCert.match(/\b(MAS|FEM)\b/i);
    const sexo = sexMatch ? (sexMatch[1].toUpperCase() === "MAS" ? "M" : "F") : "";

    // Extract parentesco from cert suffix
    let parentesco = "titular";
    if (certSuffix !== "00") {
      const parentMatch = afterCert.match(/\b(CONJ|FILH|COMP)\w*/i);
      if (parentMatch) {
        const p = parentMatch[1].toUpperCase();
        if (p === "CONJ" || p === "COMP") parentesco = "conjuge";
        else parentesco = "filho";
      } else {
        parentesco = "dependente";
      }
    }

    if (parentesco === "titular") {
      titularMap.set(certBase, nome);
    }

    // Extract plano code
    const planoMatch = afterCert.match(/\b([A-Z]{2,4}\d[A-Z0-9]*)\b/);
    const codigoPlano = planoMatch ? planoMatch[1] : "";

    // Extract second date (data_inicio)
    const dates = afterCert.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    const dataInicio = dates.length >= 2 ? parseDateBR(dates[1]) : null;

    // Extract money values (last 2 number groups)
    const moneyValues = afterCert.match(/[\d.,]+/g)?.map(parseMoneyBR).filter((v) => v > 0) || [];
    const valor = moneyValues.length > 0 ? moneyValues[moneyValues.length - 2] || moneyValues[moneyValues.length - 1] || 0 : 0;
    const partSeg = moneyValues.length > 1 ? moneyValues[moneyValues.length - 1] : 0;

    records.push({
      certificado: certif,
      nome_beneficiario: nome,
      data_nascimento: dataNasc,
      sexo,
      parentesco,
      codigo_plano: codigoPlano,
      data_inicio: dataInicio,
      mensalidade: valor,
      parte_colaborador: partSeg === valor ? 0 : partSeg, // if same as valor, it's not partseg
      tipo_cobertura: currentCoverage,
      titular_nome: parentesco !== "titular" ? (titularMap.get(certBase) ?? null) : null,
      titular_cpf: null, // Bradesco PDF doesn't show CPF
    });
  }

  valorFatura = records.reduce((s, r) => s + r.mensalidade, 0);
  if (!valorCobrado) valorCobrado = valorFatura + valorIof;

  return {
    competencia,
    records,
    totalTitulares: totalTitulares || records.filter((r) => r.parentesco === "titular").length,
    totalDependentes: totalDependentes || records.filter((r) => r.parentesco !== "titular").length,
    totalVidas: totalVidas || records.length,
    valorFatura,
    valorIof,
    valorCobrado,
  };
}
