import { useState } from "react";
import { Plus, Trash2, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { VacancyField } from "@/hooks/useVacancyFields";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  dropdown: "Dropdown",
  boolean: "Sim / Não",
  number: "Número",
};

interface Props {
  fields: VacancyField[];
  onChange: (fields: VacancyField[]) => void;
}

export default function VacancyFieldsEditor({ fields, onChange }: Props) {
  const [optionInput, setOptionInput] = useState<Record<number, string>>({});

  const addField = () => {
    onChange([...fields, { label: "", field_type: "text", options: [], sort_order: fields.length }]);
  };

  const updateField = (index: number, patch: Partial<VacancyField>) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(updated);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const addOption = (index: number) => {
    const val = (optionInput[index] || "").trim();
    if (!val) return;
    const f = fields[index];
    updateField(index, { options: [...f.options, val] });
    setOptionInput({ ...optionInput, [index]: "" });
  };

  const removeOption = (fieldIndex: number, optIndex: number) => {
    const f = fields[fieldIndex];
    updateField(fieldIndex, { options: f.options.filter((_, i) => i !== optIndex) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Campos da Vaga</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Campo
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum campo personalizado. Clique em "Adicionar Campo" para começar.
        </p>
      )}

      <div className="space-y-3">
        {fields.map((field, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <Input
                placeholder="Nome do campo"
                value={field.label}
                onChange={(e) => updateField(idx, { label: e.target.value })}
                className="flex-1"
              />
              <Select
                value={field.field_type}
                onValueChange={(v) =>
                  updateField(idx, { field_type: v as VacancyField["field_type"], options: v === "dropdown" ? field.options : [] })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeField(idx)} className="shrink-0 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {field.field_type === "dropdown" && (
              <div className="pl-6 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {field.options.map((opt, oi) => (
                    <Badge key={oi} variant="secondary" className="gap-1">
                      {opt}
                      <button type="button" onClick={() => removeOption(idx, oi)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova opção"
                    value={optionInput[idx] || ""}
                    onChange={(e) => setOptionInput({ ...optionInput, [idx]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(idx); } }}
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => addOption(idx)}>
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
