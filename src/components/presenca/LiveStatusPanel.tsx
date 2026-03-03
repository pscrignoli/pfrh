import { EmployeeStatus } from "@/hooks/usePresencaData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Wifi } from "lucide-react";

const statusConfig = {
  working: { label: "Trabalhando", color: "bg-success", badgeClass: "bg-success text-success-foreground" },
  break: { label: "Em Pausa", color: "bg-warning", badgeClass: "bg-warning text-warning-foreground" },
  absent: { label: "Ausente", color: "bg-muted-foreground/40", badgeClass: "bg-muted text-muted-foreground" },
} as const;

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function LiveStatusPanel({ statuses }: { statuses: EmployeeStatus[] }) {
  const working = statuses.filter((s) => s.status === "working").length;
  const onBreak = statuses.filter((s) => s.status === "break").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Status ao Vivo
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-success font-medium">
            <Wifi className="h-3.5 w-3.5 animate-pulse" />
            Tempo Real
          </div>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{working} trabalhando</span>
          <span>{onBreak} em pausa</span>
          <span>{statuses.length - working - onBreak} ausentes</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {statuses.map((emp) => {
            const cfg = statusConfig[emp.status];
            return (
              <div
                key={emp.employeeId}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${cfg.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{emp.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{emp.cargo ?? emp.departamento ?? "—"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={`text-[10px] px-1.5 py-0 ${cfg.badgeClass} border-0`}>{cfg.label}</Badge>
                  {emp.clockIn && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(emp.clockIn)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {statuses.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-8">
              Nenhum colaborador ativo encontrado.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
