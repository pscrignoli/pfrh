import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("employees")
        .select("*")
        .order("nome_completo");

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
  }, [filters.search, filters.status, filters.departamento]);

  // Fetch departments from the departments table (active only)
  const fetchDepartments = useCallback(async () => {
    const { data } = await supabase
      .from("departments")
      .select("name")
      .eq("status", "active")
      .order("name");
    setDepartamentos((data ?? []).map((d: any) => d.name));
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const createEmployee = async (data: EmployeeInsert) => {
    const { error } = await supabase.from("employees").insert(data);
    if (error) throw error;
    await fetchEmployees();
  };

  const updateEmployee = async (id: string, data: EmployeeUpdate) => {
    const { error } = await supabase.from("employees").update(data).eq("id", id);
    if (error) throw error;
    await fetchEmployees();
  };

  return { employees, departamentos, loading, createEmployee, updateEmployee, refetch: fetchEmployees };
}
