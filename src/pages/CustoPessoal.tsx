import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  DollarSign, Users, TrendingUp, TrendingDown, AlertTriangle,
  Banknote, Shield, HeartPulse, UserCheck, Wallet, Download,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, ComposedChart, Line,
} from "recharts";
import { useCustoPessoal } from "@/hooks/useCustoPessoal";
import DeptDetailAccordion from "@/components/custo-pessoal/DeptDetailAccordion";
import { exportCustoPessoalXlsx } from "@/utils/exportCustoPessoalXlsx";

const monthNames = [
  "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
const monthFull = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function currency(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}

function pct(v: number) {
  return `${v.toFixed(1)}%`;
}

const CHART_COLORS = {
  salarios: "hsl(217, 70%, 50%)",
  encargos: "hsl(270, 60%, 55%)",
  beneficios: "hsl(142, 60%, 45%)",
  headcount: "hsl(0, 0%, 45%)",
};

const PIE_COLORS = [
  "hsl(217, 70%, 50%)",
  "hsl(270, 60%, 55%)",
  "hsl(142, 60%, 45%)",
  "hsl(40, 80%, 50%)",
  "hsl(350, 70%, 50%)",
  "hsl(187, 70%, 45%)",
];

export default function CustoPessoal() {
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(currentYear);
  const [departamento, setDepartamento] = useState<string | null>(null);

  const {
    loading, monthsData, currentMonth, previousMonth,
    deptCosts, topEmployees, costBreakdown, alerts, departamentos,
  } = useCustoPessoal(ano, departamento);

  const deltaTotal = useMemo(() => {
    if (!currentMonth || !previousMonth || previousMonth.total === 0) return null;
    return ((currentMonth.total - previousMonth.total) / previousMonth.total) * 100;
  }, [currentMonth, previousMonth]);

  const chartData = useMemo(() =>
    monthsData.map(m => ({
      name: `${monthNames[m.mes]}/${String(m.ano).slice(2)}`,
      Salários: m.salarios,
      Encargos: m.encargos,
      Benefícios: m.beneficios,
      Headcount: m.headcount,
      "Líquido (Cash Flow)": m.salario_liquido,
    })), [monthsData]);

  const deltaLiquido = useMemo(() => {
    if (!currentMonth || !previousMonth || previousMonth.salario_liquido === 0) return null;
    return ((currentMonth.salario_liquido - previousMonth.salario_liquido) / previousMonth.salario_liquido) * 100;
  }, [currentMonth, previousMonth]);

  const pieData = useMemo(() => {
    if (!currentMonth) return [];
    const total = currentMonth.total || 1;
    const salBase = currentMonth.salarios;
    const items = [
      { name: "Salários", value: salBase },
      { name: "INSS Empresa", value: currentMonth.inss_empresa },
      { name: "FGTS", value: currentMonth.fgts },
      { name: "Plano de Saúde", value: currentMonth.plano_saude },
      { name: "Prov. Férias", value: currentMonth.provisao_ferias },
      { name: "Prov. 13º", value: currentMonth.provisao_13 },
    ].filter(i => i.value > 0);
    return items;
  }, [currentMonth]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Custo de Pessoal</h1>
          <p className="text-sm text-muted-foreground">
            Análise detalhada de custos com pessoal
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={departamento ?? "all"} onValueChange={v => setDepartamento(v === "all" ? null : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {departamentos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <Badge key={i} variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {a}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      {currentMonth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <SummaryCard
            title="Custo Total"
            value={currency(currentMonth.total)}
            subtitle={`${monthFull[currentMonth.mes]}/${currentMonth.ano}`}
            delta={deltaTotal}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <SummaryCard
            title="Salário Líquido"
            value={currency(currentMonth.salario_liquido)}
            subtitle="Cash Flow mensal"
            delta={deltaLiquido}
            icon={<Wallet className="h-4 w-4" />}
          />
          <SummaryCard
            title="Per Capita"
            value={currency(currentMonth.total / (currentMonth.headcount || 1))}
            subtitle={`${currentMonth.headcount} colaboradores`}
            icon={<UserCheck className="h-4 w-4" />}
          />
          <SummaryCard
            title="Folha Bruta"
            value={currency(currentMonth.salarios)}
            subtitle={`${pct((currentMonth.salarios / (currentMonth.total || 1)) * 100)} do custo total`}
            icon={<Banknote className="h-4 w-4" />}
          />
          <SummaryCard
            title="Encargos"
            value={currency(currentMonth.encargos)}
            subtitle={`${pct((currentMonth.encargos / (currentMonth.total || 1)) * 100)} do custo total`}
            icon={<Shield className="h-4 w-4" />}
          />
          <SummaryCard
            title="Benefícios"
            value={currency(currentMonth.beneficios)}
            subtitle={`${pct((currentMonth.beneficios / (currentMonth.total || 1)) * 100)} do custo total`}
            icon={<HeartPulse className="h-4 w-4" />}
          />
        </div>
      )}

      {!currentMonth && (
        <Card>
          <CardContent className="flex items-center justify-center h-40 text-muted-foreground">
            Nenhum dado de folha encontrado para {ano}. Importe competências na tela de Fechamento.
          </CardContent>
        </Card>
      )}

      {/* Evolution Chart + Composition */}
      {currentMonth && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length <= 1 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground text-sm gap-2">
                  <TrendingUp className="h-8 w-8 opacity-40" />
                  {chartData.length === 1
                    ? "Apenas 1 mês importado. Importe mais meses para ver a evolução."
                    : "Sem dados para exibir."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <RTooltip
                      formatter={(value: number, name: string) => [currency(value), name]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="Salários" stackId="1" fill={CHART_COLORS.salarios} stroke={CHART_COLORS.salarios} fillOpacity={0.6} />
                    <Area yAxisId="left" type="monotone" dataKey="Encargos" stackId="1" fill={CHART_COLORS.encargos} stroke={CHART_COLORS.encargos} fillOpacity={0.6} />
                    <Area yAxisId="left" type="monotone" dataKey="Benefícios" stackId="1" fill={CHART_COLORS.beneficios} stroke={CHART_COLORS.beneficios} fillOpacity={0.6} />
                    <Line yAxisId="right" type="monotone" dataKey="Headcount" stroke={CHART_COLORS.headcount} strokeDasharray="5 5" dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Composição do Custo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: number) => [currency(v), ""]} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-lg font-bold mt-2">{currency(currentMonth.total)}</p>
              <p className="text-center text-xs text-muted-foreground">{monthFull[currentMonth.mes]}/{currentMonth.ano}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dept cost */}
      {currentMonth && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custo por Departamento</CardTitle>
          </CardHeader>
          <CardContent>
            {deptCosts.filter(d => d.departamento !== "Diretoria").length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, deptCosts.filter(d => d.departamento !== "Diretoria").length * 40)}>
                <BarChart data={deptCosts.filter(d => d.departamento !== "Diretoria")} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="departamento" width={120} tick={{ fontSize: 11 }} />
                  <RTooltip
                    formatter={(v: number, _: string, entry: any) => [
                      `${currency(v)} (${entry.payload.headcount} colab. | Per capita: ${currency(entry.payload.perCapita)})`,
                      "Custo"
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: "0.75rem",
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost breakdown table */}
      {costBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalhamento por Componente</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Componente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">% Custo</TableHead>
                  <TableHead className="text-right">Per Capita</TableHead>
                  <TableHead className="text-right">vs Mês Ant.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costBreakdown.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(row.value)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(row.pct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(row.perCapita)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.deltaVsAnterior != null ? (
                        <span className={row.deltaVsAnterior > 0 ? "text-destructive" : "text-green-600"}>
                          {row.deltaVsAnterior > 0 ? "+" : ""}{pct(row.deltaVsAnterior)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {currentMonth && (
                  <TableRow className="font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(currentMonth.total)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(currentMonth.total / (currentMonth.headcount || 1))}</TableCell>
                    <TableCell className="text-right">
                      {deltaTotal != null ? (
                        <span className={deltaTotal > 0 ? "text-destructive" : "text-green-600"}>
                          {deltaTotal > 0 ? "+" : ""}{pct(deltaTotal)}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --- Summary Card Component --- */
function SummaryCard({ title, value, subtitle, delta, icon }: {
  title: string;
  value: string;
  subtitle: string;
  delta?: number | null;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{subtitle}</span>
          {delta != null && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? "text-destructive" : "text-green-600"}`}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
