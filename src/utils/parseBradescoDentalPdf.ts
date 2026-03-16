/**
 * Parser for Bradesco Dental / Odontoprev PDF invoices.
 * Handles lançamentos retroativos, cancelamentos, inclusões.
 */

export interface BradescoDentalLancamento {
  tipo: string; // IR, IM, CM, CR, or '' for normal
  competencia: string;
  valor: number; // negative for estornos
}

export interface BradescoDentalRecord {
  certificado: string;
  nome_beneficiario: string;
  data_nascimento: string | null;
  sexo: string;
  parentesco: string; // 'titular' | 'conjuge' | 'filho' | 'outro'
  codigo_plano: string; // e.g. 'TNDP'
  data_inicio: string | null;
  valor_bruto: number;
  valor_estorno: number;
  valor_liquido: number;
  parte_colaborador: number;
  tipo_cobertura: "odontologico";
  lancamentos: BradescoDentalLancamento[];
  titular_nome: string | null;
}

export interface BradescoDentalResumo {
  vidasRemanescentes: number;
  inclusoesNoMes: number;
  inclusoesRetroativas: number;
  cancelamentosNoMes: number;
  cancelamentosRetroativos: number;
}

export interface BradescoDentalParseResult {
  competencia: Date;
  records: BradescoDentalRecord[];
  totalTitulares: number;
  totalDependentes: number;
  totalVidas: number;
  valorBruto: number;
  valorEstorno: number;
  valorLiquido: number;
  resumo: BradescoDentalResumo;
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
  const isNeg = val.includes("-");
  const clean = val.replace(/[.\-]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  if (isNaN(n)) return 0;
  return isNeg ? -n : n;
}

export async function parseBradescoDentalPdf(data: ArrayBuffer): Promise<BradescoDentalParseResult> {
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

  // Extract competência
  let competencia = new Date();
  const compMatch = fullText.match(/(\d{2})\/(\d{4})\s+\d{2}/);
  if (compMatch) {
    competencia = new Date(parseInt(compMatch[2]), parseInt(compMatch[1]) - 1, 1);
  }

  // Extract summary from "TOTAIS DA SUBFATURA" or similar lines
  const resumo: BradescoDentalResumo = {
    vidasRemanescentes: 0,
    inclusoesNoMes: 0,
    inclusoesRetroativas: 0,
    cancelamentosNoMes: 0,
    cancelamentosRetroativos: 0,
  };

  let valorBrutoResumo = 0;
  let valorEstornoResumo = 0;
  let valorLiquidoResumo = 0;
  let totalTitularesResumo = 0;
  let totalDependentesResumo = 0;
  let totalVidasResumo = 0;

  // Parse summary table lines
  const lines = fullText.split("\n");
  for (const line of lines) {
    const normalized = line.toLowerCase().trim();

    // VIDAS REMAN
    if (normalized.includes("reman")) {
      const nums = line.match(/(\d+)\s+(\d+)\s+(\d+)\s+([\d.,]+)/);
      if (nums) resumo.vidasRemanescentes = parseInt(nums[3]);
    }
    // INCLUSOES NO MES
    if (normalized.includes("inclus") && normalized.includes("mes") && !normalized.includes("retro")) {
      const nums = line.match(/(\d+)\s+(\d+)\s+(\d+)/);
      if (nums) resumo.inclusoesNoMes = parseInt(nums[3]);
    }
    // INCLUSOES RETROATIVAS
    if (normalized.includes("inclus") && normalized.includes("retro")) {
      const nums = line.match(/(\d+)\s+(\d+)\s+(\d+)/);
      if (nums) resumo.inclusoesRetroativas = parseInt(nums[3]);
    }
    // TOTAIS A COBRAR
    if (normalized.includes("totais") && normalized.includes("cobrar")) {
      const nums = line.match(/(\d+)\s+(\d+)\s+(\d+)\s+([\d.,]+)/);
      if (nums) {
        valorBrutoResumo = parseMoneyBR(nums[4]);
      }
    }
    // CANCELAMENTOS NO MES
    if (normalized.includes("cancel") && normalized.includes("mes") && !normalized.includes("retro")) {
      const nums = line.match(/(\d+)\s+(\d+)\s+(\d+)/);
      if (nums) resumo.cancelamentosNoMes = parseInt(nums[3]);
    }
    // CANCELAMENTOS RETROATIVOS
    if (normalized.includes("cancel") && normalized.includes("retro")) {
      const nums = line.match(/(\d+)\s+(\d+)\s+(\d+)/);
      if (nums) resumo.cancelamentosRetroativos = parseInt(nums[3]);
    }
    // TOTAIS A DEVOLVER
    if (normalized.includes("totais") && normalized.includes("devolver")) {
      const nums = line.match(/([\d.,]+)\s*$/);
      if (nums) valorEstornoResumo = parseMoneyBR(nums[1]);
    }
    // TOTAIS DA SUBFATURA
    if (normalized.includes("totais") && normalized.includes("subfatura")) {
      const nums = line.match(/(\d+)\s+(\d+)\s+(\d+)\s+([\d.,]+)/);
      if (nums) {
        totalTitularesResumo = parseInt(nums[1]);
        totalDependentesResumo = parseInt(nums[2]);
        totalVidasResumo = parseInt(nums[3]);
        valorLiquidoResumo = parseMoneyBR(nums[4]);
      }
    }
  }

  // Parse beneficiary lines
  const records: BradescoDentalRecord[] = [];
  const titularMap = new Map<string, string>(); // certBase -> name

  // Track current record for multi-line lancamentos
  let currentRecord: BradescoDentalRecord | null = null;
  let currentCertBase = "";

  for (const line of lines) {
    // Try to parse beneficiary line: certificado pattern 0000035/00
    const certMatch = line.match(/(\d{5,7})\/(\d{2})/);
    if (certMatch) {
      const certFull = certMatch[0];
      const certBase = certMatch[1];
      const certSuffix = certMatch[2];

      const afterCert = line.substring(line.indexOf(certFull) + certFull.length).trim();

      // Try to extract name (sequence of text before a date)
      const nameMatch = afterCert.match(/^(.+?)(\d{2}\/\d{2}\/\d{4})/);
      if (!nameMatch) {
        // Could be a lancamento line for the current record
        if (currentRecord) {
          const lancMatch = afterCert.match(/(IR|IM|CM|CR)\s+(\d{2}\/\d{4})\s+([\d.,]+-?)\s+([\d.,]+-?)/);
          if (lancMatch) {
            const valor = parseMoneyBR(lancMatch[3]);
            currentRecord.lancamentos.push({
              tipo: lancMatch[1],
              competencia: lancMatch[2],
              valor: (lancMatch[1] === "CM" || lancMatch[1] === "CR") ? -Math.abs(valor) : valor,
            });
            if (lancMatch[1] === "CM" || lancMatch[1] === "CR") {
              currentRecord.valor_estorno += Math.abs(valor);
            } else {
              currentRecord.valor_bruto += valor;
            }
            currentRecord.valor_liquido = currentRecord.valor_bruto - currentRecord.valor_estorno;
          }
        }
        continue;
      }

      // Flush previous record
      if (currentRecord) {
        records.push(currentRecord);
      }

      const nome = nameMatch[1].trim();
      const dataNasc = parseDateBR(nameMatch[2]);

      // Extract sex
      const sexMatch = afterCert.match(/\b(MAS|FEM)\b/i);
      const sexo = sexMatch ? (sexMatch[1].toUpperCase() === "MAS" ? "M" : "F") : "";

      // Determine parentesco from suffix
      let parentesco = "titular";
      if (certSuffix !== "00") {
        const parentMatch = afterCert.match(/\b(CONJ|FILH|COMP|OUTR)\w*/i);
        if (parentMatch) {
          const p = parentMatch[1].toUpperCase();
          if (p === "CONJ" || p === "COMP") parentesco = "conjuge";
          else if (p === "FILH") parentesco = "filho";
          else parentesco = "outro";
        } else {
          parentesco = "dependente";
        }
      }

      if (parentesco === "titular") {
        titularMap.set(certBase, nome);
      }

      // Extract plano code - for dental invoices it's always TNDP/TNDE/TNDM
      const planoMatch = afterCert.match(/\b(TNDP|TNDE|TNDM)\b/);
      const codigoPlano = planoMatch ? planoMatch[1] : "TNDP";

      // Extract dates
      const dates = afterCert.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
      const dataInicio = dates.length >= 2 ? parseDateBR(dates[1]) : null;

      // Extract money values - last two numeric groups
      const moneyParts = afterCert.match(/[\d.,]+-?/g) || [];
      const moneyValues = moneyParts.map(parseMoneyBR).filter(v => v !== 0 || moneyParts.some(p => p.includes(",")));

      // Typically the second-to-last is valor, last is parte_colaborador
      const valor = moneyValues.length >= 2
        ? Math.abs(moneyValues[moneyValues.length - 2])
        : moneyValues.length === 1 ? Math.abs(moneyValues[0]) : 0;
      const partBenef = moneyValues.length >= 2
        ? Math.abs(moneyValues[moneyValues.length - 1])
        : 0;

      currentCertBase = certBase;
      currentRecord = {
        certificado: certFull,
        nome_beneficiario: nome,
        data_nascimento: dataNasc,
        sexo,
        parentesco,
        codigo_plano: codigoPlano,
        data_inicio: dataInicio,
        valor_bruto: valor,
        valor_estorno: 0,
        valor_liquido: valor,
        parte_colaborador: partBenef,
        tipo_cobertura: "odontologico",
        lancamentos: [],
        titular_nome: parentesco !== "titular" ? (titularMap.get(certBase) ?? null) : null,
      };

      continue;
    }

    // Check for lancamento lines (no certificado, but has IR/IM/CM/CR)
    if (currentRecord) {
      const lancMatch = line.match(/\b(TNDP|[A-Z]{3,5}\d?)\s+(\d{2}\/\d{2}\/\d{4})\s+(IR|IM|CM|CR)\s+(\d{2}\/\d{4})\s+([\d.,]+-?)\s+([\d.,]+-?)/);
      if (lancMatch) {
        const valor = parseMoneyBR(lancMatch[5]);
        const tipo = lancMatch[3];
        currentRecord.lancamentos.push({
          tipo,
          competencia: lancMatch[4],
          valor: (tipo === "CM" || tipo === "CR") ? -Math.abs(valor) : valor,
        });
        if (tipo === "CM" || tipo === "CR") {
          currentRecord.valor_estorno += Math.abs(valor);
        } else {
          currentRecord.valor_bruto += valor;
        }
        currentRecord.valor_liquido = currentRecord.valor_bruto - currentRecord.valor_estorno;
        continue;
      }

      // Simpler lancamento pattern
      const simpleLanc = line.match(/(IR|IM|CM|CR)\s+(\d{2}\/\d{4})\s+([\d.,]+-?)/);
      if (simpleLanc) {
        const valor = parseMoneyBR(simpleLanc[3]);
        const tipo = simpleLanc[1];
        currentRecord.lancamentos.push({
          tipo,
          competencia: simpleLanc[2],
          valor: (tipo === "CM" || tipo === "CR") ? -Math.abs(valor) : valor,
        });
        if (tipo === "CM" || tipo === "CR") {
          currentRecord.valor_estorno += Math.abs(valor);
        } else {
          currentRecord.valor_bruto += valor;
        }
        currentRecord.valor_liquido = currentRecord.valor_bruto - currentRecord.valor_estorno;
      }
    }
  }

  // Flush last record
  if (currentRecord) {
    records.push(currentRecord);
  }

  // Fill titular_nome for dependents (second pass)
  for (const r of records) {
    if (r.parentesco !== "titular" && !r.titular_nome) {
      const certBase = r.certificado.split("/")[0];
      r.titular_nome = titularMap.get(certBase) ?? null;
    }
  }

  // Compute totals from records if summary wasn't parsed
  const totalTitulares = totalTitularesResumo || records.filter(r => r.parentesco === "titular").length;
  const totalDependentes = totalDependentesResumo || records.filter(r => r.parentesco !== "titular").length;
  const totalVidas = totalVidasResumo || records.length;

  const computedBruto = records.reduce((s, r) => s + r.valor_bruto, 0);
  const computedEstorno = records.reduce((s, r) => s + r.valor_estorno, 0);
  const computedLiquido = records.reduce((s, r) => s + r.valor_liquido, 0);

  return {
    competencia,
    records,
    totalTitulares,
    totalDependentes,
    totalVidas,
    valorBruto: valorBrutoResumo || computedBruto,
    valorEstorno: valorEstornoResumo || computedEstorno,
    valorLiquido: valorLiquidoResumo || computedLiquido,
    resumo,
  };
}
