import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface Vacancy {
  id: string;
  title: string;
  department_id: string | null;
  work_model: "presencial" | "hibrido" | "remoto";
  status: "aberta" | "pausada" | "fechada";
  created_at: string;
  opened_at: string | null;
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
  const { companyId } = useCompany();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("rh_vacancies")
      .select("*, rh_departments(name), rh_candidates(id)")
      .order("created_at", { ascending: false });

    if (companyId) query = query.eq("company_id", companyId);

    const { data, error } = await query;

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
  }, [companyId]);

  useEffect(() => {
    fetchVacancies();

    const channel = supabase
      .channel("vacancies-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rh_vacancies" }, () => {
        fetchVacancies();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchVacancies]);

  const createVacancy = async (vacancy: { title: string; department_id: string | null; work_model: string; status?: string; opened_at?: string }) => {
    const payload: Record<string, unknown> = {
      title: vacancy.title,
      work_model: (vacancy.work_model || "presencial") as "presencial" | "hibrido" | "remoto",
      company_id: companyId,
    };

    if (vacancy.department_id) {
      payload.department_id = vacancy.department_id;
    }

    if (vacancy.status) {
      payload.status = vacancy.status;
    }

    if (vacancy.opened_at) {
      payload.opened_at = vacancy.opened_at;
    }

    const { data, error } = await withTimeout(
      () => supabase.from("rh_vacancies").insert([payload] as any).select("id").single(),
      12000
    ) as any;

    if (error) {
      console.error("Error creating vacancy:", error);
      throw new Error(error.message || "Não foi possível concluir a criação. Tente novamente.");
    }

    fetchVacancies().catch(() => {});

    return data?.id as string;
  };

  const deleteVacancy = async (vacancyId: string) => {
    const { error } = await supabase.rpc("delete_vacancy_cascade" as any, {
      _vacancy_id: vacancyId,
    });
    if (error) {
      console.error("Error deleting vacancy:", error);
      throw new Error(error.message || "Erro ao excluir vaga.");
    }
    fetchVacancies().catch(() => {});
  };

  return { vacancies, loading, createVacancy, deleteVacancy, refetch: fetchVacancies };
}
