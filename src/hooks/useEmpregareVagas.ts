import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface EmpregareVaga {
  id: string;
  empregare_id: number;
  company_id: string | null;
  department_id: string | null;
  titulo: string;
  descricao: string | null;
  requisitos: string | null;
  situacao: string | null;
  tipo_recrutamento: string | null;
  trabalho_remoto: string | null;
  salario_min: number | null;
  salario_max: number | null;
  salario_combinar: boolean;
  total_vagas: number;
  cidade: string | null;
  estado: string | null;
  horario: string | null;
  meta_encerramento: string | null;
  requisicao_id: number | null;
  beneficios: any[];
  etapas: any[];
  responsaveis: any[];
  data_cadastro: string | null;
  data_sync: string | null;
}

export interface EmpregareKanbanCard {
  id: string;
  empregare_vaga_id: number;
  empregare_pessoa_id: number | null;
  company_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  etapa_atual: string;
  etapa_ordem: number;
  observacao: string | null;
  origem: string;
  data_entrada_etapa: string;
  created_at: string;
}

export function useEmpregareVagas() {
  const { companyId } = useCompany();
  const [vagas, setVagas] = useState<EmpregareVaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchVagas = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("empregare_vagas")
      .select("*")
      .order("data_cadastro", { ascending: false });

    if (companyId) query = query.eq("company_id", companyId);

    const { data, error } = await query;
    if (error) console.error("Error fetching empregare_vagas:", error);

    const mapped = (data || []).map((v: any) => ({
      ...v,
      beneficios: typeof v.beneficios === "string" ? JSON.parse(v.beneficios) : (v.beneficios ?? []),
      etapas: typeof v.etapas === "string" ? JSON.parse(v.etapas) : (v.etapas ?? []),
      responsaveis: typeof v.responsaveis === "string" ? JSON.parse(v.responsaveis) : (v.responsaveis ?? []),
    }));
    setVagas(mapped);
    setLoading(false);
  }, [companyId]);

  const fetchLastSync = useCallback(async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "empregare_last_sync")
      .maybeSingle();
    setLastSync(data?.value ?? null);
  }, []);

  useEffect(() => {
    fetchVagas();
    fetchLastSync();
  }, [fetchVagas, fetchLastSync]);

  const sync = useCallback(async (step: string = "all") => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-empregare", {
        body: { step },
      });
      if (error) throw new Error(error.message);
      await fetchVagas();
      await fetchLastSync();
      return data;
    } finally {
      setSyncing(false);
    }
  }, [fetchVagas, fetchLastSync]);

  const fetchKanbanCards = useCallback(async (empregareVagaId: number): Promise<EmpregareKanbanCard[]> => {
    const { data, error } = await supabase
      .from("empregare_kanban_cards")
      .select("*")
      .eq("empregare_vaga_id", empregareVagaId)
      .order("etapa_ordem", { ascending: true });
    if (error) console.error("Error fetching kanban cards:", error);
    return (data as any[]) ?? [];
  }, []);

  const upsertKanbanCard = useCallback(async (card: Partial<EmpregareKanbanCard> & { empregare_vaga_id: number; nome: string; etapa_atual: string }) => {
    const payload = {
      ...card,
      updated_at: new Date().toISOString(),
      company_id: card.company_id ?? companyId,
    };

    if (card.id) {
      const { error } = await supabase.from("empregare_kanban_cards").update(payload as any).eq("id", card.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("empregare_kanban_cards").insert(payload as any);
      if (error) throw error;
    }
  }, [companyId]);

  // Stats — compare case-insensitive against "Aberta"
  const abertas = vagas.filter(v => v.situacao === "Aberta" || v.situacao?.toLowerCase() === "aberta");
  const stats = {
    total: vagas.length,
    abertas: abertas.length,
    posicoes: abertas.reduce((s, v) => s + (v.total_vagas || 0), 0),
    contratados: vagas.reduce((s, v) => {
      const etapas = v.etapas || [];
      return s + etapas.reduce((sum: number, e: any) => {
        const nome = (e.nome ?? e.Nome ?? e.titulo ?? e.Titulo ?? "").toLowerCase();
        if (nome.includes("contratad")) return sum + (e.qntde ?? e.Qntde ?? e.qtd ?? e.totalCandidatos ?? 0);
        return sum;
      }, 0);
    }, 0),
  };

  return { vagas, loading, lastSync, syncing, sync, stats, refetch: fetchVagas, fetchKanbanCards, upsertKanbanCard };
}
