import { useState, useMemo } from "react";
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
import { Send, Upload, GitCompareArrows, Lock, Unlock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [comparativoOpen, setComparativoOpen] = useState(false);
  const [fechamentoOpen, setFechamentoOpen] = useState(false);
  const [transmitOpen, setTransmitOpen] = useState(false);

  const { records, logs, loading, refetch } = useFinanceiroData(ano, mes);

  // Derived status for the month
  const mesStatus = useMemo(() => {
    if (records.length === 0) return "aberto";
    const statuses = records.map(r => r.status ?? "aberto");
    if (statuses.every(s => s === "enviado")) return "enviado";
    if (statuses.every(s => s === "fechado")) return "fechado";
    if (statuses.every(s => s === "conferido")) return "conferido";
    return statuses[0] ?? "aberto";
  }, [records]);

  const isFechado = mesStatus === "fechado" || mesStatus === "enviado";
  const isConferido = mesStatus === "conferido";
  const allSent = records.length > 0 && records.every(r => r.status === "enviado");

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

          <Button variant="outline" onClick={() => setImportOpen(true)} disabled={isFechado}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
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
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedRecord(r)}>
                        <TableCell className="font-medium">{r.employee_name}</TableCell>
                        <TableCell className="text-xs">{r.centro_custo || r.codigo_centro_custo || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{currency(r.salario_base)}</TableCell>
                        <TableCell className="text-right tabular-nums">{currency(r.total_folha)}</TableCell>
                        <TableCell className="text-right tabular-nums">{currency(r.encargos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{currency(provisoes)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{currency(r.total_geral)}</TableCell>
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
        ano={ano}
        mes={mes}
        existingCount={records.length}
        onImported={refetch}
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
