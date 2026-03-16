import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Upload, CheckCircle2, AlertCircle, FileSpreadsheet, FileText,
  AlertTriangle, Info, ShieldCheck, SmilePlus,
} from "lucide-react";
import { toast } from "sonner";
import { useHealthPlans } from "@/hooks/useHealthPlans";
import { useHealthImport, type MatchedRecord } from "@/hooks/useHealthImport";
import { useCompany } from "@/contexts/CompanyContext";
import { parseUnimedXls, type UnimedParseResult, type UnimedRecord } from "@/utils/parseUnimedXls";
import { parseBradescoSaudePdf, type BradescoParseResult, type BradescoRecord } from "@/utils/parseBradescoSaudePdf";
import { parseBradescoDentalPdf, type BradescoDentalParseResult, type BradescoDentalRecord } from "@/utils/parseBradescoDentalPdf";
import { conferirFaturaVsFolha, type ConferenciaResult, type ConferenciaAlerta } from "@/utils/conferirFaturaVsFolha";

type Step = "tipo" | "upload" | "preview" | "conferencia" | "resultado";
type Fonte = "unimed" | "bradesco_saude" | "bradesco_dental";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthImportDialog({ open, onOpenChange }: Props) {
  const { plans } = useHealthPlans();
  const { matchEmployees, importUnimed, importBradesco, importBradescoDental, importing, progress } = useHealthImport();
  const { companyId } = useCompany();

  const [step, setStep] = useState<Step>("tipo");
  const [fonte, setFonte] = useState<Fonte>("unimed");
  const [parseResult, setParseResult] = useState<UnimedParseResult | BradescoParseResult | BradescoDentalParseResult | null>(null);
  const [matched, setMatched] = useState<MatchedRecord[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; vidas: number } | null>(null);
  const [fileName, setFileName] = useState("");
  const [conferencia, setConferencia] = useState<ConferenciaResult | null>(null);
  const [confLoading, setConfLoading] = useState(false);
  const [confDismissed, setConfDismissed] = useState<Set<number>>(new Set());

  const reset = () => {
    setStep("tipo");
    setFonte("unimed");
    setParseResult(null);
    setMatched([]);
    setImportResult(null);
    setFileName("");
    setConferencia(null);
    setConfDismissed(new Set());
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const isPdf = fonte === "bradesco_saude" || fonte === "bradesco_dental";

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      try {
        const buf = await file.arrayBuffer();
        if (fonte === "unimed") {
          const result = parseUnimedXls(buf);
          setParseResult(result);
          const m = await matchEmployees(result.records);
          setMatched(m);
        } else if (fonte === "bradesco_saude") {
          const result = await parseBradescoSaudePdf(buf);
          setParseResult(result);
          const m = await matchEmployees(result.records);
          setMatched(m);
        } else {
          const result = await parseBradescoDentalPdf(buf);
          setParseResult(result);
          const m = await matchEmployees(result.records);
          setMatched(m);
        }
        setStep("preview");
      } catch (err: any) {
        toast.error("Erro ao processar arquivo: " + (err?.message ?? "formato inválido"));
      }
    },
    [fonte, matchEmployees]
  );

  const handleGoToConferencia = async () => {
    if (!parseResult || !companyId) {
      handleImport();
      return;
    }
    setConfLoading(true);
    const competenciaStr = parseResult.competencia.toISOString().split("T")[0];
    try {
    const tipoCobertura = fonte === 'bradesco_dental' ? 'odontologico' as const : fonte === 'unimed' ? 'medico' as const : 'medico' as const;
    const res = await conferirFaturaVsFolha(competenciaStr, companyId, tipoCobertura);
      setConferencia(res);
      setStep("conferencia");
    } catch {
      setStep("conferencia");
      setConferencia(null);
    }
    setConfLoading(false);
  };

  const handleImport = async () => {
    if (!parseResult) return;
    const plan = plans.find((p) => {
      const f = p.fornecedor?.toLowerCase() ?? "";
      if (fonte === "unimed") return f.includes("unimed");
      if (fonte === "bradesco_saude") return f.includes("bradesco") && !f.includes("dental");
      return f.includes("bradesco") || f.includes("dental") || f.includes("odonto");
    });
    if (!plan) {
      toast.error("Plano não encontrado. Verifique os cadastros em Saúde > Planos.");
      return;
    }
    try {
      let result;
      if (fonte === "unimed") {
        result = await importUnimed(plan.id, parseResult as UnimedParseResult, matched);
      } else if (fonte === "bradesco_saude") {
        result = await importBradesco(plan.id, parseResult as BradescoParseResult, matched);
      } else {
        result = await importBradescoDental(plan.id, parseResult as BradescoDentalParseResult, matched);
      }
      setImportResult(result);
      setStep("resultado");
      toast.success(`${result.imported} registros importados com sucesso!`);
    } catch (err: any) {
      toast.error("Erro na importação: " + (err?.message ?? "erro desconhecido"));
    }
  };

  const competenciaLabel = parseResult
    ? parseResult.competencia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";

  const matchedCount = matched.filter((m) => m.matched).length;
  const unmatchedCount = matched.filter((m) => !m.matched).length;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const stepLabels = ["Tipo", "Upload", "Preview", "Conferência", "Resultado"];
  const steps: Step[] = ["tipo", "upload", "preview", "conferencia", "resultado"];

  // Conferencia helpers
  const allConfAlertas: (ConferenciaAlerta & { globalIdx: number })[] = [];
  if (conferencia) {
    conferencia.criticos.forEach((a, i) => allConfAlertas.push({ ...a, globalIdx: i }));
    conferencia.atencao.forEach((a, i) => allConfAlertas.push({ ...a, globalIdx: conferencia.criticos.length + i }));
    conferencia.informativos.forEach((a, i) => allConfAlertas.push({ ...a, globalIdx: conferencia.criticos.length + conferencia.atencao.length + i }));
  }
  const visibleConfAlertas = allConfAlertas.filter(a => !confDismissed.has(a.globalIdx));
  const unreviewedCriticos = conferencia
    ? conferencia.criticos.filter((_, i) => !confDismissed.has(i)).length
    : 0;

  // Helpers to get display values from heterogeneous records
  const getRecordMensalidade = (r: UnimedRecord | BradescoRecord | BradescoDentalRecord): number => {
    if ("mensalidade" in r) return (r as any).mensalidade;
    if ("valor_liquido" in r) return (r as BradescoDentalRecord).valor_liquido;
    return 0;
  };
  const getRecordEmpresa = (r: UnimedRecord | BradescoRecord | BradescoDentalRecord): number => {
    if ("parte_empresa" in r && "cpf_beneficiario" in r) return (r as UnimedRecord).parte_empresa;
    if ("valor_liquido" in r) return (r as BradescoDentalRecord).valor_liquido - (r as BradescoDentalRecord).parte_colaborador;
    if ("mensalidade" in r) return (r as BradescoRecord).mensalidade - (r as BradescoRecord).parte_colaborador;
    return 0;
  };
  const getRecordColaborador = (r: UnimedRecord | BradescoRecord | BradescoDentalRecord): number => {
    if ("parte_colaborador" in r) return (r as any).parte_colaborador;
    return 0;
  };
  const getRecordPlano = (r: UnimedRecord | BradescoRecord | BradescoDentalRecord): string => {
    if ("descricao_plano" in r) return (r as UnimedRecord).descricao_plano || "";
    if ("codigo_plano" in r) return (r as any).codigo_plano || "";
    return "";
  };

  // Total values for preview
  const previewTotalMensalidade = matched.reduce((s, m) => s + getRecordMensalidade(m.record), 0);
  const previewTotalEmpresa = matched.reduce((s, m) => s + getRecordEmpresa(m.record), 0);
  const previewTotalColaborador = matched.reduce((s, m) => s + getRecordColaborador(m.record), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Fatura de Benefícios</DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          {stepLabels.map((label, i) => {
            const active = steps.indexOf(step) >= i;
            return (
              <div key={label} className="flex items-center gap-1">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <span className={active ? "font-medium text-foreground" : ""}>{label}</span>
                {i < stepLabels.length - 1 && <div className="w-6 h-px bg-border" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 - Tipo */}
        {step === "tipo" && (
          <div className="space-y-6">
            <RadioGroup value={fonte} onValueChange={(v) => setFonte(v as Fonte)} className="space-y-3">
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="unimed" id="unimed" />
                <Label htmlFor="unimed" className="flex items-center gap-3 cursor-pointer flex-1">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Unimed SJR Preto (XLS)</p>
                    <p className="text-sm text-muted-foreground">Relatório mensal de mensalidade em Excel</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="bradesco_saude" id="bradesco_saude" />
                <Label htmlFor="bradesco_saude" className="flex items-center gap-3 cursor-pointer flex-1">
                  <FileText className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium">Bradesco Saúde (PDF)</p>
                    <p className="text-sm text-muted-foreground">Fatura médica mensal — Diretoria (5 titulares)</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="bradesco_dental" id="bradesco_dental" />
                <Label htmlFor="bradesco_dental" className="flex items-center gap-3 cursor-pointer flex-1">
                  <SmilePlus className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Bradesco Dental (PDF)</p>
                    <p className="text-sm text-muted-foreground">Fatura odontológica mensal — Odontoprev (~63 vidas)</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
            <div className="flex justify-end">
              <Button onClick={() => setStep("upload")}>Próximo</Button>
            </div>
          </div>
        )}

        {/* STEP 2 - Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium mb-1">Arraste o arquivo {fonte === "unimed" ? "XLS" : "PDF"} aqui</p>
              <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
              <input type="file" accept={fonte === "unimed" ? ".xls,.xlsx" : ".pdf"} onChange={handleFileUpload} className="hidden" id="health-file-input" />
              <Button variant="outline" asChild>
                <label htmlFor="health-file-input" className="cursor-pointer">Selecionar arquivo</label>
              </Button>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("tipo")}>Voltar</Button>
            </div>
          </div>
        )}

        {/* STEP 3 - Preview */}
        {step === "preview" && parseResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Competência detectada</p>
                <p className="font-semibold capitalize">{competenciaLabel}</p>
              </div>
              <div className="flex gap-3 text-sm">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  {matchedCount} vinculados
                </Badge>
                {unmatchedCount > 0 && (
                  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                    <AlertCircle className="h-3 w-3" />
                    {unmatchedCount} não encontrados
                  </Badge>
                )}
              </div>
            </div>

            {/* Dental summary */}
            {fonte === "bradesco_dental" && parseResult && "valorBruto" in parseResult && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-medium">Resumo da fatura dental</p>
                <p>Bruto: {fmt((parseResult as BradescoDentalParseResult).valorBruto)} – Estornos: {fmt((parseResult as BradescoDentalParseResult).valorEstorno)} = <strong>Líquido: {fmt((parseResult as BradescoDentalParseResult).valorLiquido)}</strong></p>
              </div>
            )}

            <div className="rounded-md border max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Parentesco</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">{fonte === "bradesco_dental" ? "Valor Líquido" : "Mensalidade"}</TableHead>
                    <TableHead className="text-right">Empresa</TableHead>
                    <TableHead className="text-right">Colaborador</TableHead>
                    <TableHead>Vínculo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((m, i) => {
                    const r = m.record;
                    const mensalidade = getRecordMensalidade(r);
                    const isEstorno = mensalidade < 0;
                    return (
                      <TableRow key={i} className={isEstorno ? "text-destructive" : ""}>
                        <TableCell className="font-medium text-sm">{r.nome_beneficiario}</TableCell>
                        <TableCell>
                          <Badge variant={r.parentesco === "titular" ? "default" : "secondary"} className="text-xs">{r.parentesco}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getRecordPlano(r)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(mensalidade)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(getRecordEmpresa(r))}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(getRecordColaborador(r))}</TableCell>
                        <TableCell>
                          {m.matched ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Total Vidas</p>
                <p className="text-lg font-bold">{matched.length}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">{fonte === "bradesco_dental" ? "Valor Líquido" : "Mensalidade"}</p>
                <p className="text-lg font-bold">{fmt(previewTotalMensalidade)}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Parte Empresa</p>
                <p className="text-lg font-bold">{fmt(previewTotalEmpresa)}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Parte Colaborador</p>
                <p className="text-lg font-bold">{fmt(previewTotalColaborador)}</p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("upload")}>Voltar</Button>
              <Button onClick={handleGoToConferencia} disabled={confLoading}>
                {confLoading ? "Conferindo..." : "Conferir com Folha →"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4 - Conferência */}
        {step === "conferencia" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Conferência com Folha</h3>
            </div>

            {!conferencia || (!conferencia.folhaDisponivel) ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Folha de pagamento não disponível</p>
                  <p className="text-xs text-muted-foreground">
                    Importe a folha de pagamento do mês para conferência automática.
                    Você pode conferir depois na aba "Conferência" do módulo Saúde.
                  </p>
                </div>
              </div>
            ) : conferencia.total === 0 ? (
              <div className="rounded-lg border border-green-300 bg-green-50/50 dark:bg-green-950/20 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Tudo conferido!</p>
                  <p className="text-xs text-muted-foreground">
                    Nenhuma divergência entre a fatura e a folha de pagamento.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`rounded-lg p-3 text-center ${conferencia.criticos.length > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                    <p className="text-xl font-bold">{conferencia.criticos.length}</p>
                    <p className="text-xs text-muted-foreground">Críticos</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${conferencia.atencao.length > 0 ? "bg-amber-100 dark:bg-amber-950/20" : "bg-muted"}`}>
                    <p className="text-xl font-bold">{conferencia.atencao.length}</p>
                    <p className="text-xs text-muted-foreground">Atenção</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xl font-bold">{conferencia.informativos.length}</p>
                    <p className="text-xs text-muted-foreground">Informativos</p>
                  </div>
                </div>

                {conferencia.informativos.length > 0 && (
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => {
                      const newD = new Set(confDismissed);
                      conferencia.informativos.forEach((_, i) =>
                        newD.add(conferencia.criticos.length + conferencia.atencao.length + i)
                      );
                      setConfDismissed(newD);
                    }}>
                      Ignorar todos informativos
                    </Button>
                  </div>
                )}

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {visibleConfAlertas.map((a) => (
                    <div
                      key={a.globalIdx}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${
                        a.tipo === "critico" ? "border-destructive/40 bg-destructive/5"
                          : a.tipo === "atencao" ? "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/10"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      {a.tipo === "critico" ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        : a.tipo === "atencao" ? <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        : <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs">{a.detalhe}</p>
                        {a.fatura != null && a.folha != null && (
                          <p className="text-xs mt-0.5 text-muted-foreground">
                            Fatura: R$ {a.fatura.toFixed(2)} · Folha: R$ {a.folha.toFixed(2)} · Δ R$ {Math.abs(a.fatura - a.folha).toFixed(2)}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0 text-xs h-7"
                        onClick={() => setConfDismissed(prev => new Set(prev).add(a.globalIdx))}>
                        Ignorar
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">Importando... {progress}%</p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("preview")}>Voltar</Button>
              <Button
                onClick={handleImport}
                disabled={importing || unreviewedCriticos > 0}
                title={unreviewedCriticos > 0 ? "Revise os alertas críticos antes de continuar" : ""}
              >
                {importing ? "Importando..." : unreviewedCriticos > 0
                  ? `${unreviewedCriticos} crítico(s) pendente(s)`
                  : `Importar ${matched.length} registros`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5 - Resultado */}
        {step === "resultado" && importResult && (
          <div className="space-y-6 text-center py-8">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{importResult.imported} registros importados</p>
              <p className="text-muted-foreground">{importResult.vidas} vidas processadas</p>
              <p className="text-sm text-muted-foreground mt-1">
                Arquivo: {fileName} • Competência: {competenciaLabel}
              </p>
            </div>
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
