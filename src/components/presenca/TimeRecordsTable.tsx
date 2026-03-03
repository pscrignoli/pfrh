import { TimeRecordRow } from "@/hooks/usePresencaData";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

export function TimeRecordsTable({ records }: { records: TimeRecordRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Espelho de Ponto</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Saída Pausa</TableHead>
              <TableHead>Retorno Pausa</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">HE</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.employeeName}</TableCell>
                <TableCell>{fmtDate(r.recordDate)}</TableCell>
                <TableCell>{fmt(r.clockIn)}</TableCell>
                <TableCell>{fmt(r.breakStart)}</TableCell>
                <TableCell>{fmt(r.breakEnd)}</TableCell>
                <TableCell>{fmt(r.clockOut)}</TableCell>
                <TableCell className="text-right">{r.totalHours?.toFixed(1) ?? "—"}</TableCell>
                <TableCell className="text-right">{r.overtimeHours?.toFixed(1) ?? "0"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">
                    {r.source ?? "manual"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.hasAnomaly && (
                    <div className="flex items-center gap-1 text-destructive" title="Risco de Horas Extras">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium hidden sm:inline">Risco HE</span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Nenhum registro encontrado para os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
