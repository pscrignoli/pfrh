import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, AlertTriangle, CalendarPlus, Download, Palmtree } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFerias, type EmployeeVacation, type VacationStatus } from "@/hooks/useFerias";
import { FeriasScheduleDialog } from "@/components/ferias/FeriasScheduleDialog";

const statusConfig: Record<VacationStatus, { label: string; color: string; badgeVariant: "destructive" | "default" | "secondary" | "outline" }> = {
  vencidas: { label: "Vencidas", color: "bg-red-500", badgeVariant: "destructive" },
  a_vencer: { label: "A Vencer", color: "bg-orange-500", badgeVariant: "default" },
  em_gozo: { label: "Em Gozo", color: "bg-emerald-500", badgeVariant: "default" },
  programadas: { label: "Programadas", color: "bg-blue-500", badgeVariant: "default" },
  em_dia: { label: "Em Dia", color: "bg-muted", badgeVariant: "secondary" },
};

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Ferias() {
  const [search, setSearch] = useState("");
  const [departamento, setDepartamento] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeVacation | null>(null);

  const { vacationData, summary, departamentos, loading, saveFerias } = useFerias({
    search,
    departamento,
    statusFilter,
  });

  const handleSchedule = (emp: EmployeeVacation) => {
    setSelectedEmployee(emp);
    setDialogOpen(true);
  };

  const today = new Date();
  const currentYear = today.getFullYear();

  // Build 12-month timeline starting from current month
  const timelineMonths: { month: number; year: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, today.getMonth() + i, 1);
    timelineMonths.push({
      month: d.getMonth(),
      year: d.getFullYear(),
      label: `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
    });
  }

  const getBarForMonth = (emp: EmployeeVacation, m: number, y: number) => {
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);

    // Check scheduled/active vacation overlaps
    for (const f of emp.feriasRegistros) {
      if (f.data_inicio && f.data_fim) {
        const fStart = new Date(f.data_inicio);
        const fEnd = new Date(f.data_fim);
        if (fStart <= monthEnd && fEnd >= monthStart) {
          if (f.status === "gozada" || (fEnd < today && f.status === "aprovada")) {
            return "bg-emerald-500/70";
          }
          if (fStart <= today && fEnd >= today) {
            return "bg-emerald-500";
          }
          return "bg-blue-500";
        }
      }
    }

    // Vencimento falls in this month
    if (emp.vencimentoEm >= monthStart && emp.vencimentoEm <= monthEnd) {
      if (emp.status === "vencidas") return "bg-red-500";
      if (emp.status === "a_vencer") return "bg-orange-500";
    }

    return null;
  };

  // Build alerts
  const alerts = vacationData
    .filter((e) => e.status === "vencidas" || e.status === "a_vencer" || e.status === "programadas")
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Palmtree className="h-6 w-6 text-emerald-600" />
            Gestão de Férias
          </h1>
          <p className="text-muted-foreground text-sm">Controle de períodos aquisitivos e programação de férias</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.vencidas}</p>
            <p className="text-xs font-medium text-red-600">Vencidas</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{summary.a_vencer}</p>
            <p className="text-xs font-medium text-orange-600">A Vencer (90d)</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{summary.programadas}</p>
            <p className="text-xs font-medium text-blue-600">Programadas</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{summary.em_gozo}</p>
            <p className="text-xs font-medium text-emerald-600">Em Gozo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{summary.em_dia}</p>
            <p className="text-xs font-medium text-muted-foreground">Em Dia</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={departamento ?? "todos"} onValueChange={(v) => setDepartamento(v === "todos" ? null : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Departamentos</SelectItem>
            {departamentos.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter ?? "todos"} onValueChange={(v) => setStatusFilter(v === "todos" ? null : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="vencidas">Vencidas</SelectItem>
            <SelectItem value="a_vencer">A Vencer</SelectItem>
            <SelectItem value="programadas">Programadas</SelectItem>
            <SelectItem value="em_gozo">Em Gozo</SelectItem>
            <SelectItem value="em_dia">Em Dia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Alertas de Férias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {alerts.map((a) => {
              const cfg = statusConfig[a.status];
              const emoji = a.status === "vencidas" ? "🔴" : a.status === "a_vencer" ? "🟠" : "🔵";
              let msg = "";
              if (a.status === "vencidas") {
                msg = `Férias VENCIDAS há ${Math.abs(a.diasParaVencimento)} dias (período ${format(a.periodoAquisitivoInicio, "MM/yyyy")}-${format(a.periodoAquisitivoFim, "MM/yyyy")})`;
              } else if (a.status === "a_vencer") {
                msg = `Férias vencem em ${a.diasParaVencimento} dias (${format(a.vencimentoEm, "dd/MM/yyyy")})`;
              } else if (a.status === "programadas" && a.feriasAtual?.data_inicio) {
                msg = `Férias programadas para ${format(new Date(a.feriasAtual.data_inicio), "dd/MM/yyyy")}`;
              }

              return (
                <button
                  key={a.employeeId}
                  onClick={() => handleSchedule(a)}
                  className="w-full flex items-center gap-2 text-left text-sm hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{a.nome}</span>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-muted-foreground flex-1 truncate">{msg}</span>
                  <Badge variant={cfg.badgeVariant} className="text-[10px] h-5">
                    {cfg.label}
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Gantt Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Quadro de Férias — Timeline 12 Meses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Colaborador</TableHead>
                    <TableHead className="min-w-[80px]">Status</TableHead>
                    <TableHead className="min-w-[100px]">Vencimento</TableHead>
                    {timelineMonths.map((m) => (
                      <TableHead key={m.label} className="text-center min-w-[48px] text-xs px-1">
                        {m.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacationData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15 + timelineMonths.length} className="text-center py-8 text-muted-foreground">
                        Nenhum colaborador encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    vacationData.map((emp) => {
                      const cfg = statusConfig[emp.status];
                      return (
                        <TableRow key={emp.employeeId} className="hover:bg-muted/30">
                          <TableCell className="sticky left-0 bg-background z-10">
                            <div>
                              <p className="font-medium text-sm truncate max-w-[180px]">{emp.nome}</p>
                              <p className="text-[11px] text-muted-foreground">{emp.departamento ?? "—"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={cfg.badgeVariant} className="text-[10px] h-5 whitespace-nowrap">
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {format(emp.vencimentoEm, "dd/MM/yyyy")}
                            {emp.status === "vencidas" && (
                              <span className="block text-red-600 font-medium">
                                há {Math.abs(emp.diasParaVencimento)}d
                              </span>
                            )}
                            {emp.status === "a_vencer" && (
                              <span className="block text-orange-600 font-medium">
                                em {emp.diasParaVencimento}d
                              </span>
                            )}
                          </TableCell>
                          {timelineMonths.map((m) => {
                            const bar = getBarForMonth(emp, m.month, m.year);
                            return (
                              <TableCell key={m.label} className="px-0.5 py-2">
                                {bar ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={`h-5 rounded-sm ${bar} cursor-pointer`} />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{emp.nome}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Per. Aq.: {format(emp.periodoAquisitivoInicio, "dd/MM/yy")} - {format(emp.periodoAquisitivoFim, "dd/MM/yy")}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <div className="h-5" />
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleSchedule(emp)}
                            >
                              <CalendarPlus className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FeriasScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={selectedEmployee}
        onSave={saveFerias}
      />
    </div>
  );
}
