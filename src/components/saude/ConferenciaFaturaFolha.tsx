import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, ShieldCheck, FileWarning,
} from "lucide-react";
import { conferirFaturaVsFolha, type ConferenciaResult, type ConferenciaAlerta } from "@/utils/conferirFaturaVsFolha";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";

type TipoFiltro = "todos" | "medico" | "odontologico";

export function ConferenciaFaturaFolha() {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [competencias, setCompetencias] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [result, setResult] = useState<ConferenciaResult | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  // Load competencias
  useEffect(() => {
    async function load() {
      if (!companyId) return;
      const { data } = await supabase
        .from("health_records")
        .select("competencia")
        .eq("company_id", companyId)
        .order("competencia", { ascending: false });

      const unique = [...new Set((data ?? []).map((r: any) => r.competencia))];
      setCompetencias(unique);
      if (unique.length > 0 && !selected) setSelected(unique[0]);
      setLoading(false);
    }
    load();
  }, [companyId, selected]);

  const runConferencia = useCallback(async () => {
    if (!selected || !companyId) return;
    setLoading(true);
    setDismissed(new Set());
    const res = await conferirFaturaVsFolha(selected, companyId);
    setResult(res);
    setLoading(false);
  }, [selected, companyId]);

  useEffect(() => {
    if (selected) runConferencia();
  }, [selected, runConferencia]);

  const competenciaLabel = (c: string) => {
    const d = new Date(c + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  const dismissAlerta = (idx: number) => {
    setDismissed(prev => new Set(prev).add(idx));
  };

  const dismissAllInformativos = () => {
    if (!result) return;
    const critLen = result.criticos.length;
    const atLen = result.atencao.length;
    const newDismissed = new Set(dismissed);
    result.informativos.forEach((_, i) => newDismissed.add(critLen + atLen + i));
    setDismissed(newDismissed);
  };

  if (loading && competencias.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (competencias.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
          <FileWarning className="h-8 w-8 opacity-30" />
          <p>Nenhuma fatura importada. Importe uma fatura para iniciar a conferência.</p>
        </CardContent>
      </Card>
    );
  }

  const allAlertas: (ConferenciaAlerta & { globalIdx: number })[] = [];
  if (result) {
    result.criticos.forEach((a, i) => allAlertas.push({ ...a, globalIdx: i }));
    result.atencao.forEach((a, i) => allAlertas.push({ ...a, globalIdx: result.criticos.length + i }));
    result.informativos.forEach((a, i) => allAlertas.push({ ...a, globalIdx: result.criticos.length + result.atencao.length + i }));
  }

  const visibleAlertas = allAlertas.filter(a => !dismissed.has(a.globalIdx));
  const critCount = result?.criticos.length ?? 0;
  const attnCount = result?.atencao.length ?? 0;
  const infoCount = result?.informativos.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Conferência Fatura vs Folha
          </h2>
          <p className="text-sm text-muted-foreground">
            Cruzamento automático entre fatura do plano e folha de pagamento
          </p>
        </div>
        <Select value={selected ?? ""} onValueChange={setSelected}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Competência" />
          </SelectTrigger>
          <SelectContent>
            {competencias.map(c => (
              <SelectItem key={c} value={c}>{competenciaLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <Skeleton className="h-40" />}

      {!loading && result && (
        <>
          {/* Status */}
          {!result.folhaDisponivel && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Folha não importada</p>
                  <p className="text-xs text-muted-foreground">
                    Importe a folha de pagamento de {competenciaLabel(selected!)} para conferência automática.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {result.folhaDisponivel && result.faturaDisponivel && result.total === 0 && (
            <Card className="border-green-300 bg-green-50 dark:bg-green-950/20">
              <CardContent className="flex items-center gap-3 py-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Tudo conferido!</p>
                  <p className="text-xs text-muted-foreground">
                    Nenhuma divergência encontrada entre a fatura e a folha de {competenciaLabel(selected!)}.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {result.total > 0 && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <Card className={critCount > 0 ? "border-destructive/50" : ""}>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <AlertTriangle className={`h-5 w-5 ${critCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-xl font-bold">{critCount}</p>
                      <p className="text-xs text-muted-foreground">Críticos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className={attnCount > 0 ? "border-amber-400/50" : ""}>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <AlertCircle className={`h-5 w-5 ${attnCount > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-xl font-bold">{attnCount}</p>
                      <p className="text-xs text-muted-foreground">Atenção</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <Info className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-xl font-bold">{infoCount}</p>
                      <p className="text-xs text-muted-foreground">Informativos</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              {infoCount > 0 && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={dismissAllInformativos}>
                    Ignorar todos informativos
                  </Button>
                </div>
              )}

              {/* Alert list */}
              <div className="space-y-2">
                {visibleAlertas.map((a) => (
                  <div
                    key={a.globalIdx}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      a.tipo === "critico"
                        ? "border-destructive/40 bg-destructive/5"
                        : a.tipo === "atencao"
                        ? "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/10"
                        : "border-blue-300/40 bg-blue-50/50 dark:bg-blue-950/10"
                    }`}
                  >
                    {a.tipo === "critico" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    ) : a.tipo === "atencao" ? (
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{a.nome}</span>
                        <Badge
                          variant={a.tipo === "critico" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {a.categoria.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.detalhe}</p>
                      {a.fatura != null && a.folha != null && (
                        <div className="flex gap-4 mt-1 text-xs">
                          <span>Fatura: <strong>R$ {a.fatura.toFixed(2)}</strong></span>
                          <span>Folha: <strong>R$ {a.folha.toFixed(2)}</strong></span>
                          <span className="text-destructive font-medium">
                            Δ R$ {Math.abs(a.fatura - a.folha).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs h-7"
                      onClick={() => dismissAlerta(a.globalIdx)}
                    >
                      Ignorar
                    </Button>
                  </div>
                ))}

                {visibleAlertas.length === 0 && result.total > 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    Todos os alertas foram ignorados.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
