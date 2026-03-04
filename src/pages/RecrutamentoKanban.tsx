import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCandidates, type CandidateStage, type Candidate } from "@/hooks/useCandidates";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

const STAGES: { id: CandidateStage; label: string; color: string }[] = [
  { id: "novos", label: "Novos", color: "hsl(var(--primary))" },
  { id: "triagem", label: "Triagem", color: "hsl(var(--warning))" },
  { id: "entrevista_rh", label: "Ent. RH", color: "hsl(var(--info))" },
  { id: "entrevista_gestor", label: "Ent. Gestor", color: "hsl(var(--chart-4))" },
  { id: "aprovado", label: "Aprovado", color: "hsl(var(--success))" },
];

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function CandidateCard({ candidate, isDragging }: { candidate: Candidate; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: candidate.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2.5">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
            {getInitials(candidate.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{candidate.name}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(candidate.created_at), "dd MMM yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>
    </div>
  );
}

function CandidateOverlay({ candidate }: { candidate: Candidate }) {
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg cursor-grabbing w-64">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
            {getInitials(candidate.name)}
          </AvatarFallback>
        </Avatar>
        <p className="font-medium text-sm truncate">{candidate.name}</p>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, candidates }: { stage: typeof STAGES[number]; candidates: Candidate[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex flex-col min-w-[240px] w-[260px] shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="font-semibold text-sm">{stage.label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{candidates.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 p-2 rounded-lg border border-dashed min-h-[200px] transition-colors ${
          isOver ? "bg-primary/5 border-primary/40" : "bg-muted/30 border-transparent"
        }`}
      >
        <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function RecrutamentoKanban() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { candidates, loading, createCandidate, updateStage } = useCandidates(id!);
  const [vacancyTitle, setVacancyTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);

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

    // If dropped on another candidate, find that candidate's stage
    if (!STAGES.find((s) => s.id === targetStage)) {
      const targetCandidate = candidates.find((c) => c.id === targetStage);
      if (targetCandidate) targetStage = targetCandidate.stage;
      else return;
    }

    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.stage === targetStage) return;

    try {
      await updateStage(candidateId, targetStage as CandidateStage);
    } catch (e: any) {
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
              <KanbanColumn key={stage.id} stage={stage} candidates={candidates.filter((c) => c.stage === stage.id)} />
            ))}
          </div>
          <DragOverlay>
            {activeCandidate ? <CandidateOverlay candidate={activeCandidate} /> : null}
          </DragOverlay>
        </DndContext>
      )}

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
    </div>
  );
}
