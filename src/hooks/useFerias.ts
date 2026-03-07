import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface FeriasRecord {
  id: string;
  employee_id: string;
  company_id: string | null;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_inicio: string | null;
  data_fim: string | null;
  dias_gozo: number;
  dias_abono: number;
  abono_pecuniario: boolean;
  adiantamento_13: boolean;
  status: string;
  valor_bruto: number | null;
  valor_inss: number | null;
  valor_irrf: number | null;
  valor_liquido: number | null;
  observacao: string | null;
}

export type VacationStatus = "vencidas" | "a_vencer" | "em_dia" | "programadas" | "em_gozo";

export interface EmployeeVacation {
  employeeId: string;
  nome: string;
  departamento: string | null;
  cargo: string | null;
  dataAdmissao: string;
  salarioBase: number | null;
  status: VacationStatus;
  periodoAquisitivoInicio: Date;
  periodoAquisitivoFim: Date;
  diasDireito: number;
  diasGozados: number;
  diasRestantes: number;
  vencimentoEm: Date;
  diasParaVencimento: number;
  feriasRegistros: FeriasRecord[];
  feriasAtual?: FeriasRecord;
}

function calcPeriodoAquisitivo(dataAdmissao: Date, referenceDate: Date) {
  const admDay = dataAdmissao.getDate();
  const admMonth = dataAdmissao.getMonth();
  let year = referenceDate.getFullYear();

  let aniversario = new Date(year, admMonth, admDay);
  if (aniversario > referenceDate) {
    aniversario = new Date(year - 1, admMonth, admDay);
  }

  const inicio = aniversario;
  const fim = new Date(inicio.getFullYear() + 1, inicio.getMonth(), inicio.getDate() - 1);
  const vencimento = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  vencimento.setFullYear(vencimento.getFullYear() + 1);

  return { inicio, fim, vencimento };
}

function diffDays(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function useFerias(filters: { search: string; departamento: string | null; statusFilter: string | null }) {
  const { companyId } = useCompany();
  const [employees, setEmployees] = useState<any[]>([]);
  const [feriasRecords, setFeriasRecords] = useState<FeriasRecord[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [empRes, ferRes, deptRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, nome_completo, departamento, cargo, data_admissao, salario_base, status")
          .eq("company_id", companyId)
          .eq("status", "ativo")
          .order("nome_completo"),
        supabase
          .from("ferias")
          .select("*")
          .eq("company_id", companyId),
        supabase
          .from("departments")
          .select("name")
          .eq("company_id", companyId)
          .eq("status", "active")
          .order("name"),
      ]);
      setEmployees(empRes.data ?? []);
      setFeriasRecords((ferRes.data as any[]) ?? []);
      setDepartamentos((deptRes.data ?? []).map((d: any) => d.name));
    } catch (err) {
      console.error("useFerias fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const vacationData = useMemo<EmployeeVacation[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return employees.map((emp) => {
      const admDate = new Date(emp.data_admissao + "T00:00:00");
      const { inicio, fim, vencimento } = calcPeriodoAquisitivo(admDate, today);

      const empFerias = feriasRecords.filter((f) => f.employee_id === emp.id);

      // Check if there's a vacation currently active
      const emGozo = empFerias.find(
        (f) =>
          f.data_inicio &&
          f.data_fim &&
          new Date(f.data_inicio) <= today &&
          new Date(f.data_fim) >= today &&
          f.status === "aprovada"
      );

      // Check if vacation is scheduled
      const programada = empFerias.find(
        (f) =>
          f.data_inicio &&
          new Date(f.data_inicio) > today &&
          (f.status === "aprovada" || f.status === "programada")
      );

      // Check if current period has been fulfilled
      const gozadaNoPeriodo = empFerias.find(
        (f) =>
          f.periodo_aquisitivo_inicio === inicio.toISOString().split("T")[0] &&
          (f.status === "gozada" || f.status === "aprovada")
      );

      const diasParaVencimento = diffDays(today, vencimento);
      const diasDireito = 30;
      const diasGozados = gozadaNoPeriodo ? gozadaNoPeriodo.dias_gozo : 0;

      let status: VacationStatus;
      if (emGozo) {
        status = "em_gozo";
      } else if (programada) {
        status = "programadas";
      } else if (diasParaVencimento < 0) {
        status = "vencidas";
      } else if (diasParaVencimento <= 90) {
        status = "a_vencer";
      } else {
        status = "em_dia";
      }

      return {
        employeeId: emp.id,
        nome: emp.nome_completo,
        departamento: emp.departamento,
        cargo: emp.cargo,
        dataAdmissao: emp.data_admissao,
        salarioBase: emp.salario_base,
        status,
        periodoAquisitivoInicio: inicio,
        periodoAquisitivoFim: fim,
        diasDireito,
        diasGozados,
        diasRestantes: diasDireito - diasGozados,
        vencimentoEm: vencimento,
        diasParaVencimento,
        feriasRegistros: empFerias,
        feriasAtual: emGozo || programada || gozadaNoPeriodo,
      };
    });
  }, [employees, feriasRecords]);

  const filtered = useMemo(() => {
    let result = vacationData;
    if (filters.search.trim()) {
      const term = filters.search.toLowerCase();
      result = result.filter((e) => e.nome.toLowerCase().includes(term));
    }
    if (filters.departamento) {
      result = result.filter((e) => e.departamento === filters.departamento);
    }
    if (filters.statusFilter) {
      result = result.filter((e) => e.status === filters.statusFilter);
    }
    // Sort by urgency
    const order: Record<VacationStatus, number> = {
      vencidas: 0,
      a_vencer: 1,
      em_gozo: 2,
      programadas: 3,
      em_dia: 4,
    };
    result.sort((a, b) => order[a.status] - order[b.status] || a.diasParaVencimento - b.diasParaVencimento);
    return result;
  }, [vacationData, filters]);

  const summary = useMemo(() => {
    const counts = { vencidas: 0, a_vencer: 0, programadas: 0, em_gozo: 0, em_dia: 0 };
    vacationData.forEach((v) => counts[v.status]++);
    return counts;
  }, [vacationData]);

  const saveFerias = async (data: {
    employee_id: string;
    periodo_aquisitivo_inicio: string;
    periodo_aquisitivo_fim: string;
    data_inicio: string;
    dias_gozo: number;
    dias_abono: number;
    abono_pecuniario: boolean;
    adiantamento_13: boolean;
    valor_bruto: number;
    valor_inss: number;
    valor_irrf: number;
    valor_liquido: number;
    observacao?: string;
  }) => {
    const dataInicio = new Date(data.data_inicio + "T00:00:00");
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + data.dias_gozo - 1);

    const { error } = await supabase.from("ferias").insert({
      ...data,
      company_id: companyId,
      data_fim: dataFim.toISOString().split("T")[0],
      status: "programada",
    } as any);
    if (error) throw error;
    await fetchData();
  };

  return { vacationData: filtered, summary, departamentos, loading, saveFerias, refetch: fetchData };
}
