import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Briefcase, MapPin, Users, Download, Pencil, CalendarIcon, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { exportCandidatesExcel } from "@/utils/exportCandidatesExcel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useVacancies, type Vacancy } from "@/hooks/useVacancies";
import { useDepartments } from "@/hooks/useDepartments";
import { useCompany } from "@/contexts/CompanyContext";
import { useEmpregareVagas } from "@/hooks/useEmpregareVagas";
import VacancyFieldsEditor from "@/components/recrutamento/VacancyFieldsEditor";
import type { VacancyField } from "@/hooks/useVacancyFields";
import { useVacancyFields } from "@/hooks/useVacancyFields";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RecrutamentoStats from "@/components/recrutamento/RecrutamentoStats";
import EmpregareVagasList from "@/components/recrutamento/EmpregareVagasList";
import EmpregareVagaDrawer from "@/components/recrutamento/EmpregareVagaDrawer";
import type { EmpregareVaga } from "@/hooks/useEmpregareVagas";

// ── Local vacancy components (kept from original) ──

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

function DatePickerField({ value, onChange, label }: { value: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy") : "Selecione a data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function VacancyFormFields({ formData, setFormData, showStatus, departments }: { formData: VacancyForm; setFormData: (f: VacancyForm) => void; showStatus?: boolean; departments: { id: string; name: string }[] }) {
  return (
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
      <DatePickerField label="Data de Abertura" value={formData.opened_at} onChange={(d) => setFormData({ ...formData, opened_at: d })} />
    </div>
  );
}

// ── Main Page ──

export default function Recrutamento() {
  const navigate = useNavigate();
  const { vacancies, loading: localLoading, createVacancy, deleteVacancy, refetch } = useVacancies();
  const { departments } = useDepartments(true);
  const { companyId } = useCompany();
  const { saveFields } = useVacancyFields(undefined);
  const { vagas: empregareVagas, loading: empLoading, lastSync, syncing, sync, stats, fetchKanbanCards, upsertKanbanCard } = useEmpregareVagas();

  // Tab
  const [tab, setTab] = useState("empregare");

  // Empregare drawer
  const [selectedVaga, setSelectedVaga] = useState<EmpregareVaga | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    resetDialog();
    setEditOpen(false);
  }, [companyId]);

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
      if (vacancyFields.length > 0 && vacancyId) await saveFields(vacancyId, vacancyFields);
      toast.success("Vaga criada com sucesso!");
      resetDialog();
    } catch (e: any) {
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
    if (!editVacancyId || !editForm.title.trim()) { toast.error("Informe o título."); return; }
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
      toast.error(e.message || "Erro ao atualizar.");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = (id: string, title: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteTargetId(id);
    setDeleteTargetTitle(title);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await deleteVacancy(deleteTargetId);
      toast.success("Vaga excluída!");
      setDeleteConfirmOpen(false);
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSync = async () => {
    try {
      const result = await sync("all");
      toast.success(`Sincronização concluída! ${result?.results?.vagas?.total ?? 0} vagas processadas.`);
    } catch (e: any) {
      toast.error(e.message || "Erro na sincronização.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Recrutamento</h1>
          <div className="flex items-center gap-3">
            <RecrutamentoStats {...stats} />
            {lastSync && (
              <span className="text-[10px] text-muted-foreground/60 ml-2">
                Sync: {new Date(lastSync).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}
            className="transition-all duration-300 hover:border-primary/40">
            <RefreshCw className={cn("h-4 w-4 mr-1.5", syncing && "animate-spin")} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="shadow-[0_0_15px_-5px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)] transition-shadow duration-300">
            <Plus className="h-4 w-4 mr-1.5" /> Nova Vaga
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="empregare" className="data-[state=active]:shadow-sm transition-all duration-200">
            Empregare
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{empregareVagas.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="local" className="data-[state=active]:shadow-sm transition-all duration-200">
            Vagas Internas
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{vacancies.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Empregare tab */}
        <TabsContent value="empregare">
          {empLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : empregareVagas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Briefcase className="h-10 w-10 mb-3 opacity-40" />
              <p className="font-medium">Nenhuma vaga sincronizada</p>
              <p className="text-sm">Clique em "Sincronizar" para importar vagas do Empregare.</p>
            </div>
          ) : (
            <EmpregareVagasList
              vagas={empregareVagas}
              onSelect={(v) => {
                setSelectedVaga(v);
                setDrawerOpen(true);
              }}
            />
          )}
        </TabsContent>

        {/* Local tab */}
        <TabsContent value="local">
          {localLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
            </div>
          ) : vacancies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Briefcase className="h-10 w-10 mb-3 opacity-40" />
              <p className="font-medium">Nenhuma vaga cadastrada</p>
              <p className="text-sm">Clique em "+ Nova Vaga" para começar.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vacancies.map((v, i) => {
                const sc = statusConfig[v.status] || statusConfig.aberta;
                return (
                  <div
                    key={v.id}
                    className="group relative p-5 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm
                      hover:border-primary/30 hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.15)]
                      cursor-pointer transition-all duration-300 ease-out space-y-3 animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                    onClick={() => navigate(`/recrutamento/vagas/${v.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200">{v.title}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => openEdit(v, e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                      {v.departments?.name && (
                        <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {v.departments.name}</span>
                      )}
                      <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {workModelLabels[v.work_model]}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/30">
                      <span className="flex items-center gap-1.5 font-medium text-primary/80">
                        <Users className="h-3.5 w-3.5" />
                        {v.candidate_count ?? 0} candidato{(v.candidate_count ?? 0) !== 1 ? "s" : ""}
                      </span>
                      <span className="text-muted-foreground/60">
                        {v.opened_at ? new Date(v.opened_at + "T00:00:00").toLocaleDateString("pt-BR") : new Date(v.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Empregare Drawer */}
      <EmpregareVagaDrawer
        vaga={selectedVaga}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        fetchKanbanCards={fetchKanbanCards}
        upsertKanbanCard={upsertKanbanCard}
      />

      {/* Create vacancy dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Vaga {step === 2 ? "— Campos" : ""}</DialogTitle>
            <DialogDescription>{step === 1 ? "Preencha os dados básicos da vaga." : "Adicione campos personalizados (opcional)."}</DialogDescription>
          </DialogHeader>
          {step === 1 ? (
            <VacancyFormFields formData={form} setFormData={setForm} departments={departments} />
          ) : (
            <VacancyFieldsEditor fields={vacancyFields} onChange={setVacancyFields} />
          )}
          <DialogFooter>
            {step === 2 && <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>}
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
          <VacancyFormFields formData={editForm} setFormData={setEditForm} showStatus departments={departments} />
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="destructive" size="sm" onClick={() => confirmDelete(editVacancyId!, editForm.title)}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleEditSave} disabled={editSaving}>{editSaving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vaga "{deleteTargetTitle}"?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível. Todos os candidatos e campos serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
