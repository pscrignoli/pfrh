import { useState, useMemo } from "react";
import { format, subDays, subMonths } from "date-fns";
import { Briefcase, CheckCircle2, XCircle, TrendingUp, AlertTriangle, Download, Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useEmpregareVagas } from "@/hooks/useEmpregareVagas";
import { useRecrutamentoDashboard, type RecrutamentoFilters, type VagaDashboardRow } from "@/hooks/useRecrutamentoDashboard";
import { useCompany } from "@/contexts/CompanyContext";
import EmpregareVagaDrawer from "@/components/recrutamento/EmpregareVagaDrawer";
import type { EmpregareVaga } from "@/hooks/useEmpregareVagas";
import * as XLSX from "xlsx";
import PeriodFilter, { usePeriodFilter, filterVagasByPeriod } from "@/components/recrutamento/PeriodFilter";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--accent))", "hsl(var(--chart-4))"];
const FUNNEL_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-4))", "hsl(var(--warning))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--destructive))"];
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-success/10 text-success border-success/20" },
  encerrada: { label: "Encerrada", cls: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20" },
  cancelada: { label: "Cancelada", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  congelada: { label: "Congelada", cls: "bg-warning/10 text-warning border-warning/20" },
};

const PAGE_SIZE = 25;

export default function RecrutamentoDashboardVagas() {
  const { companyId } = useCompany();
  const { vagas, loading } = useEmpregareVagas();

  const [filters, setFilters] = useState<RecrutamentoFilters>({
    dateFrom: subDays(new Date(), 365),
    dateTo: new Date(),
    status: "todas",
    companyId: companyId,
  });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("dataCadastro");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [distTab, setDistTab] = useState("setores");
  const [drawerVaga, setDrawerVaga] = useState<EmpregareVaga | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Update companyId filter when context changes
  const effectiveFilters = useMemo(() => ({ ...filters, companyId }), [filters, companyId]);
  const { rows, summary, distributions, funnel } = useRecrutamentoDashboard(vagas, effectiveFilters);

  // Search + sort
  const sorted = useMemo(() => {
    let r = rows.filter(v => !search || v.titulo.toLowerCase().includes(search.toLowerCase()));
    r.sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      return sortDir === "asc" ? String(aVal ?? "").localeCompare(String(bVal ?? "")) : String(bVal ?? "").localeCompare(String(aVal ?? ""));
    });
    return r;
  }, [rows, search, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleExport = () => {
    const data = sorted.map(r => ({
      Código: r.empregare_id,
      Cargo: r.titulo,
      Vagas: r.totalVagas,
      Candidaturas: r.totalCandidaturas,
      Contratados: r.totalContratados,
      "Em Andamento": r.totalEmAndamento,
      "Tempo (dias)": r.diasAndamento,
      Status: r.situacao,
      Setor: r.setor,
      Filial: r.filial,
      Cidade: r.cidade,
      Nível: r.nivelHierarquico,
      "Tipo Recrutamento": r.tipoRecrutamento,
      Regime: r.regimeContratacao,
      Modalidade: r.modalidadeTrabalho,
      Motivo: r.motivoAbertura,
      PcD: r.pcd ? "Sim" : "Não",
      Responsáveis: r.responsaveis.join(", "),
      Abertura: r.dataCadastro ? format(new Date(r.dataCadastro), "dd/MM/yyyy") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vagas");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "indicadores_vagas.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div>;

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 text-muted-foreground/50" /></span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filters.status} onValueChange={v => { setFilters(f => ({ ...f, status: v })); setPage(1); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="Aberta">Abertas</SelectItem>
            <SelectItem value="Encerrada">Encerradas</SelectItem>
            <SelectItem value="Cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}><Download className="h-3.5 w-3.5" />Exportar XLSX</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard title="Vagas Abertas" value={summary.abertas} icon={<Briefcase className="h-4 w-4" />} color="text-success" />
        <SummaryCard title="Encerradas" value={summary.encerradas} icon={<CheckCircle2 className="h-4 w-4" />} color="text-muted-foreground" />
        <SummaryCard title="Canceladas" value={summary.canceladas} icon={<XCircle className="h-4 w-4" />} color="text-destructive" />
        <SummaryCard title="Contratados" value={summary.contratados} icon={<TrendingUp className="h-4 w-4" />} color="text-primary" />
      </div>

      {/* Alert */}
      {summary.metaUltrapassada > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{summary.metaUltrapassada} vaga{summary.metaUltrapassada !== 1 ? "s" : ""} com meta ultrapassada!</span>
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-3 pb-2 px-4"><p className="text-xs text-muted-foreground">Total Candidaturas</p><p className="text-xl font-bold tabular-nums">{summary.totalCandidaturas}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-4"><p className="text-xs text-muted-foreground">Taxa de Conversão</p><p className="text-xl font-bold tabular-nums">{summary.taxaConversao.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-4"><p className="text-xs text-muted-foreground">Tempo Médio (dias)</p><p className="text-xl font-bold tabular-nums">{Math.round(summary.tempoMedioPreenchimento)}</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-2 px-4"><p className="text-xs text-muted-foreground">Meta Ultrapassada</p><p className="text-xl font-bold tabular-nums text-destructive">{summary.metaUltrapassada}</p></CardContent></Card>
      </div>

      {/* Funnel */}
      {funnel[0].value > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Funil Agregado</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 justify-center py-4">
              {funnel.map((f, i) => {
                const maxVal = Math.max(...funnel.map(x => x.value), 1);
                const h = Math.max((f.value / maxVal) * 180, 30);
                const prevVal = i > 0 ? funnel[i - 1].value : 0;
                const conv = prevVal > 0 ? ((f.value / prevVal) * 100).toFixed(1) : null;
                return (
                  <div key={f.name} className="flex flex-col items-center gap-1 flex-1 max-w-[200px]">
                    <span className="text-lg font-bold tabular-nums">{f.value}</span>
                    <div className="w-full rounded-t-lg transition-all duration-700" style={{ height: h, backgroundColor: FUNNEL_COLORS[i] }} />
                    <span className="text-xs font-medium">{f.name}</span>
                    {conv && <span className="text-[10px] text-muted-foreground">{conv}% conv.</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consolidated Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Consolidado de Vagas</CardTitle>
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar cargo..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-8 text-xs" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Cargo" field="titulo" />
                <SortHeader label="Vagas" field="totalVagas" />
                <SortHeader label="Candidaturas" field="totalCandidaturas" />
                <SortHeader label="Contratados" field="totalContratados" />
                <SortHeader label="Dias" field="diasAndamento" />
                <TableHead>Meta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Local</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(r => {
                const sc = STATUS_CFG[(r.situacao ?? "").toLowerCase()] ?? STATUS_CFG.aberta;
                return (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/60" onClick={() => { setDrawerVaga(r.raw); setDrawerOpen(true); }}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.titulo}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.totalVagas}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.totalCandidaturas}</TableCell>
                    <TableCell className="text-center tabular-nums font-medium">{r.totalContratados}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium tabular-nums ${r.diasAndamento < 30 ? "text-success" : r.diasAndamento < 60 ? "text-warning" : "text-destructive"}`}>
                        {r.diasAndamento}d
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.diasMeta !== null ? (
                        <span className={`text-xs tabular-nums ${r.diasMeta >= 0 ? "text-success" : "text-destructive font-medium"}`}>
                          {r.diasMeta >= 0 ? `${r.diasMeta}d rest.` : `${Math.abs(r.diasMeta)}d atraso`}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={`text-[10px] ${sc.cls}`}>{sc.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">{r.setor ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">{r.cidade ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">{sorted.length} vagas · Página {page}/{totalPages}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distributions */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Distribuições</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={distTab} onValueChange={setDistTab}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="setores" className="text-xs">Setores</TabsTrigger>
              <TabsTrigger value="filiais" className="text-xs">Filiais</TabsTrigger>
              <TabsTrigger value="cidades" className="text-xs">Cidades</TabsTrigger>
              <TabsTrigger value="nivel" className="text-xs">Nível</TabsTrigger>
              <TabsTrigger value="motivo" className="text-xs">Motivo</TabsTrigger>
              <TabsTrigger value="tipo" className="text-xs">Tipo Recrutamento</TabsTrigger>
              <TabsTrigger value="cargos" className="text-xs">Cargos</TabsTrigger>
              <TabsTrigger value="salarios" className="text-xs">Salários</TabsTrigger>
              <TabsTrigger value="pcd" className="text-xs">PcD</TabsTrigger>
            </TabsList>

            {/* Bar distributions */}
            {(["setores", "filiais", "cidades", "nivel"] as const).map(key => {
              const dataMap: Record<string, any[]> = { setores: distributions.setores, filiais: distributions.filiais, cidades: distributions.cidades, nivel: distributions.nivelHierarquico };
              const data = dataMap[key] || [];
              return (
                <TabsContent key={key} value={key}>
                  {data.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 35)}>
                      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                        <RTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }} />
                        <Legend />
                        <Bar dataKey="abertas" name="Abertas" stackId="a" fill="hsl(var(--success))" />
                        <Bar dataKey="encerradas" name="Encerradas" stackId="a" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </TabsContent>
              );
            })}

            {/* Pie charts */}
            {(["motivo", "tipo"] as const).map(key => {
              const dataMap: Record<string, any[]> = { motivo: distributions.motivoAbertura, tipo: distributions.tipoRecrutamento };
              const data = (dataMap[key] || []).map(d => ({ name: d.name, value: d.total })).filter(d => d.value > 0);
              return (
                <TabsContent key={key} value={key}>
                  {data.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={data} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine>
                          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </TabsContent>
              );
            })}

            {/* Cargos bar */}
            <TabsContent value="cargos">
              {distributions.cargos.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                <ResponsiveContainer width="100%" height={Math.max(200, distributions.cargos.length * 35)}>
                  <BarChart data={distributions.cargos} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10 }} />
                    <RTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }} />
                    <Bar dataKey="value" name="Ocorrências" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </TabsContent>

            {/* Salários bar */}
            <TabsContent value="salarios">
              {distributions.faixasSalariais.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                <ResponsiveContainer width="100%" height={Math.max(200, distributions.faixasSalariais.length * 35)}>
                  <BarChart data={distributions.faixasSalariais} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <RTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "0.75rem" }} />
                    <Bar dataKey="value" name="Vagas" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </TabsContent>

            {/* PcD */}
            <TabsContent value="pcd">
              <div className="flex gap-6 justify-center py-8">
                <div className="text-center">
                  <p className="text-3xl font-bold">{distributions.pcd.sim}</p>
                  <p className="text-sm text-muted-foreground">PcD: Sim</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{distributions.pcd.nao}</p>
                  <p className="text-sm text-muted-foreground">PcD: Não</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <EmpregareVagaDrawer vaga={drawerVaga} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}

function SummaryCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <span className={color}>{icon}</span>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
