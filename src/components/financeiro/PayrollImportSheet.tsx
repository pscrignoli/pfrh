import { useState, useCallback, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { PAYROLL_FIELD_OPTIONS, autoMapColumn } from "@/utils/payrollColumnMap";
import { parseFolhaTxt, type ParsedPayroll } from "@/utils/parseFolhaTxt";
import { importFolhaTxt, type ImportResult } from "@/utils/importFolhaTxt";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, CheckCircle2, Upload, FileSpreadsheet, Save, Loader2, XCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  ano: number;
  mes: number;
  existingCount: number;
  onImported: () => void;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const NUMERIC_FIELDS = new Set(PAYROLL_FIELD_OPTIONS.filter(f =>
  !["__skip__", "numero_cpf", "contrato_empregado", "relacao_funcionarios",
    "codigo_centro_custo", "centro_custo", "area", "cargo", "admissao",
    "desligamento", "tipo_contrato", "empresa"].includes(f.value)
).map(f => f.value));

interface ValidationRow {
  rowIndex: number;
  rawData: Record<string, string>;
  mappedData: Record<string, unknown>;
  employeeId: string | null;
  employeeName: string | null;
  cpf: string | null;
  errors: string[];
  warnings: string[];
}

export function PayrollImportSheet({ open, onClose, ano, mes, existingCount, onImported }: Props) {
  const { companyId, companyName } = useCompany();
  const [step, setStep] = useState(1);

  // Step 2
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [isTxtMode, setIsTxtMode] = useState(false);
  const [parsedTxt, setParsedTxt] = useState<ParsedPayroll | null>(null);

  // Step 3
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Step 4
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [validating, setValidating] = useState(false);

  // Step 5
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFileHeaders([]);
      setFileRows([]);
      setFileName("");
      setIsTxtMode(false);
      setParsedTxt(null);
      setMapping({});
      setValidationRows([]);
      setImporting(false);
      setImportProgress(0);
      setImportResult(null);
      setTxtImportResult(null);
    }
  }, [open]);

  // Load saved template
  useEffect(() => {
    if (open && companyId && fileHeaders.length > 0) {
      supabase
        .from("system_settings")
        .select("value")
        .eq("key", `payroll_import_template_${companyId}`)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.value) {
            try {
              const saved = JSON.parse(data.value) as Record<string, string>;
              // Apply saved mapping only for headers that exist in current file
              const newMapping: Record<string, string> = {};
              for (const header of fileHeaders) {
                if (saved[header]) {
                  newMapping[header] = saved[header];
                } else {
                  newMapping[header] = autoMapColumn(header);
                }
              }
              setMapping(newMapping);
            } catch { /* ignore */ }
          }
        });
    }
  }, [open, companyId, fileHeaders]);

  // ── Parse file ──
  const parseFile = useCallback((file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "txt") {
      // TXT mode: Relação de Cálculo Geral
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = parseFolhaTxt(text);
          if (parsed.funcionarios.length === 0) {
            toast({ title: "Nenhum funcionário encontrado no arquivo", variant: "destructive" });
            return;
          }
          setIsTxtMode(true);
          setParsedTxt(parsed);
          toast({
            title: `${parsed.funcionarios.length} funcionário(s) encontrado(s)`,
            description: `Arquivo TXT parseado com sucesso`,
          });
          // Skip mapping step, go directly to validation
          setStep(3); // We'll show a TXT preview instead of mapping
        } catch (err) {
          console.error("TXT parse error:", err);
          toast({ title: "Erro ao ler arquivo TXT", variant: "destructive" });
        }
      };
      reader.readAsText(file, "latin1"); // Brazilian encoding
      return;
    }

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const headers = result.meta.fields ?? [];
          setFileHeaders(headers);
          setFileRows(result.data as Record<string, string>[]);
          const m: Record<string, string> = {};
          headers.forEach(h => { m[h] = autoMapColumn(h); });
          setMapping(m);
          setIsTxtMode(false);
          setParsedTxt(null);
          setStep(3);
        },
        error: () => toast({ title: "Erro ao ler CSV", variant: "destructive" }),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
          if (json.length === 0) {
            toast({ title: "Planilha vazia", variant: "destructive" });
            return;
          }
          const headers = Object.keys(json[0]);
          setFileHeaders(headers);
          setFileRows(json.map(row => {
            const clean: Record<string, string> = {};
            headers.forEach(h => { clean[h] = String(row[h] ?? ""); });
            return clean;
          }));
          const m: Record<string, string> = {};
          headers.forEach(h => { m[h] = autoMapColumn(h); });
          setMapping(m);
          setIsTxtMode(false);
          setParsedTxt(null);
          setStep(3);
        } catch {
          toast({ title: "Erro ao ler planilha", variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  // ── Save template ──
  const saveTemplate = async () => {
    if (!companyId) return;
    const { error } = await supabase
      .from("system_settings")
      .upsert(
        { key: `payroll_import_template_${companyId}`, value: JSON.stringify(mapping) } as any,
        { onConflict: "key" }
      );
    if (error) {
      toast({ title: "Erro ao salvar template", variant: "destructive" });
    } else {
      toast({ title: "Template de mapeamento salvo!" });
    }
  };

  // ── Validate ──
  const cpfColumnHeader = useMemo(() => {
    return Object.entries(mapping).find(([, v]) => v === "numero_cpf")?.[0] ?? null;
  }, [mapping]);

  const hasCpfMapping = !!cpfColumnHeader;

  // ── TXT Validation: match by name ──
  const runTxtValidation = useCallback(async () => {
    if (!parsedTxt || !companyId) return;
    setValidating(true);

    const { data: employees } = await supabase
      .from("employees")
      .select("id, nome_completo, numero_funcional")
      .eq("company_id", companyId)
      .not("numero_funcional", "is", null);

    // Build lookup by numero_funcional
    const empByNumFunc = new Map<string, { id: string; nome: string }>();
    (employees ?? []).forEach(e => {
      if (e.numero_funcional) {
        empByNumFunc.set(e.numero_funcional, { id: e.id, nome: e.nome_completo });
      }
    });

    const rows: ValidationRow[] = parsedTxt.funcionarios.map((func, idx) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const numFunc = String(func.numero);
      const emp = empByNumFunc.get(numFunc);

      if (!emp) {
        // Will be auto-created during import
        warnings.push("Novo colaborador — será cadastrado");
      }

      if (func.situacao === "Demitido" || func.situacao === "demitido") {
        warnings.push("Funcionário demitido");
      }

      return {
        rowIndex: idx + 1,
        rawData: { nome: func.nome, cargo: func.cargo, salario: String(func.salario_base) },
        mappedData: {},
        employeeId: emp?.id ?? "new",
        employeeName: emp?.nome ?? func.nome,
        cpf: null,
        errors,
        warnings,
      };
    });

    setValidationRows(rows);
    setValidating(false);
    setStep(4);
  }, [parsedTxt, companyId]);

  const runValidation = useCallback(async () => {
    if (isTxtMode) {
      return runTxtValidation();
    }

    if (!cpfColumnHeader || !companyId) return;
    setValidating(true);

    const { data: employees } = await supabase
      .from("employees")
      .select("id, nome_completo, numero_cpf")
      .eq("company_id", companyId);

    const empByCpf = new Map<string, { id: string; nome: string }>();
    (employees ?? []).forEach(e => {
      const cpfClean = e.numero_cpf.replace(/\D/g, "");
      empByCpf.set(cpfClean, { id: e.id, nome: e.nome_completo });
    });

    const seenCpfs = new Set<string>();
    const rows: ValidationRow[] = fileRows.map((row, idx) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const cpfRaw = row[cpfColumnHeader] ?? "";
      const cpfClean = cpfRaw.replace(/\D/g, "");

      if (!cpfClean) {
        errors.push("CPF vazio");
      } else if (cpfClean.length < 11) {
        errors.push("CPF inválido");
      }

      if (seenCpfs.has(cpfClean) && cpfClean) {
        warnings.push("CPF duplicado no arquivo");
      }
      seenCpfs.add(cpfClean);

      const emp = empByCpf.get(cpfClean);
      if (!emp && cpfClean) {
        errors.push("Colaborador não encontrado");
      }

      const mappedData: Record<string, unknown> = {};
      for (const [header, field] of Object.entries(mapping)) {
        if (field === "__skip__" || field === "numero_cpf") continue;
        const val = row[header];
        if (NUMERIC_FIELDS.has(field)) {
          const parsed = parseNumber(val);
          if (val && parsed === null) {
            warnings.push(`Valor inválido para ${field}: "${val}"`);
          }
          mappedData[field] = parsed ?? 0;
        } else {
          mappedData[field] = val || null;
        }
      }

      return {
        rowIndex: idx + 1,
        rawData: row,
        mappedData,
        employeeId: emp?.id ?? null,
        employeeName: emp?.nome ?? null,
        cpf: cpfClean || null,
        errors,
        warnings,
      };
    });

    setValidationRows(rows);
    setValidating(false);
    setStep(4);
  }, [isTxtMode, runTxtValidation, cpfColumnHeader, companyId, fileRows, mapping]);

  // ── Import ──
  // For TXT mode, all rows are valid (employees auto-created)
  const validRows = useMemo(() => isTxtMode
    ? validationRows
    : validationRows.filter(r => r.errors.length === 0 && r.employeeId), [validationRows, isTxtMode]);
  const errorRows = useMemo(() => isTxtMode
    ? []
    : validationRows.filter(r => r.errors.length > 0 || !r.employeeId), [validationRows, isTxtMode]);

  // TXT import result state
  const [txtImportResult, setTxtImportResult] = useState<ImportResult | null>(null);

  const runImport = useCallback(async () => {
    if (!companyId) return;
    setImporting(true);
    setImportProgress(0);

    if (isTxtMode && parsedTxt) {
      // Use the dedicated TXT import service
      const res = await importFolhaTxt(parsedTxt, companyId, ano, mes);
      setTxtImportResult(res);
      setImportResult({
        success: res.payroll_records,
        errors: res.errors.length,
      });
      setImporting(false);
      setStep(5);
      if (res.payroll_records > 0) onImported();
      return;
    }

    // CSV/Excel mode (existing logic)
    if (validRows.length === 0) return;
    let success = 0;
    let errors = 0;

    const batchSize = 50;
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      const records = batch.map(r => ({
        ...r.mappedData,
        employee_id: r.employeeId!,
        ano,
        mes,
        company_id: companyId,
        status: "importado",
      }));

      const { error } = await supabase
        .from("payroll_monthly_records")
        .upsert(records as any, { onConflict: "employee_id,ano,mes" });

      if (error) {
        errors += batch.length;
        console.error("Import batch error:", error);
      } else {
        success += batch.length;
      }

      setImportProgress(Math.round(((i + batch.length) / validRows.length) * 100));
    }

    setImportResult({ success, errors });
    setImporting(false);
    setStep(5);
    if (success > 0) onImported();
  }, [validRows, companyId, ano, mes, onImported, isTxtMode, parsedTxt]);

  // ── Render steps ──
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Folha
          </SheetTitle>
        </SheetHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-1 mb-6 text-xs">
          {(isTxtMode
            ? ["Competência", "Upload", "Preview TXT", "Validação", "Resultado"]
            : ["Competência", "Upload", "Mapeamento", "Validação", "Resultado"]
          ).map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step > i + 1 ? "bg-primary text-primary-foreground" :
                step === i + 1 ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span className={step === i + 1 ? "font-medium" : "text-muted-foreground"}>{label}</span>
              {i < 4 && <span className="text-muted-foreground mx-1">→</span>}
            </div>
          ))}
        </div>

        {/* ── Step 1: Competência ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium">{companyName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Competência</span>
                <span className="font-medium">{monthNames[mes - 1]} / {ano}</span>
              </div>
            </div>

            {existingCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-warning">Registros existentes</p>
                  <p className="text-muted-foreground">
                    Já existem {existingCount} registros para esta competência.
                    A importação irá sobrescrever registros com mesmo CPF.
                  </p>
                </div>
              </div>
            )}

            <Button className="w-full" onClick={() => setStep(2)}>Continuar</Button>
          </div>
        )}

        {/* ── Step 2: Upload ── */}
        {step === 2 && (
          <div className="space-y-4">
            <label
              className={`flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-2" />
              <span className="text-sm font-medium text-muted-foreground">
                Arraste ou clique para selecionar
              </span>
              <span className="text-xs text-muted-foreground">.xlsx, .xls, .csv, .txt</span>
              <input
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileInput}
              />
            </label>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Mapeamento / TXT Preview ── */}
        {step === 3 && isTxtMode && parsedTxt && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4 inline mr-1" />
                {fileName} — {parsedTxt.funcionarios.length} funcionário(s)
              </p>
              <Badge variant="outline" className="text-xs">TXT Relação de Cálculo</Badge>
            </div>

            {parsedTxt.empresa.nome && (
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa no arquivo</span>
                  <span className="font-medium">{parsedTxt.empresa.nome}</span>
                </div>
                {parsedTxt.periodo.inicio && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Período</span>
                    <span className="font-medium">{parsedTxt.periodo.tipo}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-primary">Importação inteligente</p>
                <p className="text-muted-foreground text-xs">
                  Colaboradores que não existem serão cadastrados automaticamente.
                  A vinculação é feita pelo <strong>número funcional</strong> (Func).
                </p>
              </div>
            </div>

            <ScrollArea className="h-[280px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead className="text-right">Rubricas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTxt.funcionarios.slice(0, 50).map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{f.numero}</TableCell>
                      <TableCell className="text-xs font-medium">{f.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.cargo}</TableCell>
                      <TableCell className="text-xs text-right">{f.salario_base.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell className="text-xs text-right">{f.rubricas.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={runValidation} disabled={validating}>
                {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Validar Dados
              </Button>
            </div>
          </div>
        )}

        {step === 3 && !isTxtMode && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4 inline mr-1" />
                {fileName} — {fileRows.length} linhas, {fileHeaders.length} colunas
              </p>
              <Button variant="outline" size="sm" onClick={saveTemplate}>
                <Save className="h-3.5 w-3.5 mr-1" /> Salvar Template
              </Button>
            </div>

            {!hasCpfMapping && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <span>Mapeie pelo menos a coluna <strong>CPF</strong> para continuar.</span>
              </div>
            )}

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Coluna do Arquivo</TableHead>
                    <TableHead className="w-[140px]">Amostra</TableHead>
                    <TableHead>Campo Destino</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fileHeaders.map((header) => (
                    <TableRow key={header}>
                      <TableCell className="font-mono text-xs">{header}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                        {fileRows[0]?.[header] ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[header] ?? "__skip__"}
                          onValueChange={(v) => setMapping(prev => ({ ...prev, [header]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYROLL_FIELD_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {fileRows.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Preview (3 primeiras linhas)</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs border">
                    <thead>
                      <tr>{fileHeaders.slice(0, 8).map(h => <th key={h} className="border p-1 bg-muted">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {fileRows.slice(0, 3).map((row, i) => (
                        <tr key={i}>{fileHeaders.slice(0, 8).map(h => <td key={h} className="border p-1">{row[h]}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={runValidation} disabled={!hasCpfMapping || validating}>
                {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Validar Dados
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Validação ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-primary">{validRows.length}</div>
                <div className="text-xs text-muted-foreground">Válidos</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-destructive">{errorRows.length}</div>
                <div className="text-xs text-muted-foreground">Com erro</div>
              </div>
            </div>

            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationRows.map((row) => (
                    <TableRow key={row.rowIndex} className={row.errors.length > 0 ? "bg-destructive/5" : row.warnings.length > 0 ? "bg-warning/5" : ""}>
                      <TableCell className="text-xs">{row.rowIndex}</TableCell>
                      <TableCell className="font-mono text-xs">{row.cpf || "—"}</TableCell>
                      <TableCell className="text-sm">{row.employeeName || "—"}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {row.errors.map((e, i) => (
                              <Badge key={i} variant="destructive" className="text-[10px] w-fit">{e}</Badge>
                            ))}
                          </div>
                        ) : row.warnings.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {row.warnings.map((w, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] w-fit border-warning text-warning">{w}</Badge>
                            ))}
                            <Badge variant="outline" className="text-[10px] w-fit border-primary text-primary">OK</Badge>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-primary text-primary">
                            <CheckCircle2 className="h-3 w-3 mr-0.5" /> OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
              <Button onClick={runImport} disabled={validRows.length === 0 || importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Importar {validRows.length} registro{validRows.length !== 1 ? "s" : ""}
              </Button>
            </div>

            {importing && (
              <Progress value={importProgress} className="h-2" />
            )}
          </div>
        )}

        {/* ── Step 5: Resultado ── */}
        {step === 5 && importResult && (
          <div className="space-y-6 text-center py-8">
            {importResult.errors === 0 ? (
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            ) : (
              <AlertTriangle className="h-16 w-16 text-warning mx-auto" />
            )}

            <div>
              <h3 className="text-lg font-semibold">Importação Concluída</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {monthNames[mes - 1]} / {ano} — {companyName}
              </p>
            </div>

            <div className={`grid gap-3 max-w-sm mx-auto ${txtImportResult ? "grid-cols-3" : "grid-cols-2"}`}>
              {txtImportResult && (
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{txtImportResult.employees_created}</div>
                  <div className="text-xs text-muted-foreground">Colaboradores criados</div>
                </div>
              )}
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-primary">{importResult.success}</div>
                <div className="text-xs text-muted-foreground">Registros importados</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-destructive">{importResult.errors}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </div>
            </div>

            {txtImportResult && txtImportResult.employees_updated > 0 && (
              <p className="text-xs text-muted-foreground">
                {txtImportResult.employees_updated} colaborador(es) atualizado(s)
              </p>
            )}

            {txtImportResult && txtImportResult.errors.length > 0 && (
              <details className="text-left text-xs max-w-sm mx-auto">
                <summary className="cursor-pointer text-destructive">Ver erros</summary>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {txtImportResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}

            <Button onClick={onClose} className="w-full max-w-xs">Fechar</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Parse Brazilian number format: "1.234,56" → 1234.56
function parseNumber(val: string | undefined | null): number | null {
  if (!val || !val.trim()) return null;
  let clean = val.trim();
  // Remove currency symbols
  clean = clean.replace(/R\$\s*/g, "");
  // Brazilian format: 1.234,56
  if (clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  }
  const num = Number(clean);
  return isNaN(num) ? null : num;
}
