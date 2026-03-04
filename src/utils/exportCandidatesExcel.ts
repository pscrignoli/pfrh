import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const STAGE_LABELS: Record<string, string> = {
  novos: "Novos",
  triagem: "Triagem",
  entrevista_rh: "Entrevista RH",
  entrevista_gestor: "Entrevista Gestor",
  aprovado: "Aprovado",
};

interface ExportOptions {
  vacancyId?: string; // if undefined, export all
  vacancyTitle?: string;
}

export async function exportCandidatesExcel({ vacancyId, vacancyTitle }: ExportOptions) {
  // 1. Fetch candidates
  let candidatesQuery = supabase
    .from("candidates")
    .select("*, vacancies(title, opened_at)")
    .order("created_at", { ascending: true });

  if (vacancyId) {
    candidatesQuery = candidatesQuery.eq("vacancy_id", vacancyId);
  }

  const { data: candidates, error: cErr } = await candidatesQuery;
  if (cErr) throw new Error(cErr.message);
  if (!candidates || candidates.length === 0) throw new Error("Nenhum candidato encontrado.");

  // 2. Fetch vacancy fields for relevant vacancies
  const vacancyIds = [...new Set(candidates.map((c: any) => c.vacancy_id))];

  const { data: allFields, error: fErr } = await supabase
    .from("vacancy_fields" as any)
    .select("*")
    .in("vacancy_id", vacancyIds)
    .order("sort_order", { ascending: true });

  if (fErr) throw new Error(fErr.message);

  const fields = (allFields as any[]) || [];

  // 3. Fetch all field values for these candidates
  const candidateIds = candidates.map((c: any) => c.id);
  const { data: allValues, error: vErr } = await supabase
    .from("candidate_field_values" as any)
    .select("candidate_id, field_id, value")
    .in("candidate_id", candidateIds);

  if (vErr) throw new Error(vErr.message);

  const values = (allValues as any[]) || [];

  // Index values by candidate_id → field_id → value
  const valuesMap: Record<string, Record<string, string>> = {};
  for (const v of values) {
    if (!valuesMap[v.candidate_id]) valuesMap[v.candidate_id] = {};
    valuesMap[v.candidate_id][v.field_id] = v.value || "";
  }

  // 4. Build dynamic column headers (ordered)
  // For single vacancy: just those fields. For all: group by vacancy.
  const dynamicColumns = fields.map((f: any) => ({
    id: f.id,
    label: f.label,
    vacancyId: f.vacancy_id,
  }));

  // 5. Build rows
  const isAllVacancies = !vacancyId;

  const rows = candidates.map((c: any) => {
    const row: Record<string, any> = {};

    if (isAllVacancies) {
      row["Vaga"] = (c as any).vacancies?.title || "";
    }

    const openedAt = (c as any).vacancies?.opened_at;
    row["Data de Abertura da Vaga"] = openedAt
      ? new Date(openedAt + "T00:00:00").toLocaleDateString("pt-BR")
      : "";

    row["Nome"] = c.name || "";
    row["E-mail"] = c.email || "";
    row["Telefone"] = c.phone || "";
    row["Etapa"] = STAGE_LABELS[c.stage] || c.stage;
    row["Data de Cadastro"] = c.created_at
      ? new Date(c.created_at).toLocaleDateString("pt-BR")
      : "";

    // Dynamic fields for this candidate's vacancy
    const candidateFields = dynamicColumns.filter(
      (f: any) => f.vacancyId === c.vacancy_id
    );
    for (const f of candidateFields) {
      row[f.label] = valuesMap[c.id]?.[f.id] || "";
    }

    return row;
  });

  // 6. Generate Excel
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String(r[key] || "").length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  const sheetName = vacancyTitle
    ? vacancyTitle.substring(0, 31)
    : "Candidatos";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const fileName = vacancyTitle
    ? `Candidatos - ${vacancyTitle}.xlsx`
    : "Todos os Candidatos.xlsx";

  // Use Blob download to work in sandboxed iframes
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
