import { useState, useEffect, useCallback } from "react";
import { Plus, GripVertical, ExternalLink, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import type { EmpregareVaga, EmpregareKanbanCard } from "@/hooks/useEmpregareVagas";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ── Sortable Card ──
function KanbanCard({ card, onClick }: { card: EmpregareKanbanCard; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="shrink-0">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
              {getInitials(card.nome)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-xs truncate">{card.nome}</p>
            {card.email && <p className="text-[10px] text-muted-foreground truncate">{card.email}</p>}
          </div>
        </div>
        {card.origem === "api" && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 border-primary/30 text-primary">API</Badge>
        )}
      </div>
    </div>
  );
}

// ── Column ──
function EtapaColumn({
  etapa,
  cards,
  apiCount,
  onCardClick,
  onAddCard,
}: {
  etapa: { nome: string; ordem: number };
  cards: EmpregareKanbanCard[];
  apiCount: number;
  onCardClick: (card: EmpregareKanbanCard) => void;
  onAddCard: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.nome });

  return (
    <div className="flex flex-col min-w-[220px] w-[240px] shrink-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="font-semibold text-xs">{etapa.nome}</span>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{cards.length}</span>
        {apiCount > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto border-info/30 text-info">{apiCount} Empregare</Badge>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-1.5 p-2 rounded-lg border border-dashed min-h-[160px] transition-colors ${
          isOver ? "bg-primary/5 border-primary/40" : "bg-muted/30 border-transparent"
        }`}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <KanbanCard key={c.id} card={c} onClick={() => onCardClick(c)} />
          ))}
        </SortableContext>
        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground h-7" onClick={onAddCard}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

// ── Main Drawer ──
interface Props {
  vaga: EmpregareVaga | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchKanbanCards: (empregareVagaId: number) => Promise<EmpregareKanbanCard[]>;
  upsertKanbanCard: (card: any) => Promise<void>;
}

export default function EmpregareVagaDrawer({ vaga, open, onOpenChange, fetchKanbanCards, upsertKanbanCard }: Props) {
  const [cards, setCards] = useState<EmpregareKanbanCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addEtapa, setAddEtapa] = useState("");
  const [addForm, setAddForm] = useState({ nome: "", email: "", telefone: "", observacao: "" });
  const [saving, setSaving] = useState(false);
  const [activeCard, setActiveCard] = useState<EmpregareKanbanCard | null>(null);
  const [detailCard, setDetailCard] = useState<EmpregareKanbanCard | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [candidatoDetail, setCandidatoDetail] = useState<any>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadCards = useCallback(async () => {
    if (!vaga) return;
    setLoadingCards(true);
    const data = await fetchKanbanCards(vaga.empregare_id);
    setCards(data);
    setLoadingCards(false);
  }, [vaga, fetchKanbanCards]);

  useEffect(() => {
    if (open && vaga) loadCards();
  }, [open, vaga, loadCards]);

  // Build etapas from vaga
  const etapas = (vaga?.etapas || [])
    .filter((e: any) => {
      const nome = (e.nome ?? e.Nome ?? "").toLowerCase();
      return nome !== "todos" && nome !== "all";
    })
    .map((e: any, i: number) => ({
      nome: e.nome ?? e.Nome ?? `Etapa ${i + 1}`,
      ordem: e.ordem ?? e.Ordem ?? i,
      apiCount: e.qntde ?? e.Qntde ?? e.qtd ?? 0,
    }))
    .sort((a: any, b: any) => a.ordem - b.ordem);

  // Fallback if no etapas
  if (etapas.length === 0) {
    etapas.push(
      { nome: "Interessados", ordem: 1, apiCount: 0 },
      { nome: "Triados", ordem: 2, apiCount: 0 },
      { nome: "Entrevistados", ordem: 3, apiCount: 0 },
      { nome: "Contratados", ordem: 4, apiCount: 0 },
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    const c = cards.find((c) => c.id === event.active.id);
    if (c) setActiveCard(c);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    let targetEtapa = over.id as string;

    // Check if dropped on a card rather than a column
    const isColumn = etapas.some((e: any) => e.nome === targetEtapa);
    if (!isColumn) {
      const targetCard = cards.find((c) => c.id === targetEtapa);
      if (targetCard) targetEtapa = targetCard.etapa_atual;
      else return;
    }

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.etapa_atual === targetEtapa) return;

    // Optimistic update
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, etapa_atual: targetEtapa, data_entrada_etapa: new Date().toISOString() } : c));

    try {
      await upsertKanbanCard({
        id: card.id,
        empregare_vaga_id: card.empregare_vaga_id,
        nome: card.nome,
        etapa_atual: targetEtapa,
        etapa_ordem: etapas.findIndex((e: any) => e.nome === targetEtapa),
        data_entrada_etapa: new Date().toISOString(),
      });
    } catch {
      toast.error("Erro ao mover candidato.");
      loadCards();
    }
  };

  const handleAddCard = async () => {
    if (!addForm.nome.trim()) { toast.error("Informe o nome."); return; }
    if (!vaga) return;
    setSaving(true);
    try {
      await upsertKanbanCard({
        empregare_vaga_id: vaga.empregare_id,
        nome: addForm.nome.trim(),
        email: addForm.email || null,
        telefone: addForm.telefone || null,
        etapa_atual: addEtapa,
        etapa_ordem: etapas.findIndex((e: any) => e.nome === addEtapa),
        observacao: addForm.observacao || null,
        origem: "manual",
      });
      toast.success("Candidato adicionado!");
      setAddDialogOpen(false);
      setAddForm({ nome: "", email: "", telefone: "", observacao: "" });
      loadCards();
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar.");
    } finally {
      setSaving(false);
    }
  };

  const openCardDetail = async (card: EmpregareKanbanCard) => {
    setDetailCard(card);
    setCandidatoDetail(null);
    setDetailOpen(true);

    // If from API, load full candidato data
    if (card.empregare_pessoa_id) {
      const { data } = await supabase
        .from("empregare_candidatos")
        .select("*")
        .eq("empregare_pessoa_id", card.empregare_pessoa_id)
        .maybeSingle();
      if (data) setCandidatoDetail(data);
    }
  };

  if (!vaga) return null;

  const empregareUrl = `https://corporate.empregare.com/vaga/${vaga.empregare_id}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[90vw] lg:max-w-[80vw] p-0 flex flex-col">
        <SheetHeader className="p-5 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-lg truncate">{vaga.titulo}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1 text-xs">
                {vaga.cidade && <span>{vaga.cidade}{vaga.estado ? ` - ${vaga.estado}` : ""}</span>}
                {vaga.situacao && <Badge variant="outline" className="text-[10px]">{vaga.situacao}</Badge>}
                {vaga.total_vagas > 1 && <span>· {vaga.total_vagas} posições</span>}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a href={empregareUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Empregare
              </a>
            </Button>
          </div>
          {/* Beneficios */}
          {vaga.beneficios?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {vaga.beneficios.map((b: any, i: number) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{b.nome ?? b.Nome ?? b}</Badge>
              ))}
            </div>
          )}
        </SheetHeader>

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto p-4">
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 h-full">
              {etapas.map((etapa: any) => (
                <EtapaColumn
                  key={etapa.nome}
                  etapa={etapa}
                  cards={cards.filter((c) => c.etapa_atual === etapa.nome)}
                  apiCount={etapa.apiCount}
                  onCardClick={openCardDetail}
                  onAddCard={() => {
                    setAddEtapa(etapa.nome);
                    setAddDialogOpen(true);
                  }}
                />
              ))}
            </div>
            <DragOverlay>
              {activeCard ? (
                <div className="bg-card border rounded-lg p-3 shadow-lg cursor-grabbing w-56">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                        {getInitials(activeCard.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium text-xs truncate">{activeCard.nome}</p>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Add candidate dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Candidato — {addEtapa}</DialogTitle>
              <DialogDescription>Adicione um candidato manualmente a esta etapa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={addForm.nome} onChange={(e) => setAddForm({ ...addForm, nome: e.target.value })} placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={addForm.telefone} onChange={(e) => setAddForm({ ...addForm, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observação</Label>
                <Textarea value={addForm.observacao} onChange={(e) => setAddForm({ ...addForm, observacao: e.target.value })} placeholder="Notas sobre o candidato..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddCard} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Card detail sheet */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {detailCard?.nome}
              </SheetTitle>
              <SheetDescription>
                {detailCard?.origem === "api" ? "Dados do Empregare" : "Candidato manual"}
              </SheetDescription>
            </SheetHeader>
            {detailCard && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm"><strong>Etapa:</strong> {detailCard.etapa_atual}</p>
                  {detailCard.email && <p className="text-sm"><strong>E-mail:</strong> {detailCard.email}</p>}
                  {detailCard.telefone && <p className="text-sm"><strong>Telefone:</strong> {detailCard.telefone}</p>}
                  {detailCard.observacao && <p className="text-sm"><strong>Observação:</strong> {detailCard.observacao}</p>}
                </div>

                {candidatoDetail && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm">Dados Empregare</h4>
                      {candidatoDetail.cidade && <p className="text-sm"><strong>Cidade:</strong> {candidatoDetail.cidade}{candidatoDetail.estado ? ` - ${candidatoDetail.estado}` : ""}</p>}
                      {candidatoDetail.data_contratacao && <p className="text-sm"><strong>Data Contratação:</strong> {new Date(candidatoDetail.data_contratacao).toLocaleDateString("pt-BR")}</p>}

                      {/* Marcadores */}
                      {candidatoDetail.marcadores && (() => {
                        const marcadores = typeof candidatoDetail.marcadores === "string" ? JSON.parse(candidatoDetail.marcadores) : candidatoDetail.marcadores;
                        return marcadores.length > 0 ? (
                          <div>
                            <p className="text-sm font-medium mb-1">Marcadores:</p>
                            <div className="flex flex-wrap gap-1">
                              {marcadores.map((m: any, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{m.nome ?? m.Nome ?? m}</Badge>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Currículo */}
                      {candidatoDetail.curriculo_json && (() => {
                        const cv = typeof candidatoDetail.curriculo_json === "string" ? JSON.parse(candidatoDetail.curriculo_json) : candidatoDetail.curriculo_json;
                        return (
                          <div className="space-y-3">
                            {cv.sintese && (
                              <div>
                                <p className="text-sm font-medium">Síntese:</p>
                                <p className="text-xs text-muted-foreground">{cv.sintese}</p>
                              </div>
                            )}
                            {cv.experiencia?.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-1">Experiência:</p>
                                {cv.experiencia.map((exp: any, i: number) => (
                                  <div key={i} className="mb-2 pl-3 border-l-2 border-primary/20">
                                    <p className="text-xs font-medium">{exp.cargo ?? exp.Cargo}</p>
                                    <p className="text-[10px] text-muted-foreground">{exp.empresa ?? exp.Empresa}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {cv.formacao?.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-1">Formação:</p>
                                {cv.formacao.map((f: any, i: number) => (
                                  <div key={i} className="mb-1 pl-3 border-l-2 border-success/20">
                                    <p className="text-xs font-medium">{f.curso ?? f.Curso}</p>
                                    <p className="text-[10px] text-muted-foreground">{f.local ?? f.Local}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {candidatoDetail.curriculo_url && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={candidatoDetail.curriculo_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Download Currículo
                                </a>
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </SheetContent>
    </Sheet>
  );
}
