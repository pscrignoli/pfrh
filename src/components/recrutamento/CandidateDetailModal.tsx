import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useVacancyFields, type VacancyField } from "@/hooks/useVacancyFields";
import { useCandidateFieldValues } from "@/hooks/useCandidateFieldValues";
import type { Candidate, CandidateStage } from "@/hooks/useCandidates";
import { toast } from "sonner";

const STAGES: { id: CandidateStage; label: string }[] = [
  { id: "novos", label: "Novos" },
  { id: "triagem", label: "Triagem" },
  { id: "entrevista_rh", label: "Entrevista RH" },
  { id: "entrevista_gestor", label: "Entrevista Gestor" },
  { id: "aprovado", label: "Aprovado" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  vacancyId: string;
  onSaved?: () => void;
}

export default function CandidateDetailModal({ open, onOpenChange, candidate, vacancyId, onSaved }: Props) {
  const { fields, loading: fieldsLoading } = useVacancyFields(vacancyId);
  const { values, loading: valuesLoading, saveValues } = useCandidateFieldValues(candidate?.id);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<CandidateStage>("novos");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (candidate) {
      setName(candidate.name);
      setEmail(candidate.email || "");
      setPhone(candidate.phone || "");
      setStage(candidate.stage);
    }
  }, [candidate]);

  useEffect(() => {
    setFieldValues(values);
  }, [values]);

  const setFieldValue = (fieldId: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  const handleSave = async () => {
    if (!candidate) return;
    if (!name.trim()) { toast.error("Nome é obrigatório."); return; }
    setSaving(true);
    try {
      // Update candidate info via RPC
      const { error: infoError } = await supabase.rpc("update_candidate_info" as any, {
        _candidate_id: candidate.id,
        _name: name.trim(),
        _email: email || null,
        _phone: phone || null,
        _stage: stage,
      });
      if (infoError) throw new Error(infoError.message);

      // Save dynamic field values
      if (Object.keys(fieldValues).length > 0) {
        await saveValues(candidate.id, fieldValues);
      }

      toast.success("Candidato atualizado!");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const isLoading = fieldsLoading || valuesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Candidato</DialogTitle>
          <DialogDescription>Edite as informações e campos personalizados.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Fixed fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select value={stage} onValueChange={(v) => setStage(v as CandidateStage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic fields */}
            {fields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-muted-foreground">Campos da Vaga</Label>
                  {fields.map((field) => (
                    <DynamicField
                      key={field.id}
                      field={field}
                      value={fieldValues[field.id!] || ""}
                      onChange={(val) => setFieldValue(field.id!, val)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DynamicField({ field, value, onChange }: { field: VacancyField; value: string; onChange: (v: string) => void }) {
  switch (field.field_type) {
    case "text":
      return (
        <div className="space-y-1.5">
          <Label>{field.label}</Label>
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          <Label>{field.label}</Label>
          <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "dropdown":
      return (
        <div className="space-y-1.5">
          <Label>{field.label}</Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value === "true"}
            onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          />
          <Label className="cursor-pointer">{field.label}</Label>
        </div>
      );
    default:
      return null;
  }
}
