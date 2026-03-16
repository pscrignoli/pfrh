/**
 * Parser for Brazilian payroll TXT files in "Relação de Cálculo Geral" format.
 * Positional report with repeated blocks per employee.
 */

// ── Types ──

export interface Rubrica {
  codigo: number;
  tipo: number; // 1=provento, 3=desconto, 4=informativo
  descricao: string;
  referencia: string;
  valor: number;
}

export interface TotaisFunc {
  proventos: number;
  vantagens: number;
  descontos: number;
  liquido: number;
}

export interface BasesIRRF {
  normal: number;
  decimo_terceiro: number;
  ferias: number;
  lucro: number;
}

export interface BasesINSS {
  normal: number;
  decimo_terceiro: number;
  ferias: number;
}

export interface BasesFGTS {
  base: number;
  valor: number;
}

export interface PlanoSaude {
  mensalidade: number;        // rubrica 1817 (parte colaborador saúde)
  odontologico: number;       // rubrica 1821 (parte colaborador odonto)
  outras_despesas: number;    // rubrica 1819 (coparticipação/outras)
  total: number;              // rubrica 4008 (total informativo)
  beneficio_empresa: number;  // rubrica 1600 (parte empresa, informativo)
}

export interface FuncionarioParsed {
  numero: number;
  nome: string;
  data_admissao: string | null;
  data_demissao: string | null;
  cargo: string;
  carga_horaria: number;
  salario_base: number;
  cbo: string;
  situacao: string;
  cnpj_filial: string;
  organograma: string;
  dependentes_ir: number;
  dependentes_sf: number;
  sindicato_codigo: string;
  rubricas: Rubrica[];
  totais: TotaisFunc;
  bases: {
    irrf: BasesIRRF;
    inss: BasesINSS;
    inss_empresa: BasesINSS;
    fgts_gfip: BasesFGTS;
    fgts_grrf: BasesFGTS;
  };
  plano_saude: PlanoSaude;
}

export interface ResumoINSS {
  segurados: number;
  parte_empresa: number;
  terceiros: number;
  rat_fap: number;
  liquido: number;
}

export interface ResumoFGTS {
  gfip_base: number;
  gfip_valor: number;
  grrf_base: number;
  grrf_valor: number;
  total: number;
}

export interface ResumoIRRF {
  normal: number;
  rescisao: number;
  ferias: number;
  decimo_terceiro: number;
  total: number;
}

export interface ParsedPayroll {
  empresa: { codigo: string; nome: string; cnpj: string };
  periodo: { inicio: string; fim: string; tipo: string };
  funcionarios: FuncionarioParsed[];
  totais_gerais: { proventos: number; vantagens: number; descontos: number; liquido: number };
  resumo_inss: ResumoINSS;
  resumo_fgts: ResumoFGTS;
  resumo_irrf: ResumoIRRF;
}

// ── Helpers ──

/** Parse "3.877,11" → 3877.11, handles negatives like "-1.234,56" or "(1.234,56)" */
export function parseValorBR(str: string | undefined | null): number {
  if (!str) return 0;
  let clean = str.trim();
  if (!clean) return 0;
  // Detect negative: leading minus or parenthesized value
  let negative = false;
  if (clean.startsWith("-")) {
    negative = true;
    clean = clean.substring(1).trim();
  } else if (clean.startsWith("(") && clean.endsWith(")")) {
    negative = true;
    clean = clean.substring(1, clean.length - 1).trim();
  }
  // Remove dots (thousands), replace comma with period
  clean = clean.replace(/\./g, "").replace(",", ".");
  const num = Number(clean);
  if (isNaN(num)) return 0;
  return negative ? -num : num;
}

/** Parse "19/02/2019" → "2019-02-19" */
function parseDateBR(str: string | undefined | null): string | null {
  if (!str) return null;
  const m = str.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Parse "150:00" → 150 */
function parseCargaHoraria(str: string | undefined | null): number {
  if (!str) return 0;
  const m = str.trim().match(/(\d+):\d+/);
  return m ? Number(m[1]) : 0;
}

/** Strip page-break headers that repeat throughout the file */
function stripPageHeaders(text: string): string {
  const lines = text.split("\n");
  const filtered: string[] = [];

  // Patterns that identify page header/footer lines (individually)
  const headerPatterns = [
    /\f/,                                        // form-feed
    /^\s*Empresa:\s/,                            // "Empresa: 0297 - ..."
    /Inscri/i,                                   // "Inscrição Federal" (with encoding)
    /Endere/i,                                   // "Endereço:"
    /Bairro:/i,                                  // "Bairro:"
    /Rela.*C[aáà]lculo/i,                        // "Relação de Cálculo"
    /P[aáà]g:\s*\d/i,                            // "Pág:0001"
    /Usu[aáà]rio:\s/i,                           // "Usuário: SILMARA"
    /^\s*\d{4}\s*-\s*[A-Z].*(?:LTDA|S\.?A\.?|EIRELI|ME)\b/i, // full company name line "0297 - PRODUCTS..."
    /^\s*Anal[ií]tico\s+Contratos/i,             // "Analítico Contratos" section header
  ];

  for (const line of lines) {
    const cleanLine = line.replace(/\f/g, "");
    const isHeader = headerPatterns.some(p => p.test(line));
    if (isHeader) continue;
    filtered.push(cleanLine);
  }

  return filtered.join("\n");
}

// ── Main Parser ──

export function parseFolhaTxt(textoCompleto: string): ParsedPayroll {
  // Normalize encoding issues and line breaks
  let text = textoCompleto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Extract empresa info from first page header before stripping
  const empresa = { codigo: "", nome: "", cnpj: "" };
  const periodo = { inicio: "", fim: "", tipo: "" };

  const empresaMatch = text.match(/Empresa:\s*(\d+)\s*-\s*(.+?)(?:\s{2,}|$)/m);
  if (empresaMatch) {
    empresa.codigo = empresaMatch[1].trim();
    empresa.nome = empresaMatch[2].trim();
  }

  const cnpjMatch = text.match(/(?:CNPJ|Inscri[cç][aã]o\s+Federal):\s*([\d.\/\-]+)/mi);
  if (cnpjMatch) {
    empresa.cnpj = cnpjMatch[1].trim();
  }

  const periodoMatch = text.match(/Per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4})\s*[aA]\s*(\d{2}\/\d{2}\/\d{4})/m);
  if (periodoMatch) {
    periodo.inicio = parseDateBR(periodoMatch[1]) ?? "";
    periodo.fim = parseDateBR(periodoMatch[2]) ?? "";
  }

  const tipoMatch = text.match(/Calculo:\s*(.+?)(?:\s{2,}|$)/m);
  if (tipoMatch) {
    periodo.tipo = tipoMatch[1].trim();
  }

  // Strip repeated page headers
  text = stripPageHeaders(text);

  // Split into employee blocks using "Func:" marker
  const funcPattern = /^(\s{0,4}Func:\s+\d+)/m;
  const parts = text.split(funcPattern);

  // parts[0] is pre-header, then alternating: marker, content
  const funcionarios: FuncionarioParsed[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const headerLine = parts[i]; // "  Func:   12"
    const content = parts[i + 1] ?? "";
    const block = headerLine + content;

    const func = parseEmployeeBlock(block);
    if (func) {
      funcionarios.push(func);
    }
  }

  // Parse footer totals
  const totais_gerais = { proventos: 0, vantagens: 0, descontos: 0, liquido: 0 };
  const resumo_inss: ResumoINSS = { segurados: 0, parte_empresa: 0, terceiros: 0, rat_fap: 0, liquido: 0 };
  const resumo_fgts: ResumoFGTS = { gfip_base: 0, gfip_valor: 0, grrf_base: 0, grrf_valor: 0, total: 0 };
  const resumo_irrf: ResumoIRRF = { normal: 0, rescisao: 0, ferias: 0, decimo_terceiro: 0, total: 0 };

  // Extract footer "Totais" line — format:
  // "  Totais   Proventos: 727.471,02  Vantagens: 1.530,64  Descontos: 234.615,49  Liquido: 494.386,17"
  const totaisLineMatch = text.match(/^\s*Totais\s+.+$/m);
  if (totaisLineMatch) {
    const tl = totaisLineMatch[0];
    const provM = tl.match(/Proventos:\s*([\d.,]+)/);
    const vantM = tl.match(/Vantagens:\s*([\d.,]+)/);
    const descM = tl.match(/Descontos:\s*([\d.,]+)/);
    const liqM = tl.match(/L[ií]quido:\s*([\d.,]+)/);
    if (provM) totais_gerais.proventos = parseValorBR(provM[1]);
    if (vantM) totais_gerais.vantagens = parseValorBR(vantM[1]);
    if (descM) totais_gerais.descontos = parseValorBR(descM[1]);
    if (liqM) totais_gerais.liquido = parseValorBR(liqM[1]);
  }

  // Try to parse summary sections from the footer
  parseResumoINSS(text, resumo_inss);
  parseResumoFGTS(text, resumo_fgts);
  parseResumoIRRF(text, resumo_irrf);

  return {
    empresa,
    periodo,
    funcionarios,
    totais_gerais,
    resumo_inss,
    resumo_fgts,
    resumo_irrf,
  };
}

// ── Employee Block Parser ──

function parseEmployeeBlock(block: string): FuncionarioParsed | null {
  const lines = block.split("\n");

  // Parse Func: line
  const funcLine = lines.find(l => /Func:\s+\d+/.test(l));
  if (!funcLine) return null;

  const funcNumMatch = funcLine.match(/Func:\s+(\d+)/);
  const numero = funcNumMatch ? Number(funcNumMatch[1]) : 0;

  // Name: typically after the number, before "Adm" or "Dem" or "Dep."
  const afterFunc = funcLine.substring((funcNumMatch?.index ?? 0) + (funcNumMatch?.[0]?.length ?? 0));
  const nameMatch = afterFunc.match(/^\s+(.+?)\s{2,}(?:Adm|Dem|Dep\.)/);
  let nome = "";
  if (nameMatch) {
    nome = nameMatch[1].trim();
  } else {
    // Fallback: take everything before first double-space
    const segments = afterFunc.trim().split(/\s{2,}/);
    nome = segments[0]?.trim() ?? "";
  }

  const admMatch = funcLine.match(/Adm\s+(\d{2}\/\d{2}\/\d{4})/);
  const data_admissao = parseDateBR(admMatch?.[1]);

  const demMatch = funcLine.match(/Dem\s+(\d{2}\/\d{2}\/\d{4})/);
  const data_demissao = parseDateBR(demMatch?.[1]);

  const depIRMatch = funcLine.match(/Dep\.IR:\s*(\d+)/);
  const dependentes_ir = depIRMatch ? Number(depIRMatch[1]) : 0;

  const depSFMatch = funcLine.match(/Dep\.SF:\s*(\d+)/);
  const dependentes_sf = depSFMatch ? Number(depSFMatch[1]) : 0;

  // Parse Cargo: line
  const cargoLine = lines.find(l => /^\s*Cargo:/.test(l));
  let cargo = "";
  let carga_horaria = 0;
  let salario_base = 0;
  let cbo = "";
  let situacao = "";

  let sindicato_codigo = "";

  if (cargoLine) {
    const cargoMatch = cargoLine.match(/Cargo:\s*(.+?)(?:\s{2,}|C\.H\.M)/);
    cargo = cargoMatch ? cargoMatch[1].trim() : "";

    const chmMatch = cargoLine.match(/C\.H\.M\s+([\d:]+)/);
    carga_horaria = parseCargaHoraria(chmMatch?.[1]);

    const salMatch = cargoLine.match(/Sal[aá]rio:\s*([\d.,]+)/);
    salario_base = parseValorBR(salMatch?.[1]);

    const cboMatch = cargoLine.match(/CBO\s+(\d+)/);
    cbo = cboMatch ? cboMatch[1] : "";

    const sindMatch = cargoLine.match(/Sind(?:icato)?[:\s]+(\d+)/i);
    sindicato_codigo = sindMatch ? sindMatch[1] : "";

    // Situacao: try to extract from end of line using broad character class (supports accented chars)
    const sitMatch = cargoLine.match(/(?:Sindicato.*?|CBO\s+\d+\s+\S+\s+\d+)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s.]+?)\s*$/);
    if (sitMatch) {
      situacao = sitMatch[1].trim();
    }
    // Fallback: look for known situacao keywords (with accent-tolerant patterns)
    if (!situacao) {
      if (/Trabalhando/i.test(cargoLine)) situacao = "Trabalhando";
      else if (/Demitid/i.test(cargoLine)) situacao = "Demitido";
      else if (/Afastad/i.test(cargoLine)) situacao = "Afastado";
      else if (/F[eé]rias/i.test(cargoLine)) situacao = "Ferias";
      else if (/Licen[cç]a/i.test(cargoLine)) situacao = "Licença";
      else if (/Experi[eê]ncia/i.test(cargoLine)) situacao = "Experiência";
      else if (/Avis.*Pr[eé]v/i.test(cargoLine)) situacao = "Aviso Prévio";
    }
  }

  // Parse Filial: line
  const filialLine = lines.find(l => /^\s*Filial:/.test(l));
  let cnpj_filial = "";
  let organograma = "";

  if (filialLine) {
    const cnpjFMatch = filialLine.match(/([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})/);
    cnpj_filial = cnpjFMatch ? cnpjFMatch[1] : "";

    const orgMatch = filialLine.match(/Organograma\s+(.+?)(?:\s{2,}|$)/);
    organograma = orgMatch ? orgMatch[1].trim() : "";
  }

  // Parse rubricas
  const rubricas = parseRubricas(lines);

  // Parse totalizacao "Proventos:"
  const totais: TotaisFunc = { proventos: 0, vantagens: 0, descontos: 0, liquido: 0 };
  const provLine = lines.find(l => /^\s*Proventos:\s/.test(l));
  if (provLine) {
    const values = provLine.match(/[\d.,]+/g);
    if (values && values.length >= 3) {
      totais.proventos = parseValorBR(values[0]);
      if (values.length >= 4) {
        totais.vantagens = parseValorBR(values[1]);
        totais.descontos = parseValorBR(values[2]);
        totais.liquido = parseValorBR(values[3]);
      } else {
        totais.descontos = parseValorBR(values[1]);
        totais.liquido = parseValorBR(values[2]);
      }
    }
  }

  // Parse bases
  const bases = parseBases(lines);

  // Extract plano de saúde from rubricas informativas
  const plano_saude: PlanoSaude = { mensalidade: 0, outros: 0, total: 0 };
  for (const r of rubricas) {
    if (r.tipo === 4) {
      if (r.codigo === 1817 || /Mensalidade.*Plano.*Saude/i.test(r.descricao)) {
        plano_saude.mensalidade = r.valor;
      }
      if (r.codigo === 4008 || /Planos.*Saude.*Total/i.test(r.descricao)) {
        plano_saude.total = r.valor;
      }
    }
  }
  if (plano_saude.total > plano_saude.mensalidade) {
    plano_saude.outros = plano_saude.total - plano_saude.mensalidade;
  }

  return {
    numero,
    nome,
    data_admissao,
    data_demissao,
    cargo,
    carga_horaria,
    salario_base,
    cbo,
    situacao,
    cnpj_filial,
    organograma,
    dependentes_ir,
    dependentes_sf,
    sindicato_codigo,
    rubricas,
    totais,
    bases,
    plano_saude,
  };
}

// ── Rubricas Parser ──

function parseRubricas(lines: string[]): Rubrica[] {
  const rubricas: Rubrica[] = [];

  // Rubricas appear between the Filial/Cargo line and Proventos: line
  let inRubricas = false;

  for (const line of lines) {
    // Start after Filial: line, Cargo: line, or column header
    if (/^\s*Filial:/.test(line) || /Codigo\s+T\s+Descricao/i.test(line)) {
      inRubricas = true;
      continue;
    }

    // Stop at totalization
    if (/^\s*Proventos:/.test(line) || /^\s*Base\s+Impostos/i.test(line)) {
      inRubricas = false;
      continue;
    }

    if (!inRubricas) continue;
    if (line.trim() === "") continue;

    // Skip separator lines
    if (/^[\s\-=_]+$/.test(line)) continue;
    // Skip column headers (second occurrence)
    if (/Codigo\s+T\s+Descricao/i.test(line)) continue;

    // Try to parse full line as a single rubrica first
    const fullRubrica = parseRubricaColumn(line);
    if (fullRubrica) {
      rubricas.push(fullRubrica);
      continue;
    }

    // Parse two-column layout: try multiple split positions
    for (const splitPos of [55, 54, 56, 52, 58]) {
      if (line.length <= splitPos) continue;
      const leftPart = line.substring(0, splitPos);
      const rightPart = line.substring(splitPos);
      const leftRubrica = parseRubricaColumn(leftPart);
      const rightRubrica = parseRubricaColumn(rightPart);
      if (leftRubrica || rightRubrica) {
        if (leftRubrica) rubricas.push(leftRubrica);
        if (rightRubrica) rubricas.push(rightRubrica);
        break;
      }
    }
  }

  return rubricas;
}

function parseRubricaColumn(text: string): Rubrica | null {
  if (!text || text.trim() === "") return null;

  // Pattern: codigo tipo descricao ... referencia valor
  // Example: "  1     1  Horas Normais Diurnas           150:00 h    3.877,11"
  const match = text.match(/^\s*(\d{1,5})\s+(1|3|4)\s+(.+?)\s{2,}([\d:.,]+\s*[h%]?)?\s*([\d.,]+)\s*$/);

  if (!match) {
    // Try simpler pattern without referencia
    const simpleMatch = text.match(/^\s*(\d{1,5})\s+(1|3|4)\s+(.+?)\s+([\d.,]+)\s*$/);
    if (!simpleMatch) return null;

    return {
      codigo: Number(simpleMatch[1]),
      tipo: Number(simpleMatch[2]),
      descricao: simpleMatch[3].trim(),
      referencia: "",
      valor: parseValorBR(simpleMatch[4]),
    };
  }

  return {
    codigo: Number(match[1]),
    tipo: Number(match[2]),
    descricao: match[3].trim(),
    referencia: match[4]?.trim() ?? "",
    valor: parseValorBR(match[5]),
  };
}

// ── Bases Parser ──

function parseBases(lines: string[]): FuncionarioParsed["bases"] {
  const bases: FuncionarioParsed["bases"] = {
    irrf: { normal: 0, decimo_terceiro: 0, ferias: 0, lucro: 0 },
    inss: { normal: 0, decimo_terceiro: 0, ferias: 0 },
    inss_empresa: { normal: 0, decimo_terceiro: 0, ferias: 0 },
    fgts_gfip: { base: 0, valor: 0 },
    fgts_grrf: { base: 0, valor: 0 },
  };

  // Find the "Base Impostos" section and only parse within it
  let inBases = false;
  let basesLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start at "Base Impostos" header OR the column header line "Normal  13o  Férias"
    if (/^\s*Base\s+Impostos/i.test(line) || (!inBases && /Normal\s+13/i.test(line) && /Base\s+Valor/i.test(line))) {
      inBases = true;
      basesLineCount = 0;
      continue;
    }

    if (!inBases) continue;

    basesLineCount++;
    // The bases section is only ~4-5 lines (header, IRRF, INSS, INSS Empresa, blank)
    // Stop after INSS Empresa or after too many lines or at "Base Dif" or blank line after content
    if (basesLineCount > 8) break;
    if (/^\s*Base\s+Dif/i.test(line)) break;
    if (basesLineCount > 3 && line.trim() === "") break;

    // IRRF line with FGTS GFIP on the right side
    if (/^\s*IRRF\s/.test(line) && !/Resumo/i.test(line)) {
      // Extract IRRF values from the left portion (before any FGTS keyword)
      const leftPart = line.replace(/FGTS.*$/i, "");
      const vals = leftPart.match(/[\d.,]+/g);
      if (vals) {
        bases.irrf.normal = parseValorBR(vals[0]);
        bases.irrf.decimo_terceiro = parseValorBR(vals[1]);
        bases.irrf.ferias = parseValorBR(vals[2]);
        bases.irrf.lucro = parseValorBR(vals[3]);
      }
      // FGTS GFIP is on the same line as IRRF (right side)
      const gfipMatch = line.match(/FGTS\s+GFIP\s+([\d.,]+)\s+([\d.,]+)/i);
      if (gfipMatch) {
        bases.fgts_gfip.base = parseValorBR(gfipMatch[1]);
        bases.fgts_gfip.valor = parseValorBR(gfipMatch[2]);
      }
    }

    // Standalone FGTS GFIP line (not on same line as IRRF)
    if (/^\s*FGTS\s+GFIP/i.test(line) && !/IRRF/i.test(line)) {
      const gfipMatch = line.match(/FGTS\s+GFIP\s+([\d.,]+)\s+([\d.,]+)/i);
      if (gfipMatch) {
        bases.fgts_gfip.base = parseValorBR(gfipMatch[1]);
        bases.fgts_gfip.valor = parseValorBR(gfipMatch[2]);
      }
    }

    // INSS line (not empresa) with FGTS GRRF on the right side
    if (/^\s*INSS\s/i.test(line) && !/Empresa/i.test(line)) {
      const leftPart = line.replace(/FGTS.*$/i, "");
      const vals = leftPart.match(/[\d.,]+/g);
      if (vals) {
        bases.inss.normal = parseValorBR(vals[0]);
        bases.inss.decimo_terceiro = parseValorBR(vals[1]);
        bases.inss.ferias = parseValorBR(vals[2]);
      }
      // FGTS GRRF on same line
      const grrfMatch = line.match(/FGTS\s+GRRF\s+([\d.,]+)\s+([\d.,]+)/i);
      if (grrfMatch) {
        bases.fgts_grrf.base = parseValorBR(grrfMatch[1]);
        bases.fgts_grrf.valor = parseValorBR(grrfMatch[2]);
      }
    }

    // Standalone FGTS GRRF line
    if (/^\s*FGTS\s+GRRF/i.test(line) && !/INSS/i.test(line)) {
      const grrfMatch = line.match(/FGTS\s+GRRF\s+([\d.,]+)\s+([\d.,]+)/i);
      if (grrfMatch) {
        bases.fgts_grrf.base = parseValorBR(grrfMatch[1]);
        bases.fgts_grrf.valor = parseValorBR(grrfMatch[2]);
      }
    }

    // INSS Empresa
    if (/^\s*INSS\s+Empresa/i.test(line)) {
      const vals = line.match(/[\d.,]+/g);
      if (vals) {
        bases.inss_empresa.normal = parseValorBR(vals[0]);
        bases.inss_empresa.decimo_terceiro = parseValorBR(vals[1]);
        bases.inss_empresa.ferias = parseValorBR(vals[2]);
      }
    }
  }

  return bases;
}

// ── Footer Resumo Parsers ──

function parseResumoINSS(text: string, resumo: ResumoINSS) {
  // Look for INSS summary block after "Totais"
  const seguradosMatch = text.match(/Segurados.*?([\d.,]+)\s*$/m);
  if (seguradosMatch) resumo.segurados = parseValorBR(seguradosMatch[1]);

  const empresaMatch = text.match(/Parte\s+Empresa.*?([\d.,]+)\s*$/m);
  if (empresaMatch) resumo.parte_empresa = parseValorBR(empresaMatch[1]);

  const terceirosMatch = text.match(/Terceiros.*?([\d.,]+)\s*$/m);
  if (terceirosMatch) resumo.terceiros = parseValorBR(terceirosMatch[1]);

  const ratMatch = text.match(/RAT.*?FAP.*?([\d.,]+)\s*$/m);
  if (ratMatch) resumo.rat_fap = parseValorBR(ratMatch[1]);
}

function parseResumoFGTS(text: string, resumo: ResumoFGTS) {
  // Look for FGTS summary section
  const gfipMatch = text.match(/GFIP\s+Normal.*?Base\s+([\d.,]+).*?Valor\s+([\d.,]+)/s);
  if (gfipMatch) {
    resumo.gfip_base = parseValorBR(gfipMatch[1]);
    resumo.gfip_valor = parseValorBR(gfipMatch[2]);
  }

  const grrfMatch = text.match(/GRRF.*?Base\s+([\d.,]+).*?Valor\s+([\d.,]+)/s);
  if (grrfMatch) {
    resumo.grrf_base = parseValorBR(grrfMatch[1]);
    resumo.grrf_valor = parseValorBR(grrfMatch[2]);
  }

  resumo.total = resumo.gfip_valor + resumo.grrf_valor;
}

function parseResumoIRRF(text: string, resumo: ResumoIRRF) {
  const irrfNormal = text.match(/IRRF\s+Normal.*?([\d.,]+)\s*$/m);
  if (irrfNormal) resumo.normal = parseValorBR(irrfNormal[1]);

  const irrfRescisao = text.match(/IRRF\s+Resc.*?([\d.,]+)\s*$/m);
  if (irrfRescisao) resumo.rescisao = parseValorBR(irrfRescisao[1]);

  const irrfFerias = text.match(/IRRF\s+Fer.*?([\d.,]+)\s*$/m);
  if (irrfFerias) resumo.ferias = parseValorBR(irrfFerias[1]);

  const irrf13 = text.match(/IRRF\s+13.*?([\d.,]+)\s*$/m);
  if (irrf13) resumo.decimo_terceiro = parseValorBR(irrf13[1]);

  resumo.total = resumo.normal + resumo.rescisao + resumo.ferias + resumo.decimo_terceiro;
}

// ── Mapper: Convert parsed data to payroll_monthly_records format ──

export interface MappedPayrollRecord {
  cpf: string | null;
  nome: string;
  data: Record<string, unknown>;
}

/**
 * Maps parsed employee data to the fields expected by payroll_monthly_records.
 * Requires a CPF lookup since the TXT doesn't contain CPF directly.
 */
export function mapParsedToPayrollFields(func: FuncionarioParsed): Record<string, unknown> {
  // Sum rubricas by known codes to map to payroll fields
  const rubricaByCode = new Map<number, number>();
  for (const r of func.rubricas) {
    rubricaByCode.set(r.codigo, (rubricaByCode.get(r.codigo) ?? 0) + r.valor);
  }

  // Helper to sum multiple rubrica codes
  const sumCodes = (...codes: number[]) =>
    codes.reduce((acc, c) => acc + (rubricaByCode.get(c) ?? 0), 0);

  return {
    salario_base: func.salario_base,
    salario: func.totais.proventos,
    cargo: func.cargo,
    admissao: func.data_admissao,
    desligamento: func.data_demissao,
    tipo_contrato: null, // not in TXT format
    area: func.organograma,
    empresa: null,

    // Horas extras
    hora_50: rubricaByCode.get(35) ?? 0,
    hora_60: rubricaByCode.get(36) ?? 0,
    hora_80: rubricaByCode.get(37) ?? 0,
    hora_100: rubricaByCode.get(38) ?? 0,
    he_total: sumCodes(35, 36, 37, 38),
    dsr_horas: rubricaByCode.get(59) ?? 0,
    adicional_noturno: rubricaByCode.get(40) ?? 0,

    // 13o e férias
    decimo_terceiro: sumCodes(510, 511, 512),
    ferias: sumCodes(658, 659, 660),
    terco_ferias: sumCodes(678, 679),
    avos_ferias: 0,

    // Encargos: inss fields store BASES, fgts stores actual values
    inss_20: func.bases.inss_empresa.normal,
    inss_13: func.bases.inss.decimo_terceiro,
    inss_ferias: func.bases.inss.ferias,
    fgts_8: func.bases.fgts_gfip.valor + func.bases.fgts_grrf.valor,
    fgts_13: 0,
    fgts_ferias: 0,
    encargos: (func.bases.inss_empresa.normal * 0.288) + func.bases.fgts_gfip.valor + func.bases.fgts_grrf.valor,

    // Benefícios
    vale_transporte: rubricaByCode.get(1816) ?? 0,
    desconto_vale_transporte: rubricaByCode.get(1816) ?? 0,
    convenio_medico: func.plano_saude.total,
    plano_odontologico: 0,

    // Descontos
    falta: sumCodes(1826, 1827, 1828),
    insalubridade: rubricaByCode.get(50) ?? 0,

    // Totais
    total_folha: func.totais.proventos,
    total_geral: func.totais.liquido,
    soma: func.totais.proventos - func.totais.descontos,
    beneficios: func.plano_saude.total,

    // Relação/contrato
    relacao_funcionarios: String(func.numero),
    contrato_empregado: String(func.numero),
  };
}
