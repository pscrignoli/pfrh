import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Settings2, Download } from "lucide-react";
import { exportCandidatesExcel } from "@/utils/exportCandidatesExcel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCandidates, type Candidate } from "@/hooks/useCandidates";
import { useVacancyFields, type VacancyField } from "@/hooks/useVacancyFields";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import KanbanColumn, { STAGES } from "@/components/recrutamento/KanbanColumn";
import CandidateOverlay from "@/components/recrutamento/CandidateOverlay";
import CandidateDetailModal from "@/components/recrutamento/CandidateDetailModal";
import VacancyFieldsEditor from "@/components/recrutamento/VacancyFieldsEditor";

export default function RecrutamentoKanban() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { candidates, loading, createCandidate, updateStage, refetch } = useCandidates(id!);
  const { fields, saveFields, refetch: refetchFields } = useVacancyFields(id);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);

  // Candidate detail modal
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Edit fields modal
  const [editFieldsOpen, setEditFieldsOpen] = useState(false);
  const [editFields, setEditFields] = useState<VacancyField[]>([]);
  const [savingFields, setSavingFields] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!id) return;
    supabase.from("vacancies").select("title").eq("id", id).single().then(({ data }) => {
      if (data) setVacancyTitle(data.title);
    });
  }, [id]);

  const handleDragStart = (event: DragStartEvent) => {
    const c = candidates.find((c) => c.id === event.active.id);
    if (c) setActiveCandidate(c);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCandidate(null);
    const { active, over } = event;
    if (!over) return;

    const candidateId = active.id as string;
    let targetStage = over.id as string;

    if (!STAGES.find((s) => s.id === targetStage)) {
      const targetCandidate = candidates.find((c) => c.id === targetStage);
      if (targetCandidate) targetStage = targetCandidate.stage;
      else return;
    }

    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage === targetStage) return;

    try {
      await updateStage(candidateId, targetStage as any);
    } catch {
      toast.error("Erro ao mover candidato.");
    }
  };

  const handleCreateCandidate = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do candidato."); return; }
    setSaving(true);
    try {
      await createCandidate({ name: form.name.trim(), email: form.email || undefined, phone: form.phone || undefined });
      toast.success("Candidato adicionado!");
      setForm({ name: "", email: "", phone: "" });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar candidato.");
    } finally {
      setSaving(false);
    }
  };

  const handleCandidateClick = (candidate: Candidate) => {
    setDetailCandidate(candidate);
    setDetailOpen(true);
  };

  const openEditFields = () => {
    setEditFields([...fields]);
    setEditFieldsOpen(true);
  };

  const handleSaveFields = async () => {
    if (!id) return;
    setSavingFields(true);
    try {
      await saveFields(id, editFields);
      toast.success("Campos atualizados!");
      setEditFieldsOpen(false);
      refetchFields();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar campos.");
    } finally {
      setSavingFields(false);
    }
  };

  return (
    <div className="p-6 space-y-5 h-full flex flex-col">
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/recrutamento")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{vacancyTitle || "Carregando..."}</h1>
          <p className="text-muted-foreground text-sm">{candidates.length} candidato{candidates.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await exportCandidatesExcel({ vacancyId: id!, vacancyTitle: vacancyTitle });
              toast.success("Excel exportado!");
            } catch (e: any) {
              toast.error(e.message || "Erro ao exportar.");
            }
          }}
        >
          <Download className="h-4 w-4 mr-1" /> Exportar Excel
        </Button>
        <Button variant="outline" size="sm" onClick={openEditFields}>
          <Settings2 className="h-4 w-4 mr-1" /> Editar Campos
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Candidato
        </Button>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {STAGES.map((s) => <Skeleton key={s.id} className="min-w-[240px] h-[300px] rounded-lg" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                candidates={candidates.filter((c) => c.stage === stage.id)}
                onCandidateClick={handleCandidateClick}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCandidate ? <CandidateOverlay candidate={activeCandidate} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* New candidate dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Candidato</DialogTitle>
            <DialogDescription>Preencha os dados do candidato.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCandidate} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Candidate detail modal */}
      <CandidateDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        candidate={detailCandidate}
        vacancyId={id!}
        onSaved={() => refetch()}
      />

      {/* Edit vacancy fields modal */}
      <Dialog open={editFieldsOpen} onOpenChange={setEditFieldsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Campos da Vaga</DialogTitle>
            <DialogDescription>
              {candidates.length > 0
                ? "⚠️ Candidatos existentes podem perder dados ao remover campos."
                : "Adicione campos personalizados para esta vaga."}
            </DialogDescription>
          </DialogHeader>
          <VacancyFieldsEditor fields={editFields} onChange={setEditFields} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFieldsOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFields} disabled={savingFields}>
              {savingFields ? "Salvando..." : "Salvar Campos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
