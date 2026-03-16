import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  HeartPulse, DollarSign, Building2, Users, TrendingUp, TrendingDown,
  AlertTriangle, Info, AlertCircle, Download, ShieldCheck, Trash2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, ComposedChart, Line,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import { SalarioProtegido } from "@/components/SalarioProtegido";
import { useSalarioRestrito } from "@/components/SalarioProtegido";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { ConferenciaFaturaFolha } from "@/components/saude/ConferenciaFaturaFolha";
import * as XLSX from "xlsx";

const COLORS = {
  unimedMedico: "hsl(217, 70%, 50%)",
  bradescoMedico: "hsl(0, 70%, 50%)",
  dental: "hsl(142, 60%, 45%)",
  copart: "hsl(45, 90%, 50%)",
  vidas: "hsl(270, 60%, 55%)",
};

const PIE_COLORS = [
  "hsl(217, 70%, 50%)", "hsl(200, 60%, 45%)", "hsl(180, 50%, 45%)",
  "hsl(0, 70%, 50%)", "hsl(20, 70%, 50%)", "hsl(142, 60%, 45%)",
  "hsl(270, 60%, 55%)", "hsl(45, 90%, 50%)",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toFixed(1)}%`;

export default function Saude() {
  const [competencia, setCompetencia] = useState<string | null>(null);
  const [planoFilter, setPlanoFilter] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { canView } = usePermissions();
  const { companyId } = useCompany();

  const {
    loading, competencias, summary, evolution, planSlices,
    empresaVsColab, deptHealth, topCosts, ageBands,
    titularVsDep, alerts, titularGroups, currentCompetencia, records,
  } = useHealthDashboard(competencia, planoFilter);

  const competenciaLabel = useMemo(() => {
    if (!currentCompetencia) return "";
    const d = new Date(currentCompetencia + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [currentCompetencia]);

  const handleExport = () => {
    if (records.length === 0) return;
    const rows = records.map(r => ({
      "Titular": r.parentesco === "titular" ? r.nome_beneficiario : (r.titular_nome || ""),
      "Beneficiário": r.nome_beneficiario,
      "Parentesco": r.parentesco,
      "Plano": r.descricao_plano || r.codigo_plano || r.fonte,
      "Mensalidade": r.mensalidade,
      "Parte Empresa": r.parte_empresa,
      "Parte Colaborador": r.parte_colaborador,
      "Coparticipação": r.coparticipacao,
      "Total": r.valor_total || r.mensalidade,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Saude");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saude_${currentCompetencia || "export"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  if (competencias.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" /> Saúde &amp; Benefícios
          </h1>
          <p className="text-muted-foreground">Dashboard de planos de saúde e odontológicos</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
            <HeartPulse className="h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">Nenhuma fatura importada</p>
            <p className="text-sm">Vá para Saúde &gt; Importar Fatura para começar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" /> Saúde &amp; Benefícios
          </h1>
          <p className="text-muted-foreground capitalize">{competenciaLabel}</p>
        </div>
        <div className="flex gap-2">
          <Select value={currentCompetencia ?? ""} onValueChange={v => setCompetencia(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Competência" /></SelectTrigger>
            <SelectContent>
              {competencias.map(c => {
                const d = new Date(c + "T00:00:00");
                return <SelectItem key={c} value={c}>{d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={planoFilter ?? "all"} onValueChange={v => setPlanoFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Plano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="unimed">Unimed</SelectItem>
              <SelectItem value="bradesco">Bradesco</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleExport} title="Exportar XLSX">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="conferencia" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Conferência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-0">

      {/* 10. Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <Badge
              key={i}
              variant={a.tipo === "critico" ? "destructive" : "secondary"}
              className="gap-1"
            >
              {a.tipo === "critico" ? <AlertTriangle className="h-3 w-3" /> :
               a.tipo === "atencao" ? <AlertCircle className="h-3 w-3" /> :
               <Info className="h-3 w-3" />}
              {a.msg}
            </Badge>
          ))}
        </div>
      )}

      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="Custo Total Saúde"
          value={fmt(summary.custoTotal)}
          delta={summary.deltaPct}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <SummaryCard
          title="Parte Empresa"
          value={fmt(summary.parteEmpresa)}
          subtitle={summary.custoTotal > 0 ? pct((summary.parteEmpresa / summary.custoTotal) * 100) + " do total" : ""}
          icon={<Building2 className="h-4 w-4" />}
        />
        <SummaryCard
          title="Parte Colaborador"
          value={fmt(summary.parteColaborador)}
          subtitle={summary.custoTotal > 0 ? pct((summary.parteColaborador / summary.custoTotal) * 100) + " do total" : ""}
          icon={<Users className="h-4 w-4" />}
        />
        <SummaryCard
          title="Vidas Cobertas"
          value={String(summary.vidas)}
          subtitle={`${summary.titulares} titulares + ${summary.dependentes} dep.`}
          icon={<HeartPulse className="h-4 w-4" />}
        />
        <SummaryCard
          title="Custo Per Capita"
          value={fmt(summary.custoPerCapita)}
          subtitle="por vida/mês"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* 2. Evolution Chart + 3. Plan Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {evolution.length <= 1 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                Importe mais meses para ver a evolução.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <RTooltip
                    formatter={(value: number, name: string) => [name === "Vidas" ? value : fmt(value), name]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="unimedMedico" name="Unimed Médico" stackId="1" fill={COLORS.unimedMedico} stroke={COLORS.unimedMedico} fillOpacity={0.6} />
                  <Area yAxisId="left" type="monotone" dataKey="bradescoMedico" name="Bradesco Médico" stackId="1" fill={COLORS.bradescoMedico} stroke={COLORS.bradescoMedico} fillOpacity={0.6} />
                  <Area yAxisId="left" type="monotone" dataKey="dental" name="Dental" stackId="1" fill={COLORS.dental} stroke={COLORS.dental} fillOpacity={0.6} />
                  <Area yAxisId="left" type="monotone" dataKey="coparticipacao" name="Coparticipação" stackId="1" fill={COLORS.copart} stroke={COLORS.copart} fillOpacity={0.6} />
                  <Line yAxisId="right" type="monotone" dataKey="vidas" name="Vidas" stroke={COLORS.vidas} strokeDasharray="5 5" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Composição por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            {planSlices.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={planSlices} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {planSlices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RTooltip formatter={(v: number, name: string) => [fmt(v), name]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-center text-lg font-bold">{fmt(summary.custoTotal)}</p>
                <div className="mt-2 space-y-1">
                  {planSlices.slice(0, 6).map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate max-w-[120px]">{s.name}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">{fmt(s.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Empresa vs Colaborador + 5. Dept */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Empresa vs Colaborador</CardTitle>
          </CardHeader>
          <CardContent>
            {empresaVsColab.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, empresaVsColab.length * 60)}>
                <BarChart data={empresaVsColab} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="plano" width={120} tick={{ fontSize: 11 }} />
                  <RTooltip formatter={(v: number) => [fmt(v), ""]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }} />
                  <Legend />
                  <Bar dataKey="empresa" name="Empresa" stackId="a" fill="hsl(217, 70%, 50%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="colaborador" name="Colaborador" stackId="a" fill="hsl(45, 90%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custo por Departamento</CardTitle>
          </CardHeader>
          <CardContent>
            {deptHealth.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, deptHealth.length * 35)}>
                <BarChart data={deptHealth} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="departamento" width={120} tick={{ fontSize: 11 }} />
                  <RTooltip
                    formatter={(v: number, _: string, entry: any) => [
                      `${fmt(v)} (${entry.payload.vidas} vidas · Per capita: ${fmt(entry.payload.perCapita)})`,
                      "Custo"
                    ]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }}
                  />
                  <Bar dataKey="custo" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6. Top 10 + 7. Age Bands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 10 Maiores Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-center">Vidas</TableHead>
                  <TableHead>Plano</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCosts.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{t.nome}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {t.isDiretor && !canView("salario_diretoria") ? (
                        <SalarioProtegido valor={t.custo} employee={{ cargo: t.cargo }} />
                      ) : (
                        fmt(t.custo)
                      )}
                    </TableCell>
                    <TableCell className="text-center">{t.vidas}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">{t.plano}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Faixa Etária</CardTitle>
          </CardHeader>
          <CardContent>
            {ageBands.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados de idade</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ageBands}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip
                    formatter={(v: number, name: string, entry: any) => [
                      name === "Vidas" ? `${v} vidas` : fmt(v),
                      name === "Vidas" ? `Custo médio: ${fmt(entry.payload.custoMedio)}` : name
                    ]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }}
                  />
                  <Bar dataKey="vidas" name="Vidas" fill="hsl(217, 70%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 8. Titulares vs Dependentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Titulares</p>
            <p className="text-xl font-bold">{titularVsDep.titulares.count}</p>
            <p className="text-sm text-muted-foreground">
              {fmt(titularVsDep.titulares.custo)} · Média {fmt(titularVsDep.titulares.media)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Dependentes</p>
            <p className="text-xl font-bold">{titularVsDep.dependentes.count}</p>
            <p className="text-sm text-muted-foreground">
              {fmt(titularVsDep.dependentes.custo)} · Média {fmt(titularVsDep.dependentes.media)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Ratio</p>
            <p className="text-xl font-bold">{titularVsDep.ratio.toFixed(1)} dep/titular</p>
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={80}>
                <PieChart>
                  <Pie data={[
                    { name: "Titulares", value: titularVsDep.titulares.custo },
                    { name: "Dependentes", value: titularVsDep.dependentes.custo },
                  ]} cx="50%" cy="50%" innerRadius={20} outerRadius={35} dataKey="value">
                    <Cell fill="hsl(217, 70%, 50%)" />
                    <Cell fill="hsl(45, 90%, 50%)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 9. Detailed Table (Accordion) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhamento por Titular</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {titularGroups.map((group) => (
              <AccordionItem key={group.nome} value={group.nome}>
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <span className="font-medium">{group.nome}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {group.vidas} {group.vidas === 1 ? "vida" : "vidas"} · {fmt(group.custoTotal)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Beneficiário</TableHead>
                        <TableHead>Parentesco</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead className="text-right">Mensalidade</TableHead>
                        <TableHead className="text-right">Empresa</TableHead>
                        <TableHead className="text-right">Colaborador</TableHead>
                        <TableHead className="text-right">Copart</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.records.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.nome_beneficiario}</TableCell>
                          <TableCell>
                            <Badge variant={r.parentesco === "titular" ? "default" : "secondary"} className="text-xs">
                              {r.parentesco}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.descricao_plano || r.codigo_plano}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt(r.mensalidade)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt(r.parte_empresa)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt(r.parte_colaborador)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt(r.coparticipacao)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="conferencia" className="mt-0">
          <ConferenciaFaturaFolha />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, delta, icon }: {
  title: string; value: string; subtitle?: string; delta?: number | null; icon: React.ReactNode;
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
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
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
