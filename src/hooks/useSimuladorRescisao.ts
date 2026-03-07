import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export type TipoRescisao = "sem_justa_causa" | "pedido_demissao" | "acordo_mutuo" | "justa_causa";
export type TipoAvisoPrevio = "trabalhado" | "indenizado" | "dispensado";

export interface RescisaoInput {
  employeeId: string;
  nome: string;
  salarioBase: number;
  dataAdmissao: string;
  dataDemissao: string;
  tipoRescisao: TipoRescisao;
  avisoPrevio: TipoAvisoPrevio;
  saldoFgts: number;
  feriasVencidas: boolean;
  mesesPeriodoAquisitivo: number;
  meses13Proporcional: number;
}

export interface RescisaoResult {
  // Proventos
  saldoSalario: number;
  avisoPrevioIndenizado: number;
  diasAviso: number;
  decimoTerceiroProporcional: number;
  feriasProporcionais: number;
  tercoFeriasProporcionais: number;
  feriasVencidas: number;
  tercoFeriasVencidas: number;
  totalProventos: number;
  // Descontos
  inssRescisao: number;
  irrfRescisao: number;
  avisoPrevioDesconto: number;
  totalDescontos: number;
  // Líquido
  liquidoRescisao: number;
  // Custos empresa
  multaFgts: number;
  inssPatronal: number;
  fgtsSobreRescisao: number;
  custoTotalEmpresa: number;
  // Resumo colaborador
  saqueFgts: number;
  seguroDesempregoParcelas: number;
  seguroDesempregoValor: number;
  totalRecebido: number;
}

function calcINSS(base: number): number {
  // Faixas 2025
  if (base <= 1518.00) return base * 0.075;
  if (base <= 2793.88) return 1518 * 0.075 + (base - 1518) * 0.09;
  if (base <= 4190.83) return 1518 * 0.075 + (2793.88 - 1518) * 0.09 + (base - 2793.88) * 0.12;
  if (base <= 8157.41) return 1518 * 0.075 + (2793.88 - 1518) * 0.09 + (4190.83 - 2793.88) * 0.12 + (base - 4190.83) * 0.14;
  return 1518 * 0.075 + (2793.88 - 1518) * 0.09 + (4190.83 - 2793.88) * 0.12 + (8157.41 - 4190.83) * 0.14;
}

function calcIRRF(base: number, inss: number): number {
  const b = base - inss;
  if (b <= 2259.21) return 0;
  if (b <= 2826.65) return b * 0.075 - 169.44;
  if (b <= 3751.05) return b * 0.15 - 381.44;
  if (b <= 4664.68) return b * 0.225 - 662.77;
  return b * 0.275 - 896.00;
}

export function calcularRescisao(input: RescisaoInput): RescisaoResult {
  const { salarioBase, dataAdmissao, dataDemissao, tipoRescisao, avisoPrevio, saldoFgts, feriasVencidas, mesesPeriodoAquisitivo, meses13Proporcional } = input;

  const admDate = new Date(dataAdmissao + "T00:00:00");
  const demDate = new Date(dataDemissao + "T00:00:00");

  // Anos de serviço
  const anosServico = Math.floor((demDate.getTime() - admDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  // 1. Saldo de salário
  const diaNoMes = demDate.getDate();
  const saldoSalario = (salarioBase / 30) * diaNoMes;

  // 2. Aviso prévio indenizado
  let diasAviso = 0;
  let avisoPrevioIndenizado = 0;
  if (avisoPrevio === "indenizado") {
    if (tipoRescisao === "sem_justa_causa") {
      diasAviso = Math.min(30 + anosServico * 3, 90);
      avisoPrevioIndenizado = (salarioBase / 30) * diasAviso;
    } else if (tipoRescisao === "acordo_mutuo") {
      diasAviso = Math.min(30 + anosServico * 3, 90);
      avisoPrevioIndenizado = ((salarioBase / 30) * diasAviso) * 0.5;
    }
  }

  // 3. 13º proporcional
  let decimoTerceiroProporcional = 0;
  if (tipoRescisao !== "justa_causa") {
    decimoTerceiroProporcional = (salarioBase / 12) * meses13Proporcional;
  }

  // 4. Férias proporcionais + 1/3
  let feriasProporcionaisVal = 0;
  let tercoFeriasProporcionais = 0;
  if (tipoRescisao !== "justa_causa" || anosServico >= 1) {
    feriasProporcionaisVal = (salarioBase / 12) * mesesPeriodoAquisitivo;
    tercoFeriasProporcionais = feriasProporcionaisVal / 3;
  }

  // 5. Férias vencidas + 1/3
  let feriasVencidasVal = 0;
  let tercoFeriasVencidas = 0;
  if (feriasVencidas) {
    feriasVencidasVal = salarioBase;
    tercoFeriasVencidas = salarioBase / 3;
  }

  const totalProventos = saldoSalario + avisoPrevioIndenizado + decimoTerceiroProporcional + feriasProporcionaisVal + tercoFeriasProporcionais + feriasVencidasVal + tercoFeriasVencidas;

  // Descontos
  const inssRescisao = calcINSS(saldoSalario + decimoTerceiroProporcional);
  const irrfRescisao = Math.max(calcIRRF(saldoSalario + decimoTerceiroProporcional, inssRescisao), 0);

  let avisoPrevioDesconto = 0;
  if (tipoRescisao === "pedido_demissao" && avisoPrevio === "indenizado") {
    avisoPrevioDesconto = salarioBase; // colaborador paga aviso
  }

  const totalDescontos = inssRescisao + irrfRescisao + avisoPrevioDesconto;
  const liquidoRescisao = totalProventos - totalDescontos;

  // Custos empresa
  let multaFgts = 0;
  if (tipoRescisao === "sem_justa_causa") multaFgts = saldoFgts * 0.4;
  else if (tipoRescisao === "acordo_mutuo") multaFgts = saldoFgts * 0.2;

  const baseEncargos = saldoSalario + avisoPrevioIndenizado + decimoTerceiroProporcional;
  const inssPatronal = baseEncargos * 0.2;
  const fgtsSobreRescisao = baseEncargos * 0.08;

  const custoTotalEmpresa = totalProventos + multaFgts + inssPatronal + fgtsSobreRescisao;

  // Resumo colaborador
  let saqueFgts = 0;
  if (tipoRescisao === "sem_justa_causa") saqueFgts = saldoFgts;
  else if (tipoRescisao === "acordo_mutuo") saqueFgts = saldoFgts * 0.8;

  let seguroDesempregoParcelas = 0;
  let seguroDesempregoValor = 0;
  if (tipoRescisao === "sem_justa_causa") {
    if (anosServico >= 2) seguroDesempregoParcelas = 5;
    else if (anosServico >= 1) seguroDesempregoParcelas = 4;
    else seguroDesempregoParcelas = 3;

    // Estimativa simplificada
    const media = salarioBase;
    if (media <= 2041.39) seguroDesempregoValor = media * 0.8;
    else if (media <= 3402.65) seguroDesempregoValor = 2041.39 * 0.8 + (media - 2041.39) * 0.5;
    else seguroDesempregoValor = 2230.97;
  }

  const totalRecebido = liquidoRescisao + saqueFgts + (seguroDesempregoParcelas * seguroDesempregoValor);

  return {
    saldoSalario, avisoPrevioIndenizado, diasAviso, decimoTerceiroProporcional,
    feriasProporcionais: feriasProporcionaisVal, tercoFeriasProporcionais,
    feriasVencidas: feriasVencidasVal, tercoFeriasVencidas, totalProventos,
    inssRescisao, irrfRescisao, avisoPrevioDesconto, totalDescontos,
    liquidoRescisao, multaFgts, inssPatronal, fgtsSobreRescisao, custoTotalEmpresa,
    saqueFgts, seguroDesempregoParcelas, seguroDesempregoValor, totalRecebido,
  };
}

export function useSimuladorRescisao() {
  const { companyId } = useCompany();
  const [employees, setEmployees] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [empRes, histRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, nome_completo, departamento, cargo, data_admissao, salario_base, status")
          .eq("company_id", companyId)
          .eq("status", "ativo")
          .order("nome_completo"),
        supabase
          .from("rescisao_simulacoes")
          .select("*")
          .eq("company_id", companyId)
          .order("data_simulacao", { ascending: false })
          .limit(20),
      ]);
      setEmployees(empRes.data ?? []);
      setHistorico(histRes.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const salvarSimulacao = async (employeeId: string, tipoRescisao: string, dataDemissao: string, valores: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("rescisao_simulacoes").insert({
      employee_id: employeeId,
      company_id: companyId,
      tipo_rescisao: tipoRescisao,
      data_demissao: dataDemissao,
      valores_json: valores,
      simulado_por: user?.id,
    } as any);
    if (error) throw error;
    await fetchData();
  };

  const fetchFgtsEstimado = async (employeeId: string): Promise<number> => {
    const { data } = await supabase
      .from("payroll_monthly_records")
      .select("fgts_8")
      .eq("employee_id", employeeId)
      .eq("company_id", companyId!);
    return (data ?? []).reduce((sum: number, r: any) => sum + (r.fgts_8 ?? 0), 0);
  };

  return { employees, historico, loading, salvarSimulacao, fetchFgtsEstimado, refetch: fetchData };
}
