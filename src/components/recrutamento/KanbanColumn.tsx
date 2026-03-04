import { GripVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Candidate, CandidateStage } from "@/hooks/useCandidates";

export const STAGES: { id: CandidateStage; label: string; color: string }[] = [
  { id: "novos", label: "Novos", color: "hsl(var(--primary))" },
  { id: "triagem", label: "Triagem", color: "hsl(var(--warning))" },
  { id: "entrevista_rh", label: "Ent. RH", color: "hsl(var(--info))" },
  { id: "entrevista_gestor", label: "Ent. Gestor", color: "hsl(var(--chart-4))" },
  { id: "aprovado", label: "Aprovado", color: "hsl(var(--success))" },
];

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function CandidateCard({ candidate, onCandidateClick }: { candidate: Candidate; onCandidateClick?: (c: Candidate) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: candidate.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2.5">
        <div {...attributes} {...listeners} className="shrink-0">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
        <div
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onCandidateClick?.(candidate); }}
        >
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
    </div>
  );
}

interface KanbanColumnProps {
  stage: typeof STAGES[number];
  candidates: Candidate[];
  onCandidateClick?: (c: Candidate) => void;
}

export default function KanbanColumn({ stage, candidates, onCandidateClick }: KanbanColumnProps) {
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
            <CandidateCard key={c.id} candidate={c} onCandidateClick={onCandidateClick} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
