import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { parseFolhaTxt, type ParsedPayroll, type FuncionarioParsed } from "@/utils/parseFolhaTxt";
import { importFolhaTxt, type ImportResult } from "@/utils/importFolhaTxt";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, CheckCircle2, Upload, FileSpreadsheet, Loader2, UserPlus, RefreshCw, UserX, UserCheck, XCircle, Pencil,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (ano: number, mes: number) => void;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STEP_LABELS = ["Upload", "Colaboradores", "Folha", "Importação"];

type EmployeeStatus = "cadastrado" | "novo" | "atualizar" | "demitido";

interface EmployeePreviewRow {
  func: FuncionarioParsed;
  numFunc: string;
  status: EmployeeStatus;
  existingId: string | null;
  existingCargo: string | null;
  existingSalario: number | null;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

/** Extract mes/ano from parsed periodo.fim (ISO "2026-02-28") */
function extractPeriodo(parsed: ParsedPayroll): { mes: number; ano: number } | null {
  const fim = parsed.periodo.fim; // "2026-02-28"
  if (!fim) return null;
  const m = fim.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]) };
}

/** Normalize CNPJ to digits only */
function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export function PayrollImportSheet({ open, onClose, onImported }: Props) {
  const { companyId, companyName, companies } = useCompany();
  const [step, setStep] = useState(1);

  // Step 1: Upload + auto-detect
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [parsedTxt, setParsedTxt] = useState<ParsedPayroll | null>(null);
  const [detectedMes, setDetectedMes] = useState<number>(0);
  const [detectedAno, setDetectedAno] = useState<number>(0);
  const [manualOverride, setManualOverride] = useState(false);
  const [existingCount, setExistingCount] = useState(0);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Empresa validation
  const empresaMismatch = useMemo(() => {
    if (!parsedTxt || !companyId) return false;
    const fileCnpj = normalizeCnpj(parsedTxt.empresa.cnpj);
    if (!fileCnpj) return false; // Can't validate without CNPJ
    const selectedCompany = companies.find(c => c.id === companyId);
    if (!selectedCompany?.cnpj) return false; // Can't validate
    return normalizeCnpj(selectedCompany.cnpj) !== fileCnpj;
  }, [parsedTxt, companyId, companies]);

  // Step 2: Colaboradores
  const [employeeRows, setEmployeeRows] = useState<EmployeePreviewRow[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [createNew, setCreateNew] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);

  // Step 4: Result
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [txtImportResult, setTxtImportResult] = useState<ImportResult | null>(null);

  // Effective mes/ano (detected or manually overridden)
  const mes = detectedMes;
  const ano = detectedAno;

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFileName("");
      setParsedTxt(null);
      setDetectedMes(0);
      setDetectedAno(0);
      setManualOverride(false);
      setExistingCount(0);
      setEmployeeRows([]);
      setCreateNew(true);
      setUpdateExisting(true);
      setImporting(false);
      setImportProgress(0);
      setTxtImportResult(null);
    }
  }, [open]);

  // Check existing records when period is detected
  useEffect(() => {
    if (!companyId || !mes || !ano) {
      setExistingCount(0);
      return;
    }
    let cancelled = false;
    setCheckingExisting(true);
    supabase
      .from("payroll_monthly_records")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("ano", ano)
      .eq("mes", mes)
      .then(({ count }) => {
        if (!cancelled) {
          setExistingCount(count ?? 0);
          setCheckingExisting(false);
        }
      });
    return () => { cancelled = true; };
  }, [companyId, mes, ano]);

  // ── Parse file ──
  const parseFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseFolhaTxt(text);
        if (parsed.funcionarios.length === 0) {
          toast({ title: "Nenhum funcionário encontrado no arquivo", variant: "destructive" });
          return;
        }
        setParsedTxt(parsed);

        // Auto-detect period
        const periodo = extractPeriodo(parsed);
        if (periodo) {
          setDetectedMes(periodo.mes);
          setDetectedAno(periodo.ano);
        } else {
          // Fallback to current month
          const now = new Date();
          setDetectedMes(now.getMonth() + 1);
          setDetectedAno(now.getFullYear());
          setManualOverride(true); // Force manual since detection failed
        }

        toast({
          title: `${parsed.funcionarios.length} funcionário(s) encontrado(s)`,
        });
      } catch (err) {
        console.error("TXT parse error:", err);
        toast({ title: "Erro ao ler arquivo TXT", description: String(err), variant: "destructive" });
      }
    };
    reader.readAsText(file, "latin1");
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

  // ── Step 1 → 2: Load employees and build preview ──
  const goToColaboradores = useCallback(async () => {
    if (!parsedTxt || !companyId || !mes || !ano) return;
    setLoadingEmployees(true);

    const { data: employees } = await supabase
      .from("employees")
      .select("id, numero_funcional, nome_completo, cargo, status")
      .eq("company_id", companyId)
      .not("numero_funcional", "is", null);

    const empMap = new Map<string, { id: string; nome: string; cargo: string | null; status: string }>();
    (employees ?? []).forEach(e => {
      if (e.numero_funcional) {
        empMap.set(e.numero_funcional, { id: e.id, nome: e.nome_completo, cargo: e.cargo, status: e.status });
      }
    });

    const rows: EmployeePreviewRow[] = parsedTxt.funcionarios.map(func => {
      const numFunc = String(func.numero);
      const existing = empMap.get(numFunc);
      const isDemitido = /demitid/i.test(func.situacao);

      let status: EmployeeStatus;
      if (isDemitido) {
        status = "demitido";
      } else if (!existing) {
        status = "novo";
      } else if (func.cargo && func.cargo !== existing.cargo) {
        status = "atualizar";
      } else {
        status = "cadastrado";
      }

      return {
        func,
        numFunc,
        status,
        existingId: existing?.id ?? null,
        existingCargo: existing?.cargo ?? null,
        existingSalario: null,
      };
    });

    setEmployeeRows(rows);
    setLoadingEmployees(false);
    setStep(2);
  }, [parsedTxt, companyId, mes, ano]);

  // Counts
  const counts = useMemo(() => {
    const c = { cadastrado: 0, novo: 0, atualizar: 0, demitido: 0 };
    employeeRows.forEach(r => c[r.status]++);
    return c;
  }, [employeeRows]);

  // ── Step 3: Folha preview ──
  const folhaRows = useMemo(() => {
    if (!parsedTxt) return [];
    return parsedTxt.funcionarios.map(f => {
      const he = [35, 36, 37, 38].reduce((s, c) => s + f.rubricas.filter(r => r.codigo === c).reduce((a, r) => a + r.valor, 0), 0);
      return {
        nome: f.nome,
        salarioBase: f.salario_base,
        proventos: f.totais.proventos,
        descontos: f.totais.descontos,
        liquido: f.totais.liquido,
        fgts: f.bases.fgts_gfip.valor,
        he,
        salarioDiverge: f.totais.proventos > f.salario_base * 1.5,
      };
    });
  }, [parsedTxt]);

  const folhaTotals = useMemo(() => {
    const t = { proventos: 0, descontos: 0, liquido: 0, fgts: 0, he: 0 };
    folhaRows.forEach(r => {
      t.proventos += r.proventos;
      t.descontos += r.descontos;
      t.liquido += r.liquido;
      t.fgts += r.fgts;
      t.he += r.he;
    });
    return t;
  }, [folhaRows]);

  // ── Step 4: Import ──
  const runImport = useCallback(async () => {
    if (!companyId || !parsedTxt || !mes || !ano) return;
    setImporting(true);
    setImportProgress(10);

    const res = await importFolhaTxt(parsedTxt, companyId, ano, mes);
    setImportProgress(100);
    setTxtImportResult(res);
    setImporting(false);
    setStep(4);
    if (res.payroll_records > 0) onImported(ano, mes);
  }, [companyId, parsedTxt, ano, mes, onImported]);

  // ── Status badge ──
  const statusBadge = (s: EmployeeStatus) => {
    switch (s) {
      case "cadastrado": return <Badge variant="outline" className="text-[10px] border-green-500 text-green-600"><UserCheck className="h-3 w-3 mr-0.5" />Cadastrado</Badge>;
      case "novo": return <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600"><UserPlus className="h-3 w-3 mr-0.5" />Novo</Badge>;
      case "atualizar": return <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600"><RefreshCw className="h-3 w-3 mr-0.5" />Atualizar</Badge>;
      case "demitido": return <Badge variant="outline" className="text-[10px] border-red-500 text-red-600"><UserX className="h-3 w-3 mr-0.5" />Demitido</Badge>;
    }
  };

  const canProceed = parsedTxt && mes > 0 && ano > 0 && !empresaMismatch;

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
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step > i + 1 ? "bg-primary text-primary-foreground" :
                step === i + 1 ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span className={step === i + 1 ? "font-medium" : "text-muted-foreground"}>{label}</span>
              {i < STEP_LABELS.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload + Auto-detect ── */}
        {step === 1 && (
          <div className="space-y-4">
            <label
              className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
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
              <span className="text-xs text-muted-foreground">.txt (Relação de Cálculo Geral)</span>
              <input
                type="file"
                className="hidden"
                accept=".txt"
                onChange={handleFileInput}
              />
            </label>

            {/* Auto-detected info card */}
            {parsedTxt && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{fileName}</span>
                  <Badge variant="outline" className="text-xs">Detectado automaticamente</Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Empresa no arquivo</span>
                    <p className="font-medium">{parsedTxt.empresa.nome || "—"}</p>
                    {parsedTxt.empresa.cnpj && (
                      <p className="text-xs text-muted-foreground">{parsedTxt.empresa.cnpj}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Competência</span>
                    {!manualOverride ? (
                      <div className="flex items-center gap-1">
                        <p className="font-medium">{mes > 0 ? `${monthNames[mes - 1]} / ${ano}` : "—"}</p>
                        <button
                          onClick={() => setManualOverride(true)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Corrigir período manualmente"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 mt-0.5">
                        <Select value={String(mes)} onValueChange={(v) => setDetectedMes(Number(v))}>
                          <SelectTrigger className="h-7 text-xs w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((m, i) => (
                              <SelectItem key={i} value={String(i + 1)} className="text-xs">{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={String(ano)} onValueChange={(v) => setDetectedAno(Number(v))}>
                          <SelectTrigger className="h-7 text-xs w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2024, 2025, 2026, 2027].map(y => (
                              <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Funcionários</span>
                    <p className="font-semibold text-lg">{parsedTxt.funcionarios.length}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Total Proventos</span>
                    <p className="font-medium">{fmt(parsedTxt.totais_gerais.proventos)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Total Líquido</span>
                    <p className="font-medium">{fmt(parsedTxt.totais_gerais.liquido)}</p>
                  </div>
                </div>

                {/* Enterprise mismatch alert */}
                {empresaMismatch && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm">
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-red-700">Empresa divergente</p>
                      <p className="text-muted-foreground text-xs">
                        A empresa do arquivo ({parsedTxt.empresa.nome}) não corresponde
                        à empresa selecionada ({companyName}). Verifique antes de continuar.
                      </p>
                    </div>
                  </div>
                )}

                {/* Existing records warning */}
                {existingCount > 0 && !checkingExisting && (
                  <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-700">Competência já importada</p>
                      <p className="text-muted-foreground text-xs">
                        {monthNames[mes - 1]}/{ano} já possui {existingCount} registros.
                        Reimportar substituirá os dados existentes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={goToColaboradores} disabled={!canProceed || loadingEmployees}>
                {loadingEmployees ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Colaboradores ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg border p-2 text-center">
                <div className="text-lg font-bold text-green-600">{counts.cadastrado}</div>
                <div className="text-[10px] text-muted-foreground">Cadastrados</div>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <div className="text-lg font-bold text-blue-600">{counts.novo}</div>
                <div className="text-[10px] text-muted-foreground">Novos</div>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <div className="text-lg font-bold text-yellow-600">{counts.atualizar}</div>
                <div className="text-[10px] text-muted-foreground">Atualizar</div>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <div className="text-lg font-bold text-red-600">{counts.demitido}</div>
                <div className="text-[10px] text-muted-foreground">Demitidos</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={createNew} onCheckedChange={(v) => setCreateNew(!!v)} />
                Criar colaboradores novos automaticamente
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(!!v)} />
                Atualizar dados de colaboradores existentes
              </label>
            </div>

            <ScrollArea className="h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Func</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeRows.map((row, i) => (
                    <TableRow key={i} className={
                      row.status === "novo" ? "bg-blue-500/5" :
                      row.status === "atualizar" ? "bg-yellow-500/5" :
                      row.status === "demitido" ? "bg-red-500/5" : ""
                    }>
                      <TableCell className="text-xs font-mono">{row.numFunc}</TableCell>
                      <TableCell className="text-xs font-medium">{row.func.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.func.cargo}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(row.func.salario_base)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.func.situacao}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)}>Continuar → Folha</Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Folha preview ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {parsedTxt?.funcionarios.length} registros · {monthNames[mes - 1]}/{ano}
              </p>
              {parsedTxt?.totais_gerais && (
                <Badge variant="outline" className="text-xs">
                  Líquido: {fmt(parsedTxt.totais_gerais.liquido)}
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[340px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead className="text-right">Proventos</TableHead>
                    <TableHead className="text-right">Descontos</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">FGTS</TableHead>
                    <TableHead className="text-right">HE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folhaRows.map((r, i) => (
                    <TableRow key={i} className={r.salarioDiverge ? "bg-yellow-500/10" : ""}>
                      <TableCell className="text-xs font-medium max-w-[140px] truncate">{r.nome}</TableCell>
                      <TableCell className="text-xs text-right">{fmtNum(r.salarioBase)}</TableCell>
                      <TableCell className="text-xs text-right">{fmtNum(r.proventos)}</TableCell>
                      <TableCell className="text-xs text-right text-red-600">{fmtNum(r.descontos)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmtNum(r.liquido)}</TableCell>
                      <TableCell className="text-xs text-right">{fmtNum(r.fgts)}</TableCell>
                      <TableCell className="text-xs text-right">{r.he > 0 ? fmtNum(r.he) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell className="text-xs">TOTAL</TableCell>
                    <TableCell className="text-xs text-right">—</TableCell>
                    <TableCell className="text-xs text-right">{fmtNum(folhaTotals.proventos)}</TableCell>
                    <TableCell className="text-xs text-right text-red-600">{fmtNum(folhaTotals.descontos)}</TableCell>
                    <TableCell className="text-xs text-right">{fmtNum(folhaTotals.liquido)}</TableCell>
                    <TableCell className="text-xs text-right">{fmtNum(folhaTotals.fgts)}</TableCell>
                    <TableCell className="text-xs text-right">{fmtNum(folhaTotals.he)}</TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </ScrollArea>

            {parsedTxt?.totais_gerais && (
              <div className="rounded-lg border p-3 space-y-1 text-xs">
                <p className="font-medium text-muted-foreground">Conferência com totais do arquivo:</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-muted-foreground">Proventos TXT</span>
                    <p className={`font-medium ${Math.abs(parsedTxt.totais_gerais.proventos - folhaTotals.proventos) > 1 ? "text-red-600" : "text-green-600"}`}>
                      {fmt(parsedTxt.totais_gerais.proventos)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Descontos TXT</span>
                    <p className={`font-medium ${Math.abs(parsedTxt.totais_gerais.descontos - folhaTotals.descontos) > 1 ? "text-red-600" : "text-green-600"}`}>
                      {fmt(parsedTxt.totais_gerais.descontos)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Líquido TXT</span>
                    <p className={`font-medium ${Math.abs(parsedTxt.totais_gerais.liquido - folhaTotals.liquido) > 1 ? "text-red-600" : "text-green-600"}`}>
                      {fmt(parsedTxt.totais_gerais.liquido)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={runImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Importar {parsedTxt?.funcionarios.length} registros
              </Button>
            </div>

            {importing && <Progress value={importProgress} className="h-2" />}
          </div>
        )}

        {/* ── Step 4: Resultado ── */}
        {step === 4 && txtImportResult && (
          <div className="space-y-6 text-center py-8">
            {txtImportResult.errors.length === 0 ? (
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            ) : (
              <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
            )}

            <div>
              <h3 className="text-lg font-semibold">Importação Concluída</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {monthNames[mes - 1]} / {ano} — {companyName}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{txtImportResult.employees_created}</div>
                <div className="text-xs text-muted-foreground">Criados</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{txtImportResult.employees_updated}</div>
                <div className="text-xs text-muted-foreground">Atualizados</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{txtImportResult.payroll_records}</div>
                <div className="text-xs text-muted-foreground">Folha</div>
              </div>
            </div>

            {txtImportResult.errors.length > 0 && (
              <details className="text-left text-xs max-w-sm mx-auto">
                <summary className="cursor-pointer text-red-600 font-medium">
                  {txtImportResult.errors.length} erro(s)
                </summary>
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
