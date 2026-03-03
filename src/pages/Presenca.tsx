import { useState } from "react";
import { usePresencaData } from "@/hooks/usePresencaData";
import { LiveStatusPanel } from "@/components/presenca/LiveStatusPanel";
import { TimeRecordsTable } from "@/components/presenca/TimeRecordsTable";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function Presenca() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days">("today");

  const { liveStatuses, records, employees, loading } = usePresencaData({ employeeId, dateRange });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presença e Jornada</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe a jornada dos colaboradores em tempo real.
        </p>
      </div>

      <LiveStatusPanel statuses={liveStatuses} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={employeeId ?? "all"}
          onValueChange={(v) => setEmployeeId(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todos os colaboradores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os colaboradores</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7days">Últimos 7 dias</SelectItem>
            <SelectItem value="30days">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TimeRecordsTable records={records} />
    </div>
  );
}
