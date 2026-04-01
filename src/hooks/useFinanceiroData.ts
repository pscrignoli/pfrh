import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { Tables } from "@/integrations/supabase/types";

export type PayrollRecord = Tables<"payroll_monthly_records"> & {
  employee_name?: string;
};
export type IntegrationLog = Tables<"integration_logs">;

export function useFinanceiroData(ano: number, mes: number) {
  const { companyId } = useCompany();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [transmitting, setTransmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    let query = supabase
      .from("rh_payroll_monthly_records")
      .select("*, rh_employees!inner(nome_completo)")
      .eq("ano", ano)
      .eq("mes", mes)
      .order("cargo");

    if (companyId) query = query.eq("company_id", companyId);

    const { data } = await query;

    const mapped: PayrollRecord[] = (data ?? []).map((r: any) => ({
      ...r,
      employee_name: r.employees?.nome_completo ?? "—",
    }));
    setRecords(mapped);
  }, [ano, mes, companyId]);

  const fetchLogs = useCallback(async () => {
    let query = supabase
      .from("rh_integration_logs")
      .select("*")
      .eq("source", "folha_mensal")
      .order("created_at", { ascending: false })
      .limit(20);

    if (companyId) query = query.eq("company_id", companyId);

    const { data } = await query;
    setLogs(data ?? []);
  }, [companyId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRecords(), fetchLogs()]);
    setLoading(false);
  }, [fetchRecords, fetchLogs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const allSent = records.length > 0 && records.every((r) => r.status === "enviado");

  const transmit = async () => {
    if (allSent || records.length === 0) return;
    setTransmitting(true);

    try {
      const payload = records.map((r) => ({
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        ano: r.ano,
        mes: r.mes,
        total_geral: r.total_geral,
        salario: r.salario,
        encargos: r.encargos,
        beneficios: r.beneficios,
      }));

      await supabase.from("rh_integration_logs").insert({
        source: "folha_mensal",
        direction: "outbound",
        endpoint: "/api/v1/controladoria/folha",
        status: "success" as const,
        request_payload: payload as any,
        response_payload: { status: 200, message: "Dados recebidos com sucesso (mock)" } as any,
        company_id: companyId,
      });

      const ids = records.map((r) => r.id);
      await supabase
        .from("rh_payroll_monthly_records")
        .update({ status: "enviado" })
        .in("id", ids);

      await fetchAll();
    } finally {
      setTransmitting(false);
    }
  };

  return { records, logs, loading, transmitting, allSent, transmit, refetch: fetchAll };
}
