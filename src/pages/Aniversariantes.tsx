import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { Cake, Award, Users, CalendarDays, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useBirthdayData, type BirthdayEmployee, type WorkAnniversaryEmployee } from "@/hooks/useBirthdayData";

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

export default function Aniversariantes() {
  const {
    loading, employees, todayBirthdays, currentMonth, allByMonth,
    workAnniversaries, ageDistribution, averageAge, monthlyCount,
    deptDistribution, todayMonth, todayDay,
  } = useBirthdayData();

  const [selectedMonth, setSelectedMonth] = useState<number>(todayMonth);
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const monthEmployees = (allByMonth[selectedMonth] ?? []).filter(
    e => deptFilter === "all" || e.departamento === deptFilter
  );

  const uniqueDepts = Array.from(new Set(employees.map(e => e.departamento).filter(Boolean))) as string[];

  const ageChartData = Object.entries(ageDistribution).map(([range, count]) => ({ range, count }));

  const chartConfig = {
    count: { label: "Aniversariantes", color: "hsl(var(--primary))" },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Cake className="h-6 w-6" /> Aniversariantes
        </h1>
        <p className="text-muted-foreground text-sm">Calendário de aniversários e tempo de casa</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hoje</CardTitle>
            <div className="rounded-lg p-2 bg-primary/10"><Cake className="h-4 w-4 text-primary" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayBirthdays.length}</div>
            <p className="text-xs text-muted-foreground">{todayBirthdays.length > 0 ? todayBirthdays.map(e => e.nome_completo.split(" ")[0]).join(", ") : "Nenhum aniversariante"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{MONTH_NAMES[todayMonth - 1]}</CardTitle>
            <div className="rounded-lg p-2 bg-chart-2/10"><CalendarDays className="h-4 w-4 text-chart-2" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth.length}</div>
            <p className="text-xs text-muted-foreground">aniversariantes no mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Idade Média</CardTitle>
            <div className="rounded-lg p-2 bg-chart-3/10"><Users className="h-4 w-4 text-chart-3" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageAge} anos</div>
            <p className="text-xs text-muted-foreground">{employees.length} colaboradores ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marcos este mês</CardTitle>
            <div className="rounded-lg p-2 bg-warning/10"><Award className="h-4 w-4 text-warning" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workAnniversaries.filter(w => w.is_marco).length}</div>
            <p className="text-xs text-muted-foreground">aniversários de empresa</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Aniversariantes por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={monthlyCount}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {monthlyCount.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.mes === todayMonth ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.2)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Faixa Etária</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ageChartData.map(item => {
                const pct = employees.length > 0 ? (item.count / employees.length) * 100 : 0;
                return (
                  <div key={item.range} className="flex items-center gap-3">
                    <span className="text-sm w-12 text-muted-foreground">{item.range}</span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Annual calendar grid + work anniversaries */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Calendar */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Calendário Anual</CardTitle>
            <div className="flex gap-2">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueDepts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {/* Month selector pills */}
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 mb-4">
              {MONTH_NAMES.map((name, i) => {
                const m = i + 1;
                const count = (allByMonth[m] ?? []).filter(e => deptFilter === "all" || e.departamento === deptFilter).length;
                const isCurrent = m === todayMonth;
                const isSelected = m === selectedMonth;
                return (
                  <Button
                    key={m}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    className={`text-xs h-auto py-1.5 flex flex-col gap-0.5 ${isCurrent && !isSelected ? "ring-1 ring-primary/30" : ""}`}
                    onClick={() => setSelectedMonth(m)}
                  >
                    <span>{MONTH_SHORT[i]}</span>
                    <span className={`text-[10px] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{count}</span>
                  </Button>
                );
              })}
            </div>

            {/* Selected month list */}
            <div className="border rounded-lg">
              <div className="px-4 py-2 border-b bg-muted/30">
                <p className="text-sm font-medium">{MONTH_NAMES[selectedMonth - 1]} — {monthEmployees.length} aniversariante{monthEmployees.length !== 1 ? "s" : ""}</p>
              </div>
              <TooltipProvider>
                <div className="max-h-[400px] overflow-y-auto divide-y">
                  {monthEmployees.length > 0 ? monthEmployees.map(emp => {
                    const isToday = emp.dia === todayDay && selectedMonth === todayMonth;
                    return (
                      <Tooltip key={emp.id}>
                        <TooltipTrigger asChild>
                          <div className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 ${isToday ? "bg-primary/5" : ""}`}>
                            <span className="text-sm font-mono w-6 text-muted-foreground">{String(emp.dia).padStart(2, "0")}</span>
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(emp.nome_completo)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{emp.nome_completo}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{emp.departamento || "—"}</span>
                            <span className="text-xs text-muted-foreground">{emp.idade} anos</span>
                            {isToday && <Badge variant="secondary" className="text-[10px] border-0 bg-primary/10 text-primary">Hoje</Badge>}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">{emp.cargo || "Sem cargo"} · {emp.departamento || "—"}</p></TooltipContent>
                      </Tooltip>
                    );
                  }) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum aniversariante em {MONTH_NAMES[selectedMonth - 1]}.</p>
                  )}
                </div>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>

        {/* Work anniversaries */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" /> Tempo de Casa
            </CardTitle>
            <p className="text-xs text-muted-foreground">{MONTH_NAMES[todayMonth - 1]}</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {workAnniversaries.length > 0 ? workAnniversaries.map(emp => {
              const admDay = Number(emp.data_admissao.split("T")[0].split("-")[2]);
              return (
                <div key={emp.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-md ${emp.is_marco ? "bg-warning/5" : "hover:bg-muted/50"}`}>
                  <Award className={`h-3.5 w-3.5 shrink-0 ${emp.is_marco ? "text-warning" : "text-muted-foreground"}`} />
                  <span className="text-[10px] text-muted-foreground w-10 shrink-0">{String(admDay).padStart(2, "0")}/{String(todayMonth).padStart(2, "0")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{emp.nome_completo}</p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] border-0 shrink-0 ${emp.is_marco ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                    {emp.anos_empresa}a
                  </Badge>
                </div>
              );
            }) : (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum aniversário de empresa.</p>
            )}

            {/* Department distribution */}
            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Por Departamento</p>
              {deptDistribution.slice(0, 8).map(d => (
                <div key={d.name} className="flex items-center justify-between py-1">
                  <span className="text-xs truncate max-w-[120px]">{d.name}</span>
                  <span className="text-xs font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
