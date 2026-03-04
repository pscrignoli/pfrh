// Maps display labels to DB column names for payroll import
export const PAYROLL_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "__skip__", label: "— Ignorar —" },
  { value: "numero_cpf", label: "CPF (obrigatório)" },
  { value: "contrato_empregado", label: "Contrato / Empregado" },
  { value: "relacao_funcionarios", label: "Relação Funcionários" },
  { value: "codigo_centro_custo", label: "Cód. Centro de Custo" },
  { value: "centro_custo", label: "Centro de Custo" },
  { value: "area", label: "Área" },
  { value: "cargo", label: "Cargo" },
  { value: "admissao", label: "Admissão" },
  { value: "desligamento", label: "Desligamento" },
  { value: "tipo_contrato", label: "Tipo de Contrato" },
  { value: "salario_base", label: "Salário Base" },
  { value: "salario", label: "Salário" },
  { value: "diferenca_salario", label: "Diferença Salário" },
  { value: "hora_50", label: "Hora Extra 50%" },
  { value: "hora_60", label: "Hora Extra 60%" },
  { value: "hora_80", label: "Hora Extra 80%" },
  { value: "hora_100", label: "Hora Extra 100%" },
  { value: "he_total", label: "HE Total" },
  { value: "dsr_horas", label: "DSR s/ Horas" },
  { value: "adicional_noturno", label: "Adicional Noturno" },
  { value: "bonus_gratificacao", label: "Bônus / Gratificação" },
  { value: "salario_familia", label: "Salário Família" },
  { value: "insalubridade", label: "Insalubridade" },
  { value: "auxilio_alimentacao", label: "Auxílio Alimentação" },
  { value: "vale_transporte", label: "Vale Transporte" },
  { value: "ajuda_de_custo", label: "Ajuda de Custo" },
  { value: "soma", label: "Soma Vencimentos" },
  { value: "falta", label: "Faltas" },
  { value: "desconto_vale_transporte", label: "Desconto VT" },
  { value: "fgts_8", label: "FGTS 8%" },
  { value: "inss_20", label: "INSS 20%" },
  { value: "total_folha", label: "Total Folha" },
  { value: "avos_ferias", label: "Avos Férias" },
  { value: "ferias", label: "Férias" },
  { value: "terco_ferias", label: "1/3 Férias" },
  { value: "fgts_ferias", label: "FGTS s/ Férias" },
  { value: "inss_ferias", label: "INSS s/ Férias" },
  { value: "ferias_13", label: "Férias + 13º" },
  { value: "decimo_terceiro", label: "13º Salário" },
  { value: "inss_13", label: "INSS s/ 13º" },
  { value: "fgts_13", label: "FGTS s/ 13º" },
  { value: "salario_gratificacao", label: "Salário/Gratificação" },
  { value: "encargos", label: "Encargos" },
  { value: "convenio_medico", label: "Convênio Médico" },
  { value: "plano_odontologico", label: "Plano Odontológico" },
  { value: "plano_odontologico_empresa", label: "Plano Odonto (Empresa)" },
  { value: "vr_alimentacao", label: "VR / Alimentação" },
  { value: "vr_auto", label: "VR Auto" },
  { value: "beneficios", label: "Total Benefícios" },
  { value: "total_geral", label: "Total Geral" },
  { value: "empresa", label: "Empresa (texto)" },
];

// Normalize a string for fuzzy matching
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Alias map for common variations in spreadsheet headers
const ALIASES: Record<string, string[]> = {
  numero_cpf: ["cpf", "numerocpf", "cpfcnpj"],
  contrato_empregado: ["contrato", "contratoempregado", "contratoemp"],
  relacao_funcionarios: ["relacaofuncionarios", "relacaofunc", "funcionarios"],
  codigo_centro_custo: ["codigocentrocusto", "codcc", "codigocc"],
  centro_custo: ["centrocusto", "centrodecusto", "cc"],
  cargo: ["cargo", "funcao"],
  admissao: ["admissao", "dataadmissao", "dtadmissao"],
  desligamento: ["desligamento", "datadesligamento", "dtdesligamento"],
  salario_base: ["salariobase", "salbase"],
  salario: ["salario"],
  diferenca_salario: ["diferencasalario", "difsalario"],
  hora_50: ["hora50", "he50", "horaextra50"],
  hora_60: ["hora60", "he60", "horaextra60"],
  hora_80: ["hora80", "he80", "horaextra80"],
  hora_100: ["hora100", "he100", "horaextra100"],
  he_total: ["hetotal", "totalhe", "totalhorasextras", "horasextras"],
  dsr_horas: ["dsrhoras", "dsr", "dsrsobrehoras"],
  adicional_noturno: ["adicionalnoturno", "adnoturno"],
  bonus_gratificacao: ["bonusgratificacao", "bonus", "gratificacao"],
  salario_familia: ["salariofamilia", "salfamilia"],
  insalubridade: ["insalubridade"],
  auxilio_alimentacao: ["auxilioalimentacao", "auxalimentacao"],
  vale_transporte: ["valetransporte", "vt"],
  ajuda_de_custo: ["ajudadecusto", "ajudacusto"],
  soma: ["soma", "somavencimentos"],
  falta: ["falta", "faltas"],
  desconto_vale_transporte: ["descontovaletransporte", "descontovt"],
  fgts_8: ["fgts8", "fgts"],
  inss_20: ["inss20", "inss"],
  total_folha: ["totalfolha"],
  avos_ferias: ["avosferias"],
  ferias: ["ferias"],
  terco_ferias: ["tercoferias", "13ferias", "umtercoferias"],
  fgts_ferias: ["fgtsferias", "fgtssferias"],
  inss_ferias: ["inssferias", "insssferias"],
  ferias_13: ["ferias13"],
  decimo_terceiro: ["decimoterceiro", "13salario", "13"],
  inss_13: ["inss13"],
  fgts_13: ["fgts13"],
  salario_gratificacao: ["salariogratificacao"],
  encargos: ["encargos", "totalencargos"],
  convenio_medico: ["conveniomedico", "planodesaude", "planosaude"],
  plano_odontologico: ["planoodontologico", "planoodonto"],
  plano_odontologico_empresa: ["planoodontologicoempresa"],
  vr_alimentacao: ["vralimentacao", "vr"],
  vr_auto: ["vrauto"],
  beneficios: ["beneficios", "totalbeneficio", "totalbeneficios"],
  total_geral: ["totalgeral"],
  empresa: ["empresa"],
  tipo_contrato: ["tipocontrato", "tipocontratacao"],
  area: ["area", "setor"],
};

export function autoMapColumn(header: string): string {
  const n = norm(header);
  if (!n) return "__skip__";

  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(n)) return field;
  }

  // Partial match
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      if (n.includes(alias) || alias.includes(n)) return field;
    }
  }

  return "__skip__";
}
