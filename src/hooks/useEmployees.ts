import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Employee = Tables<"employees">;
export type EmployeeInsert = TablesInsert<"employees">;
export type EmployeeUpdate = TablesUpdate<"employees">;

interface Filters {
  search: string;
  status: string | null;
  departamento: string | null;
}

export function useEmployees(filters: Filters) {
  const { companyId } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("rh_employees")
        .select("*")
        .order("nome_completo");

      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      if (filters.status) {
        query = query.eq("status", filters.status as Employee["status"]);
      }
      if (filters.departamento) {
        query = query.eq("departamento", filters.departamento);
      }
      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(`nome_completo.ilike.${term},numero_cpf.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching employees:", error);
      }
      setEmployees(data ?? []);
    } catch (err) {
      console.error("Error in fetchEmployees:", err);
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status, filters.departamento, companyId]);

  const fetchDepartments = useCallback(async () => {
    let query = supabase
      .from("rh_departments")
      .select("name")
      .eq("status", "active")
      .order("name");

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data } = await query;
    setDepartamentos((data ?? []).map((d: any) => d.name));
  }, [companyId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const createEmployee = async (data: EmployeeInsert) => {
    const payload = { ...data, company_id: companyId };
    const { error } = await supabase.from("rh_employees").insert(payload);
    if (error) throw error;
    await fetchEmployees();
  };

  const updateEmployee = async (id: string, data: EmployeeUpdate) => {
    const { error } = await supabase.from("rh_employees").update(data).eq("id", id);
    if (error) throw error;
    await fetchEmployees();
  };

  const deleteEmployee = async (id: string) => {
    const { error } = await supabase.from("rh_employees").delete().eq("id", id);
    if (error) throw error;
    await fetchEmployees();
  };

  return { employees, departamentos, loading, createEmployee, updateEmployee, deleteEmployee, refetch: fetchEmployees };
}
