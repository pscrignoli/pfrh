import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CandidateFieldValue {
  field_id: string;
  value: string;
}

export function useCandidateFieldValues(candidateId: string | undefined) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchValues = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("candidate_field_values" as any)
      .select("field_id, value")
      .eq("candidate_id", candidateId);

    if (error) {
      console.error("Error fetching candidate field values:", error);
    } else {
      const map: Record<string, string> = {};
      (data as any[])?.forEach((r) => { map[r.field_id] = r.value ?? ""; });
      setValues(map);
    }
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);

  const saveValues = async (candId: string, vals: Record<string, string>) => {
    const payload = Object.entries(vals).map(([field_id, value]) => ({ field_id, value }));
    if (payload.length === 0) return;

    const { error } = await supabase.rpc("upsert_candidate_field_values" as any, {
      _candidate_id: candId,
      _values: payload,
    });

    if (error) throw new Error(error.message);
    if (candId === candidateId) fetchValues();
  };

  return { values, loading, saveValues, refetch: fetchValues };
}
