import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface EmployeeStatus {
  employeeId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  status: "working" | "break" | "absent";
  clockIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  clockOut: string | null;
  totalHours: number | null;
  overtimeHours: number | null;
}

export interface TimeRecordRow {
  id: string;
  employeeName: string;
  recordDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  totalHours: number | null;
  overtimeHours: number | null;
  source: string | null;
  hasAnomaly: boolean;
}

interface FilterOptions {
  employeeId: string | null;
  dateRange: "today" | "7days" | "30days";
}

export function usePresencaData(filters: FilterOptions) {
  const { companyId } = useCompany();
  const [liveStatuses, setLiveStatuses] = useState<EmployeeStatus[]>([]);
  const [records, setRecords] = useState<TimeRecordRow[]>([]);
  const [employees, setEmployees] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const getDateFilter = useCallback(() => {
    const now = new Date();
    if (filters.dateRange === "today") return today;
    if (filters.dateRange === "7days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString().split("T")[0];
    }
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, [filters.dateRange, today]);

  const fetchLiveStatus = useCallback(async () => {
    let empQuery = supabase
      .from("rh_employees")
      .select("id, nome_completo, cargo, departamento")
      .eq("status", "ativo");

    if (companyId) empQuery = empQuery.eq("company_id", companyId);

    const { data: emps } = await empQuery;

    if (!emps) return;

    // Get today's time records for these employees
    const empIds = emps.map((e) => e.id);
    const { data: todayRecords } = await supabase
      .from("rh_time_records")
      .select("*")
      .eq("record_date", today)
      .in("employee_id", empIds);

    const statuses: EmployeeStatus[] = emps.map((emp) => {
      const rec = (todayRecords ?? []).find((r) => r.employee_id === emp.id);

      let status: EmployeeStatus["status"] = "absent";
      if (rec) {
        if (rec.clock_out) {
          status = "absent";
        } else if (rec.break_start && !rec.break_end) {
          status = "break";
        } else if (rec.clock_in) {
          status = "working";
        }
      }

      return {
        employeeId: emp.id,
        nome: emp.nome_completo,
        cargo: emp.cargo,
        departamento: emp.departamento,
        status,
        clockIn: rec?.clock_in ?? null,
        breakStart: rec?.break_start ?? null,
        breakEnd: rec?.break_end ?? null,
        clockOut: rec?.clock_out ?? null,
        totalHours: rec?.total_hours ?? null,
        overtimeHours: rec?.overtime_hours ?? null,
      };
    });

    setLiveStatuses(statuses);
    setEmployees(emps.map((e) => ({ id: e.id, nome: e.nome_completo })));
  }, [today, companyId]);

  const fetchRecords = useCallback(async () => {
    const startDate = getDateFilter();

    let query = supabase
      .from("rh_time_records")
      .select("*, rh_employees!inner(nome_completo, company_id)")
      .gte("record_date", startDate)
      .order("record_date", { ascending: false })
      .order("clock_in", { ascending: false });

    if (filters.employeeId) {
      query = query.eq("employee_id", filters.employeeId);
    }

    if (companyId) {
      query = query.eq("employees.company_id", companyId);
    }

    const { data } = await query;

    const rows: TimeRecordRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      employeeName: r.employees?.nome_completo ?? "—",
      recordDate: r.record_date,
      clockIn: r.clock_in,
      clockOut: r.clock_out,
      breakStart: r.break_start,
      breakEnd: r.break_end,
      totalHours: r.total_hours,
      overtimeHours: r.overtime_hours,
      source: r.source,
      hasAnomaly: (r.total_hours ?? 0) > 10 || (r.overtime_hours ?? 0) > 2,
    }));

    setRecords(rows);
  }, [getDateFilter, filters.employeeId, companyId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLiveStatus(), fetchRecords()]);
    setLoading(false);
  }, [fetchLiveStatus, fetchRecords]);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("presenca-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_time_records" }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return { liveStatuses, records, employees, loading };
}
