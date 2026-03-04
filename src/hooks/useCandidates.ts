import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CandidateStage = "novos" | "triagem" | "entrevista_rh" | "entrevista_gestor" | "aprovado";

export interface Candidate {
  id: string;
  vacancy_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: CandidateStage;
  created_at: string;
}

export function useCandidates(vacancyId: string) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("vacancy_id", vacancyId)
      .order("created_at", { ascending: true });

    if (error) console.error("Error fetching candidates:", error);
    setCandidates((data as Candidate[]) ?? []);
    setLoading(false);
  }, [vacancyId]);

  useEffect(() => {
    fetchCandidates();

    const channel = supabase
      .channel(`candidates-${vacancyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "candidates", filter: `vacancy_id=eq.${vacancyId}` }, () => {
        fetchCandidates();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCandidates, vacancyId]);

  const createCandidate = async (candidate: { name: string; email?: string; phone?: string }) => {
    const { error } = await supabase.from("candidates").insert({
      ...candidate,
      vacancy_id: vacancyId,
    } as any);
    if (error) throw error;
    await fetchCandidates();
  };

  const updateStage = async (candidateId: string, stage: CandidateStage) => {
    const { error } = await supabase.from("candidates").update({ stage } as any).eq("id", candidateId);
    if (error) {
      console.error("Error updating candidate stage:", error);
      throw new Error(error.message || "Falha ao mover candidato");
    }
  };

  return { candidates, loading, createCandidate, updateStage, refetch: fetchCandidates };
}
