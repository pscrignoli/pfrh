import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { useHealthPlans } from "@/hooks/useHealthPlans";
import { useHealthImport } from "@/hooks/useHealthImport";
import { parseUnimedXls, type UnimedParseResult, type UnimedRecord } from "@/utils/parseUnimedXls";
import { parseBradescoSaudePdf, type BradescoParseResult, type BradescoRecord } from "@/utils/parseBradescoSaudePdf";

type Step = "tipo" | "upload" | "preview" | "resultado";
type Fonte = "unimed" | "bradesco";

interface MatchedRecord {
  record: UnimedRecord | BradescoRecord;
  employee_id: string | null;
  employee_nome: string | null;
  matched: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthImportDialog({ open, onOpenChange }: Props) {
  const { plans } = useHealthPlans();
  const { matchEmployees, importUnimed, importBradesco, importing, progress } = useHealthImport();

  const [step, setStep] = useState<Step>("tipo");
  const [fonte, setFonte] = useState<Fonte>("unimed");
  const [parseResult, setParseResult] = useState<UnimedParseResult | BradescoParseResult | null>(null);
  const [matched, setMatched] = useState<MatchedRecord[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; vidas: number } | null>(null);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setStep("tipo");
    setFonte("unimed");
    setParseResult(null);
    setMatched([]);
    setImportResult(null);
    setFileName("");
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

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
        } else {
          const result = await parseBradescoSaudePdf(buf);
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

  const handleImport = async () => {
    if (!parseResult) return;

    const plan = plans.find((p) =>
      fonte === "unimed"
        ? p.fornecedor?.toLowerCase().includes("unimed")
        : p.fornecedor?.toLowerCase().includes("bradesco")
    );

    if (!plan) {
      toast.error("Plano de saúde não encontrado. Verifique os cadastros.");
      return;
    }

    try {
      let result;
      if (fonte === "unimed") {
        result = await importUnimed(plan.id, parseResult as UnimedParseResult, matched);
      } else {
        result = await importBradesco(plan.id, parseResult as BradescoParseResult, matched);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Fatura de Saúde</DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          {["Tipo", "Upload", "Preview", "Resultado"].map((label, i) => {
            const steps: Step[] = ["tipo", "upload", "preview", "resultado"];
            const active = steps.indexOf(step) >= i;
            return (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={active ? "font-medium text-foreground" : ""}>{label}</span>
                {i < 3 && <div className="w-6 h-px bg-border" />}
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
                <RadioGroupItem value="bradesco" id="bradesco" />
                <Label htmlFor="bradesco" className="flex items-center gap-3 cursor-pointer flex-1">
                  <FileText className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium">Bradesco Saúde (PDF)</p>
                    <p className="text-sm text-muted-foreground">Fatura mensal com detalhamento médico e dental</p>
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
              <p className="font-medium mb-1">
                Arraste o arquivo {fonte === "unimed" ? "XLS" : "PDF"} aqui
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                ou clique para selecionar
              </p>
              <input
                type="file"
                accept={fonte === "unimed" ? ".xls,.xlsx" : ".pdf"}
                onChange={handleFileUpload}
                className="hidden"
                id="health-file-input"
              />
              <Button variant="outline" asChild>
                <label htmlFor="health-file-input" className="cursor-pointer">
                  Selecionar arquivo
                </label>
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

            <div className="rounded-md border max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Parentesco</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Mensalidade</TableHead>
                    <TableHead className="text-right">Empresa</TableHead>
                    <TableHead className="text-right">Colaborador</TableHead>
                    <TableHead>Vínculo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((m, i) => {
                    const r = m.record;
                    const isUnimed = "parte_empresa" in r;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">
                          {r.nome_beneficiario}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.parentesco === "titular" ? "default" : "secondary"} className="text-xs">
                            {r.parentesco}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isUnimed ? (r as UnimedRecord).descricao_plano : (r as BradescoRecord).codigo_plano}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {fmt(r.mensalidade)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {isUnimed ? fmt((r as UnimedRecord).parte_empresa) : fmt(r.mensalidade - r.parte_colaborador)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {fmt(isUnimed ? (r as UnimedRecord).parte_colaborador : r.parte_colaborador)}
                        </TableCell>
                        <TableCell>
                          {m.matched ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )}
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
                <p className="text-muted-foreground">Mensalidade</p>
                <p className="text-lg font-bold">
                  {fmt("totalMensalidade" in parseResult
                    ? (parseResult as UnimedParseResult).totalMensalidade
                    : (parseResult as BradescoParseResult).valorFatura)}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Parte Empresa</p>
                <p className="text-lg font-bold">
                  {fmt("totalEmpresa" in parseResult
                    ? (parseResult as UnimedParseResult).totalEmpresa
                    : (parseResult as BradescoParseResult).valorFatura)}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-muted-foreground">Parte Colaborador</p>
                <p className="text-lg font-bold">
                  {fmt("totalColaborador" in parseResult
                    ? (parseResult as UnimedParseResult).totalColaborador
                    : 0)}
                </p>
              </div>
            </div>

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  Importando... {progress}%
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("upload")}>Voltar</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importando..." : `Importar ${matched.length} registros`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4 - Resultado */}
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
