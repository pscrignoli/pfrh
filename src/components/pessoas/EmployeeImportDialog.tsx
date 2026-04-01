import { useState, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, PlusCircle, HelpCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  parseEmployeesXlsx,
  matchRows,
  buildUpdatePayload,
  buildInsertPayload,
  isCadastroCompleto,
  type MatchedRow,
} from "@/utils/importEmployeesXlsx";

type Step = "upload" | "preview" | "importing" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ACTION_CONFIG = {
  update: { label: "Atualizar", color: "bg-success/10 text-success", icon: CheckCircle2 },
  create: { label: "Criar", color: "bg-primary/10 text-primary", icon: PlusCircle },
  conflict: { label: "Conflito", color: "bg-warning/10 text-warning", icon: AlertTriangle },
  no_matricula: { label: "Sem matrícula", color: "bg-muted text-muted-foreground", icon: HelpCircle },
};

export function EmployeeImportDialog({ open, onClose, onComplete }: Props) {
  const { companyId } = useCompany();
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<MatchedRow[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [createNew, setCreateNew] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ updated: 0, created: 0, skipped: 0, errors: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep("upload");
    setRows([]);
    setOverwrite(false);
    setCreateNew(true);
    setUpdateExisting(true);
    setProgress(0);
    setResult({ updated: 0, created: 0, skipped: 0, errors: 0 });
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseEmployeesXlsx(buffer);
      if (parsed.length === 0) {
        toast({ title: "Arquivo vazio", description: "Nenhum colaborador encontrado no arquivo.", variant: "destructive" });
        return;
      }

      // Fetch existing employees for this company
      let query = supabase.from("rh_employees").select("*");
      if (companyId) query = query.eq("company_id", companyId);
      const { data: existing } = await query;

      const matched = matchRows(parsed, existing ?? []);
      setRows(matched);
      setStep("preview");
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
    }
  }, [companyId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const counts = {
    update: rows.filter(r => r.action === "update").length,
    create: rows.filter(r => r.action === "create").length,
    conflict: rows.filter(r => r.action === "conflict").length,
    no_matricula: rows.filter(r => r.action === "no_matricula").length,
  };

  const doImport = async () => {
    setStep("importing");
    const res = { updated: 0, created: 0, skipped: 0, errors: 0 };
    const total = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (row.action === "update" || row.action === "no_matricula") {
          if (!updateExisting || !row.existingEmployee) {
            res.skipped++;
          } else {
            const updates = buildUpdatePayload(row.xlsxData, row.existingEmployee, overwrite);
            updates.cadastro_completo = isCadastroCompleto({ ...row.existingEmployee, ...updates });
            if (Object.keys(updates).length > 0) {
              const { error } = await supabase
                .from("rh_employees")
                .update(updates)
                .eq("id", row.existingEmployee.id);
              if (error) throw error;
              res.updated++;
            } else {
              res.skipped++;
            }
          }
        } else if (row.action === "create") {
          if (!createNew) {
            res.skipped++;
          } else {
            const payload = buildInsertPayload(row.xlsxData, companyId);
            payload.cadastro_completo = isCadastroCompleto(payload);
            const { error } = await supabase.from("rh_employees").insert(payload as any);
            if (error) throw error;
            res.created++;
          }
        } else if (row.action === "conflict") {
          res.skipped++;
        }
      } catch (err: any) {
        console.error("Import error row", i, err);
        res.errors++;
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResult(res);
    setStep("done");
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Colaboradores (XLSX)
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium">Arraste o arquivo XLSX aqui</p>
            <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {step === "preview" && (
          <>
            {/* Counters */}
            <div className="flex flex-wrap gap-2">
              {(["update", "create", "conflict", "no_matricula"] as const).map((key) => {
                const cfg = ACTION_CONFIG[key];
                const Icon = cfg.icon;
                return (
                  <Badge key={key} variant="secondary" className={`border-0 gap-1 ${cfg.color}`}>
                    <Icon className="h-3 w-3" />
                    {counts[key]} {cfg.label}
                  </Badge>
                );
              })}
              <Badge variant="outline" className="ml-auto">{rows.length} total</Badge>
            </div>

            {/* Table */}
            <ScrollArea className="flex-1 min-h-0 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Matrícula</TableHead>
                    <TableHead>Nome (XLSX)</TableHead>
                    <TableHead>Nome (App)</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead className="w-[110px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => {
                    const cfg = ACTION_CONFIG[row.action];
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{row.xlsxData.numero_funcional || "—"}</TableCell>
                        <TableCell className="text-sm">{row.xlsxData.nome_completo || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.existingEmployee?.nome_completo || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{row.xlsxData.numero_cpf || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`border-0 gap-1 text-xs ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Options */}
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center gap-2">
                <Checkbox id="overwrite" checked={overwrite} onCheckedChange={(v) => setOverwrite(!!v)} />
                <label htmlFor="overwrite" className="text-sm">Sobrescrever campos já preenchidos</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="createNew" checked={createNew} onCheckedChange={(v) => setCreateNew(!!v)} />
                <label htmlFor="createNew" className="text-sm">Criar colaboradores novos ({counts.create})</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="updateExisting" checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(!!v)} />
                <label htmlFor="updateExisting" className="text-sm">Atualizar existentes ({counts.update + counts.no_matricula})</label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={doImport}>
                Importar {rows.filter(r =>
                  (r.action === "create" && createNew) ||
                  ((r.action === "update" || r.action === "no_matricula") && updateExisting)
                ).length} colaboradores
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-sm font-medium">Importando colaboradores...</p>
            <Progress value={progress} className="w-full max-w-md" />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="text-lg font-semibold">Importação concluída!</p>
            <div className="flex gap-3 text-sm">
              <Badge variant="secondary" className="bg-success/10 text-success border-0">{result.updated} atualizados</Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0">{result.created} criados</Badge>
              {result.skipped > 0 && <Badge variant="secondary" className="border-0">{result.skipped} ignorados</Badge>}
              {result.errors > 0 && <Badge variant="destructive" className="border-0">{result.errors} erros</Badge>}
            </div>
            <Button onClick={handleClose} className="mt-4">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
