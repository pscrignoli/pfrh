import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VacancyField {
  id?: string;
  label: string;
  field_type: "text" | "dropdown" | "boolean" | "number";
  options: string[];
  sort_order: number;
}

export function useVacancyFields(vacancyId: string | undefined) {
  const [fields, setFields] = useState<VacancyField[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFields = useCallback(async () => {
    if (!vacancyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("rh_vacancy_fields" as any)
      .select("*")
      .eq("vacancy_id", vacancyId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching vacancy fields:", error);
    } else {
      setFields(
        (data as any[])?.map((f) => ({
          id: f.id,
          label: f.label,
          field_type: f.field_type,
          options: Array.isArray(f.options) ? f.options : [],
          sort_order: f.sort_order,
        })) ?? []
      );
    }
    setLoading(false);
  }, [vacancyId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const saveFields = async (vacId: string, fieldsList: VacancyField[]) => {
    const payload = fieldsList.map((f, i) => ({
      label: f.label,
      field_type: f.field_type,
      options: f.options,
      sort_order: i,
    }));

    const { error } = await supabase.rpc("save_vacancy_fields" as any, {
      _vacancy_id: vacId,
      _fields: payload,
    });

    if (error) throw new Error(error.message);
    if (vacId === vacancyId) fetchFields();
  };

  return { fields, loading, saveFields, refetch: fetchFields };
}
