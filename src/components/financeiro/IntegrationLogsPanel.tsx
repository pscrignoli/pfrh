import type { IntegrationLog } from "@/hooks/useFinanceiroData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollText } from "lucide-react";

export function IntegrationLogsPanel({ logs }: { logs: IntegrationLog[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          Logs de Integração
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Direção</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs tabular-nums">
                  {new Date(log.created_at).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">{log.direction}</Badge>
                </TableCell>
                <TableCell className="text-xs font-mono">{log.endpoint ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={`border-0 text-xs ${log.status === "success" ? "bg-success text-success-foreground" : log.status === "error" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>
                    {log.status === "success" ? "Sucesso" : log.status === "error" ? "Erro" : "Pendente"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">
                  {log.error_message ?? "OK"}
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum log de integração encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
