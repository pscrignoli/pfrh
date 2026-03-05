import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink, MapPin, Clock, Calendar, Users, DollarSign, Briefcase,
  ChevronDown, ChevronUp, Plus, User, Award, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { EmpregareVaga } from "@/hooks/useEmpregareVagas";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ── Funnel colors: gradient from primary to success ──
const FUNNEL_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
];

function getFunnelColor(index: number, total: number, isContratado: boolean) {
  if (isContratado) return "hsl(var(--success))";
  if (total <= 1) return FUNNEL_COLORS[0];
  const ratio = index / (total - 1);
  const colorIndex = Math.min(Math.floor(ratio * (FUNNEL_COLORS.length - 1)), FUNNEL_COLORS.length - 2);
  return FUNNEL_COLORS[colorIndex];
}

// ── Types ──
interface EtapaData {
  nome: string;
  count: number;
  percent: number;
  ordem: number;
}

interface Props {
  vaga: EmpregareVaga | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Custom Tooltip ──
function FunnelTooltip({ active, payload, funnelData }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as EtapaData;
  const idx = funnelData.findIndex((d: EtapaData) => d.nome === data.nome);
  const prev = idx > 0 ? funnelData[idx - 1] : null;
  const conversionRate = prev && prev.count > 0
    ? ((data.count / prev.count) * 100).toFixed(1)
    : null;

  return (
    <div className="bg-popover border border-border/60 rounded-lg p-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-sm">{data.nome}</p>
      <p className="text-muted-foreground">{data.count} candidato{data.count !== 1 ? "s" : ""} · {data.percent.toFixed(1)}%</p>
      {conversionRate && (
        <p className="text-primary font-medium">
          Conversão da etapa anterior: {conversionRate}%
        </p>
      )}
    </div>
  );
}

// ── Custom Bar Label ──
function renderBarLabel(props: any) {
  const { x, y, width, height, value, name, percent } = props;
  if (width < 30) return null;
  return (
    <text x={x + 8} y={y + height / 2} dy={4} fill="hsl(var(--primary-foreground))" fontSize={11} fontWeight={600}>
      {value}
    </text>
  );
}

export default function EmpregareVagaDrawer({ vaga, open, onOpenChange }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ nome: "", email: "", telefone: "", observacao: "" });
  const [saving, setSaving] = useState(false);
  const [contratadoDetail, setContratadoDetail] = useState<any>(null);
  const [contratadoModalOpen, setContratadoModalOpen] = useState(false);

  if (!vaga) return null;

  // ── Parse etapas for funnel ──
  const rawEtapas = (vaga.etapas || []) as any[];
  const todosEtapa = rawEtapas.find((e: any) => {
    const nome = (e.nome ?? e.Nome ?? "").toLowerCase();
    return nome === "todos" || nome === "all";
  });
  const totalCandidatos = Number(todosEtapa?.qntde ?? todosEtapa?.Qntde ?? todosEtapa?.qtd ?? 0) || 0;

  const funnelData: EtapaData[] = rawEtapas
    .filter((e: any) => {
      const nome = (e.nome ?? e.Nome ?? "").toLowerCase();
      return nome !== "todos" && nome !== "all";
    })
    .map((e: any, i: number) => {
      const count = Number(e.qntde ?? e.Qntde ?? e.qtd ?? e.totalCandidatos ?? 0) || 0;
      return {
        nome: e.nome ?? e.Nome ?? `Etapa ${i + 1}`,
        count,
        percent: totalCandidatos > 0 ? (count / totalCandidatos) * 100 : 0,
        ordem: e.ordem ?? e.Ordem ?? i,
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  // ── Contratados count ──
  const contratadosEtapa = funnelData.find((e) => e.nome.toLowerCase().includes("contratad"));
  const contratadosCount = contratadosEtapa?.count ?? 0;

  // ── Metrics ──
  const sit = (vaga.situacao ?? "").toLowerCase();
  const dataCadastro = vaga.data_cadastro ? parseISO(vaga.data_cadastro) : null;
  const metaEncerramento = vaga.meta_encerramento ? parseISO(vaga.meta_encerramento) : null;
  const diasAberta = dataCadastro ? differenceInDays(new Date(), dataCadastro) : null;
  const taxaConversao = totalCandidatos > 0 && contratadosCount > 0
    ? ((contratadosCount / totalCandidatos) * 100).toFixed(1)
    : "0";

  // ── Salary ──
  const salarioText = vaga.salario_combinar
    ? "A combinar"
    : vaga.salario_min || vaga.salario_max
      ? `R$ ${(vaga.salario_min ?? 0).toLocaleString("pt-BR")}${vaga.salario_max ? ` - R$ ${vaga.salario_max.toLocaleString("pt-BR")}` : ""}`
      : "A combinar";

  // ── Responsaveis ──
  const responsaveis = (vaga.responsaveis || []) as any[];

  // ── Requisição (from raw_json if available) ──
  const rawJson = (vaga as any).raw_json;
  const requisicao = rawJson?.requisicao ?? rawJson?.Requisicao ?? null;
  const aprovacoes = requisicao?.aprovacoes ?? requisicao?.Aprovacoes ?? [];
  const motivoAbertura = requisicao?.motivoAberturaDescricao ?? requisicao?.MotivoAberturaDescricao ?? null;
  const substituto = requisicao?.substituirNome ?? requisicao?.SubstituirNome ?? null;

  const empregareUrl = `https://corporate.empregare.com/vaga/${vaga.empregare_id}`;

  const handleAddCandidate = async () => {
    if (!addForm.nome.trim()) { toast.error("Informe o nome."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("empregare_candidatos").insert({
        empregare_pessoa_id: -Date.now(), // negative = manual
        empregare_vaga_id: vaga.empregare_id,
        nome: addForm.nome.trim(),
        email: addForm.email || null,
        telefone: addForm.telefone || null,
        status: "manual",
        company_id: vaga.company_id,
      } as any);
      if (error) throw error;
      toast.success("Candidato adicionado!");
      setAddDialogOpen(false);
      setAddForm({ nome: "", email: "", telefone: "", observacao: "" });
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar.");
    } finally {
      setSaving(false);
    }
  };

  const openContratadoDetail = async (empregareVagaId: number) => {
    const { data } = await supabase
      .from("empregare_candidatos")
      .select("*")
      .eq("empregare_vaga_id", empregareVagaId)
      .not("data_contratacao", "is", null)
      .order("data_contratacao", { ascending: false });
    if (data && data.length > 0) {
      setContratadoDetail(data);
      setContratadoModalOpen(true);
    } else {
      toast.info("Nenhum dado detalhado de contratados disponível.");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]]:!overflow-y-scroll">
            <div className="p-6 pb-10 space-y-6">

              {/* ═══════════ HEADER ═══════════ */}
              <div className="space-y-4">
                <SheetHeader className="p-0">
                  <SheetTitle className="text-xl font-bold leading-tight">{vaga.titulo}</SheetTitle>
                  <SheetDescription className="sr-only">Detalhes da vaga {vaga.titulo}</SheetDescription>
                </SheetHeader>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className={sit === "aberta"
                      ? "bg-success/10 text-success border-success/30"
                      : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30"}
                  >
                    {vaga.situacao ?? "—"}
                  </Badge>
                  {vaga.tipo_recrutamento && (
                    <Badge variant="secondary" className="text-[10px]">{vaga.tipo_recrutamento}</Badge>
                  )}
                  {vaga.trabalho_remoto && vaga.trabalho_remoto !== "Nenhum" && (
                    <Badge variant="secondary" className="text-[10px]">{vaga.trabalho_remoto}</Badge>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  {vaga.cidade && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary/60" />
                      {vaga.cidade}{vaga.estado ? ` - ${vaga.estado}` : ""}
                    </span>
                  )}
                  {vaga.horario && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary/60" />
                      {vaga.horario}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-primary/60" />
                    {salarioText}
                  </span>
                  {dataCadastro && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary/60" />
                      Cadastro: {format(dataCadastro, "dd/MM/yyyy")}
                    </span>
                  )}
                  {metaEncerramento && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-warning/80" />
                      Meta: {format(metaEncerramento, "dd/MM/yyyy")}
                    </span>
                  )}
                  {vaga.total_vagas > 1 && (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary/60" />
                      {vaga.total_vagas} posições
                    </span>
                  )}
                </div>

                {/* Responsáveis */}
                {responsaveis.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Responsáveis:</span>
                    <div className="flex -space-x-2">
                      {responsaveis.slice(0, 5).map((r: any, i: number) => {
                        const nome = r.nome ?? r.Nome ?? "?";
                        return (
                          <Avatar key={i} className="h-7 w-7 border-2 border-background">
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                              {getInitials(nome)}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {responsaveis.map((r: any) => r.nome ?? r.Nome).filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}

                {/* External link */}
                <Button variant="outline" size="sm" asChild className="w-fit">
                  <a href={empregareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir no Empregare
                  </a>
                </Button>
              </div>

              <Separator />

              {/* ═══════════ FUNIL VISUAL ═══════════ */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Funil de Candidatos
                  {totalCandidatos > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-1">{totalCandidatos} total</Badge>
                  )}
                </h3>

                {funnelData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de etapas disponíveis.</p>
                ) : (
                  <div className="space-y-1.5">
                    {funnelData.map((etapa, i) => {
                      const isContratado = etapa.nome.toLowerCase().includes("contratad");
                      const maxCount = Math.max(...funnelData.map(e => e.count), 1);
                      const barWidth = Math.max((etapa.count / maxCount) * 100, 4);
                      const color = getFunnelColor(i, funnelData.length, isContratado);

                      return (
                        <div
                          key={etapa.nome}
                          className="group flex items-center gap-3 animate-fade-in"
                          style={{ animationDelay: `${i * 80}ms` }}
                        >
                          <span className="text-xs text-muted-foreground w-28 text-right truncate shrink-0">
                            {etapa.nome}
                          </span>
                          <div className="flex-1 relative h-8">
                            <div
                              className="absolute inset-y-0 left-0 rounded-r-lg transition-all duration-700 ease-out flex items-center"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: color,
                                boxShadow: isContratado
                                  ? `0 0 12px hsl(var(--success) / 0.4)`
                                  : `0 2px 8px ${color}33`,
                                animationFillMode: "both",
                              }}
                            >
                              {etapa.count > 0 && barWidth > 10 && (
                                <span className="text-[11px] font-bold text-white ml-2.5 drop-shadow-sm">
                                  {etapa.count}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 w-20">
                            <span className="text-sm font-bold tabular-nums">
                              {etapa.count}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({etapa.percent.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* ═══════════ MÉTRICAS ═══════════ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Candidatos", value: totalCandidatos, icon: Users },
                  { label: "Taxa Conversão", value: `${taxaConversao}%`, icon: Award },
                  { label: "Dias Aberta", value: diasAberta ?? "—", icon: Calendar },
                  { label: "Contratados", value: contratadosCount, icon: CheckCircle2 },
                ].map((m, i) => (
                  <div
                    key={m.label}
                    className="bg-muted/40 rounded-lg p-3 text-center space-y-1 animate-fade-in"
                    style={{ animationDelay: `${i * 60 + 300}ms` }}
                  >
                    <m.icon className="h-4 w-4 mx-auto text-primary/60" />
                    <p className="text-lg font-bold tabular-nums">{m.value}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* ═══════════ CONTRATADOS (se houver) ═══════════ */}
              {contratadosCount > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        Contratados
                      </h3>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => openContratadoDetail(vaga.empregare_id)}>
                        Ver detalhes
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {contratadosCount} candidato{contratadosCount !== 1 ? "s" : ""} contratado{contratadosCount !== 1 ? "s" : ""} nesta vaga.
                    </p>
                  </div>
                </>
              )}


              <Separator />

              {/* ═══════════ DETALHES DA VAGA (colapsável) ═══════════ */}
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group cursor-pointer py-1">
                  <h3 className="font-semibold text-sm">Detalhes da Vaga</h3>
                  {detailsOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-3 animate-fade-in">
                  {/* Descrição */}
                  {vaga.descricao && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Descrição</p>
                      <div
                        className="text-sm prose prose-sm max-w-none [&>*]:my-1"
                        dangerouslySetInnerHTML={{ __html: vaga.descricao }}
                      />
                    </div>
                  )}

                  {/* Requisitos */}
                  {vaga.requisitos && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Requisitos</p>
                      <div
                        className="text-sm prose prose-sm max-w-none [&>*]:my-1"
                        dangerouslySetInnerHTML={{ __html: vaga.requisitos }}
                      />
                    </div>
                  )}

                  {/* Benefícios */}
                  {vaga.beneficios?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Benefícios</p>
                      <div className="flex flex-wrap gap-1.5">
                        {vaga.beneficios.map((b: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {b.nome ?? b.Nome ?? b.descricao ?? b}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Motivo */}
                  {motivoAbertura && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Motivo de Abertura</p>
                      <p className="text-sm">{motivoAbertura}</p>
                      {substituto && (
                        <p className="text-xs text-muted-foreground">Substituindo: {substituto}</p>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* ═══════════ TIMELINE DE APROVAÇÃO ═══════════ */}
              {aprovacoes.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Timeline de Aprovação</h3>
                    <div className="relative pl-5 space-y-4">
                      {/* Vertical line */}
                      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
                      {aprovacoes.map((a: any, i: number) => {
                        const nome = a.nome ?? a.Nome ?? a.aprovador ?? `Nível ${i + 1}`;
                        const dataAprov = a.dataAprovacao ?? a.DataAprovacao ?? null;
                        const aprovado = a.aprovado ?? a.Aprovado ?? !!dataAprov;
                        return (
                          <div key={i} className="relative flex items-start gap-3 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                            <div className={`absolute -left-5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                              aprovado ? "bg-success" : "bg-muted-foreground/30"
                            }`} style={aprovado ? { boxShadow: "0 0 8px hsl(var(--success) / 0.5)" } : {}} />
                            <div>
                              <p className="text-sm font-medium">{nome}</p>
                              {dataAprov && (
                                <p className="text-[11px] text-muted-foreground">
                                  Aprovado em {format(parseISO(dataAprov), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ═══ Add candidate dialog ═══ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Candidato Manual</DialogTitle>
            <DialogDescription>Registre um candidato que veio por indicação ou canal externo.</DialogDescription>
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
              <Textarea value={addForm.observacao} onChange={(e) => setAddForm({ ...addForm, observacao: e.target.value })} placeholder="Notas..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCandidate} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Contratados detail modal ═══ */}
      <Dialog open={contratadoModalOpen} onOpenChange={setContratadoModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidatos Contratados</DialogTitle>
            <DialogDescription>Detalhes dos contratados nesta vaga.</DialogDescription>
          </DialogHeader>
          {contratadoDetail && contratadoDetail.length > 0 ? (
            <div className="space-y-4">
              {contratadoDetail.map((c: any) => {
                const cv = c.curriculo_json
                  ? (typeof c.curriculo_json === "string" ? JSON.parse(c.curriculo_json) : c.curriculo_json)
                  : null;
                return (
                  <div key={c.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-success/10 text-success text-xs font-semibold">
                          {getInitials(c.nome ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{c.nome}</p>
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                      </div>
                    </div>
                    {c.telefone && <p className="text-xs"><strong>Telefone:</strong> {c.telefone}</p>}
                    {c.data_contratacao && (
                      <p className="text-xs"><strong>Data Contratação:</strong> {new Date(c.data_contratacao).toLocaleDateString("pt-BR")}</p>
                    )}
                    {cv?.sintese && (
                      <div>
                        <p className="text-xs font-medium mt-2">Síntese</p>
                        <p className="text-xs text-muted-foreground">{cv.sintese}</p>
                      </div>
                    )}
                    {cv?.experiencia?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mt-2">Experiência</p>
                        {cv.experiencia.slice(0, 3).map((exp: any, i: number) => (
                          <p key={i} className="text-[11px] text-muted-foreground">
                            • {exp.cargo ?? exp.Cargo ?? ""} — {exp.empresa ?? exp.Empresa ?? ""}
                          </p>
                        ))}
                      </div>
                    )}
                    {cv?.formacao?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mt-2">Formação</p>
                        {cv.formacao.slice(0, 3).map((f: any, i: number) => (
                          <p key={i} className="text-[11px] text-muted-foreground">
                            • {f.curso ?? f.Curso ?? ""} — {f.instituicao ?? f.Instituicao ?? ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum contratado encontrado.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
