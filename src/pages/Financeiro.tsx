import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useFinanceiroData, type PayrollRecord } from "@/hooks/useFinanceiroData";
import { PayrollDetailSheet } from "@/components/financeiro/PayrollDetailSheet";
import { PayrollImportSheet } from "@/components/financeiro/PayrollImportSheet";
import { IntegrationLogsPanel } from "@/components/financeiro/IntegrationLogsPanel";
import { ComparativoSheet } from "@/components/financeiro/ComparativoSheet";
import { FechamentoDialog } from "@/components/financeiro/FechamentoDialog";
import { TransmitPreviewDialog } from "@/components/financeiro/TransmitPreviewDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Send, Upload, GitCompareArrows, Lock, Unlock, Calculator, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { isDiretor } from "@/utils/isDiretor";
import { SalarioProtegido } from "@/components/SalarioProtegido";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function currency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const statusColors: Record<string, string> = {
  aberto: "bg-muted text-muted-foreground",
  importado: "bg-muted text-muted-foreground",
  calculado: "bg-info text-info-foreground",
  conferido: "bg-warning/20 text-warning",
  fechado: "bg-success text-success-foreground",
  enviado: "bg-success text-success-foreground",
};

export default function Financeiro() {
  const { companyId } = useCompany();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [comparativoOpen, setComparativoOpen] = useState(false);
  const [fechamentoOpen, setFechamentoOpen] = useState(false);
  const [transmitOpen, setTransmitOpen] = useState(false);
  const [calculando, setCalculando] = useState(false);

  const { canEdit, canView } = usePermissions();
  const canEditFolha = canEdit("folha");
  const canViewSalarioDiretoria = canView("salario_diretoria");

  const { records, logs, loading, refetch } = useFinanceiroData(ano, mes);

  // Derived status for the month
  const mesStatus = useMemo(() => {
    if (records.length === 0) return "aberto";
    const statuses = records.map(r => r.status ?? "aberto");
    if (statuses.every(s => s === "enviado")) return "enviado";
    if (statuses.every(s => s === "fechado")) return "fechado";
    if (statuses.every(s => s === "conferido")) return "conferido";
    if (statuses.every(s => s === "calculado")) return "calculado";
    return statuses[0] ?? "aberto";
  }, [records]);

  const isFechado = mesStatus === "fechado" || mesStatus === "enviado";
  const isConferido = mesStatus === "conferido";
  const isCalculado = mesStatus === "calculado";
  const allSent = records.length > 0 && records.every(r => r.status === "enviado");

  // ── Calcular Provisões ──
  const calcularProvisoes = useCallback(async () => {
    if (records.length === 0 || !companyId) return;
    setCalculando(true);
    try {
      const now = new Date();
      const mesAtual = now.getMonth() + 1;
      // Avos = meses trabalhados no ano (simplificado: mes da competência)
      const avosFeriasDefault = mes; // meses no ano até a competência

      const batchSize = 50;
      const updates: { id: string; data: Record<string, unknown> }[] = [];

      for (const r of records) {
        const salBase = Number(r.salario_base) || 0;
        if (salBase === 0) continue;

        const patch: Record<string, unknown> = {};
        let changed = false;

        // Férias: salário_base * avos / 12
        const avos = Number(r.avos_ferias) || avosFeriasDefault;
        if (!r.avos_ferias) patch.avos_ferias = avos;

        const feriasCalc = (salBase * avos) / 12;
        if (!Number(r.ferias)) { patch.ferias = feriasCalc; changed = true; }
        const feriasVal = Number(r.ferias) || feriasCalc;

        // 1/3 férias
        const tercoCalc = feriasVal / 3;
        if (!Number(r.terco_ferias)) { patch.terco_ferias = tercoCalc; changed = true; }
        const tercoVal = Number(r.terco_ferias) || tercoCalc;

        // FGTS sobre férias (8%)
        const fgtsFeriasCalc = (feriasVal + tercoVal) * 0.08;
        if (!Number(r.fgts_ferias)) { patch.fgts_ferias = fgtsFeriasCalc; changed = true; }

        // INSS sobre férias (20% patronal)
        const inssFeriasCalc = (feriasVal + tercoVal) * 0.20;
        if (!Number(r.inss_ferias)) { patch.inss_ferias = inssFeriasCalc; changed = true; }

        // 13º: salário_base * avos / 12
        const decimoCalc = (salBase * avos) / 12;
        if (!Number(r.decimo_terceiro)) { patch.decimo_terceiro = decimoCalc; changed = true; }
        const decimoVal = Number(r.decimo_terceiro) || decimoCalc;

        // FGTS sobre 13º (8%)
        const fgts13Calc = decimoVal * 0.08;
        if (!Number(r.fgts_13)) { patch.fgts_13 = fgts13Calc; changed = true; }

        // INSS sobre 13º (20% patronal)
        const inss13Calc = decimoVal * 0.20;
        if (!Number(r.inss_13)) { patch.inss_13 = inss13Calc; changed = true; }

        if (changed) {
          // Recalculate total_geral
          const totalFolha = Number(r.total_folha) || 0;
          const encargos = Number(r.encargos) || 0;
          const provisoes = (Number(patch.ferias ?? r.ferias) || 0)
            + (Number(patch.terco_ferias ?? r.terco_ferias) || 0)
            + (Number(patch.fgts_ferias ?? r.fgts_ferias) || 0)
            + (Number(patch.inss_ferias ?? r.inss_ferias) || 0)
            + (Number(patch.decimo_terceiro ?? r.decimo_terceiro) || 0)
            + (Number(patch.fgts_13 ?? r.fgts_13) || 0)
            + (Number(patch.inss_13 ?? r.inss_13) || 0);
          const beneficios = Number(r.beneficios) || 0;
          patch.total_geral = totalFolha + encargos + provisoes + beneficios;
          patch.status = "calculado";
          updates.push({ id: r.id, data: patch });
        }
      }

      // Batch update
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await Promise.all(batch.map(u =>
          supabase.from("payroll_monthly_records").update(u.data as any).eq("id", u.id)
        ));
      }

      // Mark records that were already complete as calculado too
      const unchangedIds = records.filter(r => !updates.find(u => u.id === r.id)).map(r => r.id);
      if (unchangedIds.length > 0) {
        await supabase.from("payroll_monthly_records").update({ status: "calculado" }).in("id", unchangedIds);
      }

      // Log
      await supabase.from("integration_logs").insert({
        source: "folha_mensal",
        direction: "internal",
        endpoint: "provisoes/calcular",
        status: "success" as const,
        request_payload: { ano, mes, calculated: updates.length, unchanged: unchangedIds.length } as any,
        response_payload: { status: "calculado" } as any,
        company_id: companyId,
      });

      toast({
        title: "Provisões calculadas!",
        description: `${updates.length} registro(s) calculado(s), ${unchangedIds.length} já preenchido(s).`,
      });
      refetch();
    } catch (e: any) {
      toast({ title: "Erro ao calcular provisões", description: e.message, variant: "destructive" });
    } finally {
      setCalculando(false);
    }
  }, [records, companyId, ano, mes, refetch]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const totalGeral = records.reduce((s, r) => s + (Number(r.total_geral) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fechamento da Folha</h1>
          <p className="text-muted-foreground text-sm">
            Fechamento de folha — {records.length} registro{records.length !== 1 ? "s" : ""} · Total: {currency(totalGeral)}
            {isFechado && (
              <Badge className="ml-2 border-0 bg-success text-success-foreground text-xs">Mês Fechado</Badge>
            )}
            {isConferido && (
              <Badge className="ml-2 border-0 bg-warning/20 text-warning text-xs">Conferido</Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canEditFolha && (
            <Button variant="outline" onClick={() => setImportOpen(true)} disabled={isFechado}>
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
          )}

          <Button
            variant="outline"
            onClick={calcularProvisoes}
            disabled={records.length === 0 || isFechado || calculando}
          >
            {calculando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
            Provisões
          </Button>

          <Button variant="outline" onClick={() => setComparativoOpen(true)} disabled={records.length === 0}>
            <GitCompareArrows className="h-4 w-4 mr-2" />
            Comparativo
          </Button>

          {/* Fechar / Reabrir */}
          {isFechado ? (
            <Button variant="outline" onClick={() => setFechamentoOpen(true)}>
              <Unlock className="h-4 w-4 mr-2" />
              Reabrir
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setFechamentoOpen(true)}
              disabled={records.length === 0}
            >
              <Lock className="h-4 w-4 mr-2" />
              Fechar Mês
            </Button>
          )}

          <Button
            onClick={() => setTransmitOpen(true)}
            disabled={allSent || records.length === 0 || (!isFechado && !isConferido)}
          >
            <Send className="h-4 w-4 mr-2" />
            {allSent ? "Já Transmitido" : "Transmitir"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="folha">
        <TabsList>
          <TabsTrigger value="folha">Fechamento Mensal</TabsTrigger>
          <TabsTrigger value="logs">Logs de Integração ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="folha" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead className="text-right">Salário Base</TableHead>
                    <TableHead className="text-right">Total Folha</TableHead>
                    <TableHead className="text-right">Encargos</TableHead>
                    <TableHead className="text-right">Provisões</TableHead>
                    <TableHead className="text-right">Total Geral</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => {
                    const provisoes = (Number(r.ferias) || 0) + (Number(r.terco_ferias) || 0) + (Number(r.decimo_terceiro) || 0);
                    const st = r.status ?? "aberto";
                    const empObj = { cargo: r.cargo };
                    const salarioOculto = isDiretor(empObj) && !canViewSalarioDiretoria;
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedRecord(r)}>
                        <TableCell className="font-medium">{r.employee_name}</TableCell>
                        <TableCell className="text-xs">{r.centro_custo || r.codigo_centro_custo || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {salarioOculto ? <SalarioProtegido valor={null} employee={empObj} /> : currency(r.salario_base)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {salarioOculto ? <SalarioProtegido valor={null} employee={empObj} /> : currency(r.total_folha)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {salarioOculto ? <SalarioProtegido valor={null} employee={empObj} /> : currency(r.encargos)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {salarioOculto ? <SalarioProtegido valor={null} employee={empObj} /> : currency(provisoes)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {salarioOculto ? <SalarioProtegido valor={null} employee={empObj} /> : currency(r.total_geral)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`border-0 text-xs ${statusColors[st] ?? statusColors.aberto}`}>
                            {st.charAt(0).toUpperCase() + st.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                        Nenhum registro de folha encontrado para {monthNames[mes - 1]}/{ano}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <IntegrationLogsPanel logs={logs} />
        </TabsContent>
      </Tabs>

      <PayrollDetailSheet
        record={selectedRecord}
        open={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      <PayrollImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(importedAno, importedMes) => {
          setAno(importedAno);
          setMes(importedMes);
          refetch();
        }}
      />

      <ComparativoSheet
        open={comparativoOpen}
        onClose={() => setComparativoOpen(false)}
        ano={ano}
        mes={mes}
        currentRecords={records}
        onStatusChanged={refetch}
      />

      <FechamentoDialog
        open={fechamentoOpen}
        onClose={() => setFechamentoOpen(false)}
        ano={ano}
        mes={mes}
        recordIds={records.map(r => r.id)}
        currentStatus={mesStatus}
        onDone={refetch}
      />

      <TransmitPreviewDialog
        open={transmitOpen}
        onClose={() => setTransmitOpen(false)}
        ano={ano}
        mes={mes}
        records={records}
        onTransmitted={refetch}
      />
    </div>
  );
}
