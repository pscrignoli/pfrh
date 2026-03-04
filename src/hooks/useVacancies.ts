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

function withTimeout<T>(fn: () => PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(fn()),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo limite excedido. Tente novamente.")), ms)
    ),
  ]);
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
    const payload: Record<string, unknown> = {
      title: vacancy.title,
      work_model: (vacancy.work_model || "presencial") as "presencial" | "hibrido" | "remoto",
    };

    if (vacancy.department_id) {
      payload.department_id = vacancy.department_id;
    }

    if (vacancy.status) {
      payload.status = vacancy.status;
    }

    const { data, error } = await withTimeout(
      () => supabase.from("vacancies").insert([payload] as any).select("id").single(),
      12000
    ) as any;

    if (error) {
      console.error("Error creating vacancy:", error);
      throw new Error(error.message || "Não foi possível concluir a criação. Tente novamente.");
    }

    // Refresh in background — don't block caller
    fetchVacancies().catch(() => {});

    return data?.id as string;
  };

  return { vacancies, loading, createVacancy, refetch: fetchVacancies };
}
