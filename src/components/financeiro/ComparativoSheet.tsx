import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { PayrollRecord } from "@/hooks/useFinanceiroData";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Loader2, TrendingUp, TrendingDown, Users, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  ano: number;
  mes: number;
  currentRecords: PayrollRecord[];
  onStatusChanged: () => void;
}

function currency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(prev: number, curr: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function fmtPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

type AlertLevel = "red" | "yellow" | "blue";

interface CompRow {
  cpf: string;
  name: string;
  prevSalario: number;
  currSalario: number;
  deltaSalPct: number;
  prevTotal: number;
  currTotal: number;
  deltaTotalPct: number;
  prevHE: number;
  currHE: number;
  alerts: { level: AlertLevel; text: string }[];
  isNew: boolean;
  isGone: boolean;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function prevCompetencia(ano: number, mes: number) {
  if (mes === 1) return { ano: ano - 1, mes: 12 };
  return { ano, mes: mes - 1 };
}

const alertIcon: Record<AlertLevel, string> = { red: "🔴", yellow: "🟡", blue: "🔵" };

export function ComparativoSheet({ open, onClose, ano, mes, currentRecords, onStatusChanged }: Props) {
  const { companyId } = useCompany();
  const [prevRecords, setPrevRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  const prev = prevCompetencia(ano, mes);

  const fetchPrev = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    let q = supabase
      .from("rh_payroll_monthly_records")
      .select("*, rh_employees!inner(nome_completo)")
      .eq("ano", prev.ano)
      .eq("mes", prev.mes)
      .eq("company_id", companyId);

    const { data } = await q;
    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      employee_name: r.employees?.nome_completo ?? "—",
    }));
    setPrevRecords(mapped);
    setLoading(false);
  }, [companyId, prev.ano, prev.mes]);

  useEffect(() => {
    if (open) fetchPrev();
  }, [open, fetchPrev]);

  const rows = useMemo<CompRow[]>(() => {
    const prevMap = new Map<string, PayrollRecord>();
    prevRecords.forEach(r => prevMap.set(r.employee_id, r));

    const currMap = new Map<string, PayrollRecord>();
    currentRecords.forEach(r => currMap.set(r.employee_id, r));

    const allIds = new Set([...prevMap.keys(), ...currMap.keys()]);
    const result: CompRow[] = [];

    allIds.forEach(id => {
      const p = prevMap.get(id);
      const c = currMap.get(id);
      const isNew = !p && !!c;
      const isGone = !!p && !c;

      const prevSal = Number(p?.salario_base) || 0;
      const currSal = Number(c?.salario_base) || 0;
      const prevTotal = Number(p?.total_geral) || 0;
      const currTotal = Number(c?.total_geral) || 0;
      const prevHE = Number(p?.he_total) || 0;
      const currHE = Number(c?.he_total) || 0;

      const alerts: { level: AlertLevel; text: string }[] = [];

      if (isNew) alerts.push({ level: "blue", text: "Novo — admissão" });
      if (isGone) alerts.push({ level: "red", text: "Ausente — desligamento?" });

      if (!isNew && !isGone) {
        const salDelta = pct(prevSal, currSal);
        if (Math.abs(salDelta) > 30) alerts.push({ level: "red", text: "Salário Δ>30% — verificar" });
        else if (Math.abs(salDelta) > 10) alerts.push({ level: "yellow", text: "Salário Δ>10% — possível reajuste" });

        if (prevHE > 0 || currHE > 0) {
          const heDelta = pct(prevHE, currHE);
          if (heDelta > 20) alerts.push({ level: "yellow", text: "HE Δ>20% — custo elevado" });
        }
      }

      result.push({
        cpf: (c ?? p)?.employee_id ?? "",
        name: (c?.employee_name ?? p?.employee_name) || "—",
        prevSalario: prevSal,
        currSalario: currSal,
        deltaSalPct: pct(prevSal, currSal),
        prevTotal,
        currTotal,
        deltaTotalPct: pct(prevTotal, currTotal),
        prevHE,
        currHE,
        alerts,
        isNew,
        isGone,
      });
    });

    // Sort: alerts first, then by name
    return result.sort((a, b) => {
      if (a.alerts.length !== b.alerts.length) return b.alerts.length - a.alerts.length;
      return a.name.localeCompare(b.name);
    });
  }, [prevRecords, currentRecords]);

  // Deltas
  const totalPrevFolha = prevRecords.reduce((s, r) => s + (Number(r.total_folha) || 0), 0);
  const totalCurrFolha = currentRecords.reduce((s, r) => s + (Number(r.total_folha) || 0), 0);
  const totalPrevEncargos = prevRecords.reduce((s, r) => s + (Number(r.encargos) || 0), 0);
  const totalCurrEncargos = currentRecords.reduce((s, r) => s + (Number(r.encargos) || 0), 0);
  const totalPrevGeral = prevRecords.reduce((s, r) => s + (Number(r.total_geral) || 0), 0);
  const totalCurrGeral = currentRecords.reduce((s, r) => s + (Number(r.total_geral) || 0), 0);
  const deltaHC = currentRecords.length - prevRecords.length;

  const markConferido = async () => {
    if (currentRecords.length === 0) return;
    setMarking(true);
    try {
      const ids = currentRecords.map(r => r.id);
      await supabase
        .from("rh_payroll_monthly_records")
        .update({ status: "conferido" })
        .in("id", ids);

      await supabase.from("rh_integration_logs").insert({
        source: "folha_mensal",
        direction: "internal",
        endpoint: "comparativo/conferido",
        status: "success" as const,
        request_payload: { ano, mes, count: ids.length } as any,
        response_payload: { action: "mark_conferido" } as any,
        company_id: companyId,
      });

      toast({ title: "Folha marcada como conferida!" });
      onStatusChanged();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setMarking(false);
    }
  };

  const alertCount = rows.filter(r => r.alerts.length > 0).length;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto" side="right">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Comparativo {monthNames[prev.mes - 1]} → {monthNames[mes - 1]} / {ano}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Delta Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <DeltaCard label="Δ Headcount" prev={prevRecords.length} curr={currentRecords.length} isCount />
              <DeltaCard label="Δ Folha" prev={totalPrevFolha} curr={totalCurrFolha} />
              <DeltaCard label="Δ Encargos" prev={totalPrevEncargos} curr={totalCurrEncargos} />
              <DeltaCard label="Δ Total" prev={totalPrevGeral} curr={totalCurrGeral} />
            </div>

            {alertCount > 0 && (
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                {alertCount} colaborador{alertCount !== 1 ? "es" : ""} com alerta
              </div>
            )}

            {/* Comparison Table */}
            <ScrollArea className="h-[400px] mb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-right">Sal. Ant</TableHead>
                    <TableHead className="text-right">Sal. Atual</TableHead>
                    <TableHead className="text-right">Δ%</TableHead>
                    <TableHead className="text-right">Total Ant</TableHead>
                    <TableHead className="text-right">Total Atual</TableHead>
                    <TableHead className="text-right">Δ%</TableHead>
                    <TableHead>Alerta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r.isGone ? "opacity-50" : ""}>
                      <TableCell className="font-medium text-sm">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{currency(r.prevSalario)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{currency(r.currSalario)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        <DeltaBadge value={r.deltaSalPct} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{currency(r.prevTotal)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{currency(r.currTotal)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        <DeltaBadge value={r.deltaTotalPct} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {r.alerts.map((a, j) => (
                            <div key={j} className="text-xs whitespace-nowrap">
                              {alertIcon[a.level]} {a.text}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Sem dados para comparação.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {prevRecords.length === 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                Não há registros em {monthNames[prev.mes - 1]}/{prev.ano} para comparação.
              </p>
            )}

            <Button
              className="w-full"
              onClick={markConferido}
              disabled={marking || currentRecords.length === 0}
            >
              {marking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Conferido — Marcar como Conferido
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DeltaCard({ label, prev, curr, isCount }: { label: string; prev: number; curr: number; isCount?: boolean }) {
  const delta = curr - prev;
  const deltaPctVal = prev === 0 ? (curr === 0 ? 0 : 100) : ((delta) / prev) * 100;
  const positive = delta >= 0;

  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums">
          {isCount ? curr : currency(curr)}
        </p>
        <div className="flex items-center gap-1 text-xs">
          {positive ? (
            <TrendingUp className="h-3 w-3 text-destructive" />
          ) : (
            <TrendingDown className="h-3 w-3 text-success" />
          )}
          <span className={positive ? "text-destructive" : "text-success"}>
            {isCount ? `${delta >= 0 ? "+" : ""}${delta}` : fmtPct(deltaPctVal)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  const color = Math.abs(value) > 30
    ? "text-destructive"
    : Math.abs(value) > 10
      ? "text-warning"
      : "text-muted-foreground";
  return <span className={color}>{fmtPct(value)}</span>;
}
