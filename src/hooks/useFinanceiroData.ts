import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PayrollRecord = Tables<"payroll_monthly_records"> & {
  employee_name?: string;
};
export type IntegrationLog = Tables<"integration_logs">;

export function useFinanceiroData(ano: number, mes: number) {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [transmitting, setTransmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    const { data } = await supabase
      .from("payroll_monthly_records")
      .select("*, employees!inner(nome_completo)")
      .eq("ano", ano)
      .eq("mes", mes)
      .order("cargo");

    const mapped: PayrollRecord[] = (data ?? []).map((r: any) => ({
      ...r,
      employee_name: r.employees?.nome_completo ?? "—",
    }));
    setRecords(mapped);
  }, [ano, mes]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("integration_logs")
      .select("*")
      .eq("source", "folha_mensal")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs(data ?? []);
  }, []);

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
      // Build payload
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

      // Insert integration log
      await supabase.from("integration_logs").insert({
        source: "folha_mensal",
        direction: "outbound",
        endpoint: "/api/v1/controladoria/folha",
        status: "success" as const,
        request_payload: payload as any,
        response_payload: { status: 200, message: "Dados recebidos com sucesso (mock)" } as any,
      });

      // Update records status to "enviado"
      const ids = records.map((r) => r.id);
      await supabase
        .from("payroll_monthly_records")
        .update({ status: "enviado" })
        .in("id", ids);

      await fetchAll();
    } finally {
      setTransmitting(false);
    }
  };

  return { records, logs, loading, transmitting, allSent, transmit, refetch: fetchAll };
}
