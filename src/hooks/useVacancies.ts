import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Vacancy {
  id: string;
  title: string;
  department_id: string | null;
  work_model: "presencial" | "hibrido" | "remoto";
  status: "aberta" | "pausada" | "fechada";
  created_at: string;
  departments?: { name: string } | null;
  candidate_count?: number;
}

export function useVacancies() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vacancies")
      .select("*, departments(name), candidates(id)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching vacancies:", error);
      setVacancies([]);
    } else {
      const mapped = (data || []).map((v: any) => ({
        ...v,
        candidate_count: Array.isArray(v.candidates) ? v.candidates.length : 0,
        candidates: undefined,
      }));
      setVacancies(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVacancies();

    const channel = supabase
      .channel("vacancies-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "vacancies" }, () => {
        fetchVacancies();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchVacancies]);

  const createVacancy = async (vacancy: { title: string; department_id: string | null; work_model: string; status?: string }) => {
    const { error } = await supabase.from("vacancies").insert(vacancy as any);
    if (error) throw error;
    await fetchVacancies();
  };

  return { vacancies, loading, createVacancy, refetch: fetchVacancies };
}
