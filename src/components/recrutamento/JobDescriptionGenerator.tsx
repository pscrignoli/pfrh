import { useState, useCallback } from "react";
import { Sparkles, Copy, RefreshCw, Check, FileText, ChevronDown, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useDepartments } from "@/hooks/useDepartments";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

const NIVEIS = [
  { value: "operacional", label: "Operacional" },
  { value: "profissional", label: "Profissional / Técnico" },
  { value: "supervisao", label: "Supervisão / Coordenação" },
  { value: "gerencial", label: "Gerencial" },
  { value: "diretoria", label: "Diretoria" },
];

const MODALIDADES = [
  { value: "Presencial", label: "Presencial" },
  { value: "Híbrido", label: "Híbrido" },
  { value: "Remoto", label: "Remoto" },
];

const MOTIVOS = [
  { value: "aumento_quadro", label: "Aumento de Quadro" },
  { value: "substituicao", label: "Substituição" },
];

interface GeneratedData {
  descricao_en: string;
  descricao_pt: string;
  requisitos_en: string;
  requisitos_pt: string;
  beneficios_sugeridos: string[];
  nivel_ingles: string;
  faixa_experiencia: string;
  normas_aplicaveis: string[];
}

interface ContextInfo {
  descricoes_similares: number;
  colaboradores_encontrados: number;
  salario_context: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function JobDescriptionGenerator({ open, onClose }: Props) {
  const { companyId, companyName } = useCompany();
  const { departments } = useDepartments(true);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [nivel, setNivel] = useState("");
  const [modalidade, setModalidade] = useState("Presencial");
  const [observacoes, setObservacoes] = useState("");
  const [requisitosEspecificos, setRequisitosEspecificos] = useState("");
  const [faixaSalarial, setFaixaSalarial] = useState("");
  const [motivo, setMotivo] = useState("");
  const [tom, setTom] = useState<"tecnico" | "acessivel">("tecnico");
  const [optionalsOpen, setOptionalsOpen] = useState(false);

  // Result state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedData | null>(null);
  const [context, setContext] = useState<ContextInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable content
  const [editDescEn, setEditDescEn] = useState("");
  const [editDescPt, setEditDescPt] = useState("");
  const [editReqEn, setEditReqEn] = useState("");
  const [editReqPt, setEditReqPt] = useState("");

  const generate = useCallback(async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título do cargo.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-job-description", {
        body: {
          titulo,
          departamento,
          nivel_hierarquico: nivel,
          empresa: companyName,
          modalidade,
          observacoes,
          requisitos_especificos: requisitosEspecificos,
          faixa_salarial: faixaSalarial,
          motivo,
          company_id: companyId,
          tom,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const gen = data.data as GeneratedData;
      setResult(gen);
      setContext(data.context);
      setEditDescEn(gen.descricao_en);
      setEditDescPt(gen.descricao_pt);
      setEditReqEn(gen.requisitos_en);
      setEditReqPt(gen.requisitos_pt);
      toast.success("Descrição gerada com sucesso!");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar descrição.");
    } finally {
      setLoading(false);
    }
  }, [titulo, departamento, nivel, companyName, modalidade, observacoes, requisitosEspecificos, faixaSalarial, motivo, companyId, tom]);

  const getFullHtml = () => {
    return `<h3>Job Description (English)</h3>\n${editDescEn}\n<h3>Requirements</h3>\n${editReqEn}\n<hr>\n<h3>Descrição da Vaga (Português)</h3>\n${editDescPt}\n<h3>Requisitos</h3>\n${editReqPt}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getFullHtml());
      setCopied(true);
      toast.success("Descrição copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Falha ao copiar.");
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("rh_vaga_descricoes" as any).insert({
        company_id: companyId,
        titulo_cargo: titulo,
        departamento,
        nivel_hierarquico: nivel,
        descricao_html: getFullHtml(),
        requisitos_html: `${editReqEn}\n<hr>\n${editReqPt}`,
        descricao_ia_original: `${result.descricao_en}\n<hr>\n${result.descricao_pt}`,
        beneficios: result.beneficios_sugeridos,
        nivel_ingles: result.nivel_ingles,
        modalidade,
        normas_regulatorias: result.normas_aplicaveis,
        fonte: "ia",
        aprovada: false,
      } as any);
      if (error) throw error;
      toast.success("Descrição salva como template!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetEdits = () => {
    if (!result) return;
    setEditDescEn(result.descricao_en);
    setEditDescPt(result.descricao_pt);
    setEditReqEn(result.requisitos_en);
    setEditReqPt(result.requisitos_pt);
    toast.info("Texto restaurado ao original da IA.");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Gerador de Descrição com IA
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do cargo e a IA gerará uma descrição bilíngue no padrão da empresa, usando vagas anteriores como referência.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 p-6 pt-4">
          {/* ── LEFT: Form ── */}
          <div className={`space-y-4 ${result ? "lg:w-[340px] lg:min-w-[340px]" : "w-full max-w-2xl mx-auto"}`}>
            <div className="space-y-3">
              <div>
                <Label>Título do Cargo *</Label>
                <Input
                  placeholder="Ex: Analista de Qualidade Pleno"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Departamento</Label>
                  <Select value={departamento} onValueChange={setDepartamento}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nível Hierárquico</Label>
                  <Select value={nivel} onValueChange={setNivel}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {NIVEIS.map((n) => (
                        <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Modalidade</Label>
                  <Select value={modalidade} onValueChange={setModalidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODALIDADES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tom</Label>
                  <Select value={tom} onValueChange={(v) => setTom(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tecnico">Técnico</SelectItem>
                      <SelectItem value="acessivel">Acessível</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Collapsible open={optionalsOpen} onOpenChange={setOptionalsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                    Campos opcionais
                    <ChevronDown className={`h-4 w-4 transition-transform ${optionalsOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div>
                    <Label>Resumo das responsabilidades</Label>
                    <Textarea
                      placeholder="2-3 frases do gestor sobre as principais atividades..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Requisitos específicos</Label>
                    <Textarea
                      placeholder="Certificações, ferramentas, experiências que o gestor deseja..."
                      value={requisitosEspecificos}
                      onChange={(e) => setRequisitosEspecificos(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Faixa Salarial</Label>
                      <Input
                        placeholder="R$ 5.000 - 8.000"
                        value={faixaSalarial}
                        onChange={(e) => setFaixaSalarial(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Motivo</Label>
                      <Select value={motivo} onValueChange={setMotivo}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {MOTIVOS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <Button
              onClick={generate}
              disabled={loading || !titulo.trim()}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 gap-2"
              size="lg"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Gerando..." : "Gerar Descrição"}
            </Button>

            {/* AI Suggestions sidebar */}
            {result && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Sugestões da IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2 text-sm">
                  {result.nivel_ingles && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Inglês:</span>
                      <Badge variant="secondary" className="text-xs">{result.nivel_ingles}</Badge>
                    </div>
                  )}
                  {result.faixa_experiencia && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Experiência:</span>
                      <Badge variant="secondary" className="text-xs">{result.faixa_experiencia}</Badge>
                    </div>
                  )}
                  {context?.salario_context && (
                    <div>
                      <span className="text-muted-foreground text-xs">{context.salario_context}</span>
                    </div>
                  )}
                  {result.normas_aplicaveis?.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Normas:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.normas_aplicaveis.map((n) => (
                          <Badge key={n} variant="outline" className="text-[10px] px-1.5 py-0">{n}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {context && (
                    <div className="text-xs text-muted-foreground pt-1 border-t">
                      Contexto usado: {context.descricoes_similares} vaga(s) similar(es), {context.colaboradores_encontrados} colaborador(es)
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── RIGHT: Result ── */}
          {(loading || result) && (
            <div className="flex-1 min-w-0 space-y-3">
              {loading ? (
                <div className="space-y-4 py-8">
                  <div className="flex items-center gap-3 justify-center">
                    <div className="relative">
                      <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                      <div className="absolute inset-0 h-8 w-8 bg-primary/20 rounded-full animate-ping" />
                    </div>
                    <p className="text-muted-foreground text-sm">Analisando vagas similares e gerando descrição...</p>
                  </div>
                  <div className="space-y-3 max-w-xl mx-auto">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ) : result && (
                <>
                  {/* Action bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={generate} className="gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copiado!" : "Copiar HTML"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetEdits} className="gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Desfazer edições
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                      className="gap-1.5 ml-auto bg-gradient-to-r from-primary to-primary/80"
                    >
                      <Star className="h-3.5 w-3.5" />
                      {saving ? "Salvando..." : "Salvar Template"}
                    </Button>
                  </div>

                  {/* Tabs for preview */}
                  <Tabs defaultValue="completo" className="w-full">
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="english">English</TabsTrigger>
                      <TabsTrigger value="portugues">Português</TabsTrigger>
                      <TabsTrigger value="completo">Completo (Bilíngue)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="english" className="mt-3 space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Textarea
                          value={editDescEn}
                          onChange={(e) => setEditDescEn(e.target.value)}
                          rows={10}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Requirements</Label>
                        <Textarea
                          value={editReqEn}
                          onChange={(e) => setEditReqEn(e.target.value)}
                          rows={6}
                          className="font-mono text-xs"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="portugues" className="mt-3 space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Descrição</Label>
                        <Textarea
                          value={editDescPt}
                          onChange={(e) => setEditDescPt(e.target.value)}
                          rows={10}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Requisitos</Label>
                        <Textarea
                          value={editReqPt}
                          onChange={(e) => setEditReqPt(e.target.value)}
                          rows={6}
                          className="font-mono text-xs"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="completo" className="mt-3">
                      <Card>
                        <CardContent className="p-4 prose prose-sm max-w-none dark:prose-invert">
                          <div dangerouslySetInnerHTML={{ __html: getFullHtml() }} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
