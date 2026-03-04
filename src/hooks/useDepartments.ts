import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface Department {
  id: string;
  name: string;
  code: string | null;
  status: string;
  created_at: string;
}

export function useDepartments(onlyActive = false) {
  const { companyId } = useCompany();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("departments")
      .select("*")
      .order("name");

    if (companyId) query = query.eq("company_id", companyId);
    if (onlyActive) query = query.eq("status", "active");

    const { data, error } = await query;
    if (error) console.error("Error fetching departments:", error);
    setDepartments((data as Department[]) ?? []);
    setLoading(false);
  }, [onlyActive, companyId]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const createDepartment = async (name: string, code?: string) => {
    const { error } = await supabase.from("departments").insert({ name, code: code || null, company_id: companyId } as any);
    if (error) throw error;
    await fetchDepartments();
  };

  const updateDepartment = async (id: string, updates: { name?: string; code?: string; status?: string }) => {
    const { error } = await supabase.from("departments").update(updates as any).eq("id", id);
    if (error) throw error;
    await fetchDepartments();
  };

  const deleteDepartment = async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) throw error;
    await fetchDepartments();
  };

  return { departments, loading, createDepartment, updateDepartment, deleteDepartment, refetch: fetchDepartments };
}
