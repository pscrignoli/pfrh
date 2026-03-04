import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Briefcase, MapPin, Users, Download, Pencil, CalendarIcon } from "lucide-react";
import { exportCandidatesExcel } from "@/utils/exportCandidatesExcel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useVacancies, type Vacancy } from "@/hooks/useVacancies";
import { useDepartments } from "@/hooks/useDepartments";
import VacancyFieldsEditor from "@/components/recrutamento/VacancyFieldsEditor";
import type { VacancyField } from "@/hooks/useVacancyFields";
import { useVacancyFields } from "@/hooks/useVacancyFields";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; className: string }> = {
  aberta: { label: "Aberta", className: "bg-success/15 text-success border-success/30" },
  pausada: { label: "Pausada", className: "bg-warning/15 text-warning border-warning/30" },
  fechada: { label: "Fechada", className: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30" },
};

const workModelLabels: Record<string, string> = {
  presencial: "Presencial",
  hibrido: "Híbrido",
  remoto: "Remoto",
};

interface VacancyForm {
  title: string;
  department_id: string;
  work_model: string;
  status: string;
  opened_at: Date | undefined;
}

const defaultForm: VacancyForm = {
  title: "",
  department_id: "",
  work_model: "presencial",
  status: "aberta",
  opened_at: new Date(),
};

export default function Recrutamento() {
  const navigate = useNavigate();
  const { vacancies, loading, createVacancy, refetch } = useVacancies();
  const { departments } = useDepartments(true);
  const { saveFields } = useVacancyFields(undefined);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<VacancyForm>({ ...defaultForm });
  const [vacancyFields, setVacancyFields] = useState<VacancyField[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<VacancyForm>({ ...defaultForm });
  const [editVacancyId, setEditVacancyId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const resetDialog = () => {
    setStep(1);
    setForm({ ...defaultForm });
    setVacancyFields([]);
    setDialogOpen(false);
  };

  const handleNext = () => {
    if (!form.title.trim()) { toast.error("Informe o título da vaga."); return; }
    setStep(2);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const vacancyId = await createVacancy({
        title: form.title.trim(),
        department_id: form.department_id || null,
        work_model: form.work_model,
        opened_at: form.opened_at ? format(form.opened_at, "yyyy-MM-dd") : undefined,
      });

      if (vacancyFields.length > 0 && vacancyId) {
        await saveFields(vacancyId, vacancyFields);
      }

      toast.success("Vaga criada com sucesso!");
      resetDialog();
    } catch (e: any) {
      console.error("Create vacancy failed:", e);
      toast.error(e?.message || "Erro ao criar vaga.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (v: Vacancy, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditVacancyId(v.id);
    setEditForm({
      title: v.title,
      department_id: v.department_id || "",
      work_model: v.work_model,
      status: v.status,
      opened_at: v.opened_at ? new Date(v.opened_at + "T00:00:00") : undefined,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editVacancyId) return;
    if (!editForm.title.trim()) { toast.error("Informe o título da vaga."); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.rpc("update_vacancy_info" as any, {
        _vacancy_id: editVacancyId,
        _title: editForm.title.trim(),
        _department_id: editForm.department_id || null,
        _work_model: editForm.work_model,
        _status: editForm.status,
        _opened_at: editForm.opened_at ? format(editForm.opened_at, "yyyy-MM-dd") : null,
      });
      if (error) throw new Error(error.message);
      toast.success("Vaga atualizada!");
      setEditOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar vaga.");
    } finally {
      setEditSaving(false);
    }
  };

  const DatePickerField = ({ value, onChange, label }: { value: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy") : "Selecione a data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  const VacancyFormFields = ({ formData, setFormData, showStatus }: { formData: VacancyForm; setFormData: (f: VacancyForm) => void; showStatus?: boolean }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Título da Vaga *</Label>
        <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Analista de RH" />
      </div>
      <div className="space-y-2">
        <Label>Departamento</Label>
        <Select value={formData.department_id} onValueChange={(v) => setFormData({ ...formData, department_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Modelo de Trabalho</Label>
          <Select value={formData.work_model} onValueChange={(v) => setFormData({ ...formData, work_model: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="hibrido">Híbrido</SelectItem>
              <SelectItem value="remoto">Remoto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {showStatus && (
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="pausada">Pausada</SelectItem>
                <SelectItem value="fechada">Fechada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DatePickerField
        label="Data de Abertura"
        value={formData.opened_at}
        onChange={(d) => setFormData({ ...formData, opened_at: d })}
      />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recrutamento</h1>
          <p className="text-muted-foreground text-sm">Gerencie vagas e candidatos</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await exportCandidatesExcel({});
                toast.success("Excel exportado!");
              } catch (e: any) {
                toast.error(e.message || "Erro ao exportar.");
              }
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Exportar Todos
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Vaga
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Briefcase className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhuma vaga cadastrada</p>
          <p className="text-sm">Clique em "+ Nova Vaga" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vacancies.map((v) => {
            const sc = statusConfig[v.status] || statusConfig.aberta;
            return (
              <Card
                key={v.id}
                className="cursor-pointer hover:shadow-md transition-shadow border hover:border-primary/30 group"
                onClick={() => navigate(`/recrutamento/vagas/${v.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base leading-tight line-clamp-2">{v.title}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => openEdit(v, e)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    {v.departments?.name && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" /> {v.departments.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {workModelLabels[v.work_model]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-t">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      {v.candidate_count ?? 0} candidato{(v.candidate_count ?? 0) !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v.opened_at
                        ? new Date(v.opened_at + "T00:00:00").toLocaleDateString("pt-BR")
                        : new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create vacancy dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Vaga {step === 2 ? "— Campos" : ""}</DialogTitle>
            <DialogDescription>
              {step === 1 ? "Preencha os dados básicos da vaga." : "Adicione campos personalizados (opcional)."}
            </DialogDescription>
          </DialogHeader>

          {step === 1 ? (
            <VacancyFormFields formData={form} setFormData={setForm} />
          ) : (
            <VacancyFieldsEditor fields={vacancyFields} onChange={setVacancyFields} />
          )}

          <DialogFooter>
            {step === 2 && (
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
            )}
            {step === 1 ? (
              <>
                <Button variant="outline" onClick={resetDialog}>Cancelar</Button>
                <Button onClick={handleNext}>Próximo</Button>
              </>
            ) : (
              <Button onClick={handleCreate} disabled={saving}>{saving ? "Criando..." : "Criar Vaga"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit vacancy dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Vaga</DialogTitle>
            <DialogDescription>Altere as informações da vaga.</DialogDescription>
          </DialogHeader>
          <VacancyFormFields formData={editForm} setFormData={setEditForm} showStatus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
