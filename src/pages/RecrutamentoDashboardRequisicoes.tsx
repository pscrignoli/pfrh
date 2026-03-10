import { useState, useMemo } from "react";
import { format, subDays, differenceInDays, parseISO } from "date-fns";
import { FileText, CheckCircle2, Clock, Download, Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { useEmpregareVagas } from "@/hooks/useEmpregareVagas";
import { useCompany } from "@/contexts/CompanyContext";
import * as XLSX from "xlsx";

interface RequisicaoRow {
  id: string;
  codigo: number | null;
  titulo: string;
  setor: string | null;
  filial: string | null;
  unidadeNegocio: string | null;
  motivoAbertura: string | null;
  totalVagas: number;
  diasAndamento: number;
  dataCadastro: string | null;
  situacao: string;
  responsaveis: string[];
}

const PAGE_SIZE = 25;

export default function RecrutamentoDashboardRequisicoes() {
  const { companyId } = useCompany();
  const { vagas, loading } = useEmpregareVagas();

  const [statusFilter, setStatusFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("dataCadastro");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [distTab, setDistTab] = useState("setores");

  // Build requisicao rows from vagas that have requisicao_id
  const rows = useMemo((): RequisicaoRow[] => {
    const filtered = vagas.filter(v => {
      if (companyId && v.company_id !== companyId) return false;
      if (!v.requisicao_id && !(v as any).codigo_requisicao) return false;
      if (statusFilter !== "todas") {
        const sit = (v.situacao ?? "").toLowerCase();
        if (statusFilter.toLowerCase() !== sit) return false;
      }
      return true;
    });

    return filtered.map(v => {
      const dc = v.data_cadastro ? parseISO(v.data_cadastro) : null;
      const dias = dc ? differenceInDays(new Date(), dc) : 0;
      const responsaveis = (v.responsaveis || []).map((r: any) => r.nome ?? r.Nome ?? "").filter(Boolean);

      return {
        id: v.id,
        codigo: (v as any).codigo_requisicao || v.requisicao_id,
        titulo: v.titulo,
        setor: (v as any).setor || null,
        filial: (v as any).filial || null,
        unidadeNegocio: (v as any).unidade_negocio || null,
        motivoAbertura: (v as any).motivo_abertura || null,
        totalVagas: v.total_vagas,
        diasAndamento: dias,
        dataCadastro: v.data_cadastro,
        situacao: v.situacao ?? "Aberta",
        responsaveis,
      };
    });
  }, [vagas, companyId, statusFilter]);

  const summary = useMemo(() => {
    const abertas = rows.filter(r => r.situacao.toLowerCase() === "aberta").length;
    const aprovadas = rows.filter(r => r.situacao.toLowerCase() === "encerrada").length;
    const mediaAprovacao = rows.length > 0 ? rows.reduce((s, r) => s + r.diasAndamento, 0) / rows.length : 0;
    return { abertas, aprovadas, mediaAprovacao };
  }, [rows]);

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

  // Distributions
  const distributions = useMemo(() => {
    const buildDist = (key: keyof RequisicaoRow) => {
      const map = new Map<string, { abertas: number; encerradas: number }>();
      for (const r of rows) {
        const val = String((r as any)[key] ?? "Não informado");
        const entry = map.get(val) || { abertas: 0, encerradas: 0 };
        if (r.situacao.toLowerCase() === "aberta") entry.abertas++;
        else entry.encerradas++;
        map.set(val, entry);
      }
      return Array.from(map.entries())
        .map(([name, v]) => ({ name, ...v, total: v.abertas + v.encerradas }))
        .sort((a, b) => b.total - a.total);
    };

    // Requisitante ranking
    const reqMap = new Map<string, { abertas: number; encerradas: number }>();
    for (const r of rows) {
      for (const resp of r.responsaveis) {
        const entry = reqMap.get(resp) || { abertas: 0, encerradas: 0 };
        if (r.situacao.toLowerCase() === "aberta") entry.abertas++;
        else entry.encerradas++;
        reqMap.set(resp, entry);
      }
    }

    return {
      setores: buildDist("setor"),
      filiais: buildDist("filial"),
      motivos: buildDist("motivoAbertura"),
      requisitantes: Array.from(reqMap.entries())
        .map(([name, v]) => ({ name, ...v, total: v.abertas + v.encerradas }))
        .sort((a, b) => b.total - a.total),
    };
  }, [rows]);

  const handleExport = () => {
    const data = sorted.map(r => ({
      Código: r.codigo,
      Cargo: r.titulo,
      Setor: r.setor,
      Filial: r.filial,
      Motivo: r.motivoAbertura,
      Vagas: r.totalVagas,
      "Tempo (dias)": r.diasAndamento,
      Situação: r.situacao,
      Responsáveis: r.responsaveis.join(", "),
      Abertura: r.dataCadastro ? format(new Date(r.dataCadastro), "dd/MM/yyyy") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Requisições");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "indicadores_requisicoes.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div>;

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 text-muted-foreground/50" /></span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="Aberta">Abertas</SelectItem>
            <SelectItem value="Encerrada">Aprovadas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}><Download className="h-3.5 w-3.5" />Exportar XLSX</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Requisições Abertas</span>
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold tabular-nums">{summary.abertas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Aprovadas / Encerradas</span>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <p className="text-2xl font-bold tabular-nums">{summary.aprovadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Média Andamento</span>
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <p className="text-2xl font-bold tabular-nums">{Math.round(summary.mediaAprovacao)} dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Consolidated Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Consolidado de Requisições</CardTitle>
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
                <SortHeader label="Código" field="codigo" />
                <SortHeader label="Cargo" field="titulo" />
                <TableHead>Setor</TableHead>
                <TableHead>Filial</TableHead>
                <SortHeader label="Vagas" field="totalVagas" />
                <SortHeader label="Dias" field="diasAndamento" />
                <TableHead>Situação</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Responsáveis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(r => {
                const isAberta = r.situacao.toLowerCase() === "aberta";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums text-xs">{r.codigo ?? "—"}</TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.titulo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.setor ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.filial ?? "—"}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.totalVagas}</TableCell>
                    <TableCell className="tabular-nums text-xs">{r.diasAndamento}d</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${isAberta ? "bg-success/10 text-success border-success/20" : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"}`}>
                        {isAberta ? "Vaga em Andamento" : r.situacao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">{r.motivoAbertura ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{r.responsaveis.join(", ") || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">{sorted.length} requisições · Página {page}/{totalPages}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distributions + Ranking */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Distribuições</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={distTab} onValueChange={setDistTab}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="setores" className="text-xs">Setores</TabsTrigger>
              <TabsTrigger value="filiais" className="text-xs">Filiais</TabsTrigger>
              <TabsTrigger value="motivos" className="text-xs">Motivos</TabsTrigger>
              <TabsTrigger value="requisitantes" className="text-xs">Requisitantes</TabsTrigger>
            </TabsList>

            {(["setores", "filiais", "motivos", "requisitantes"] as const).map(key => {
              const data = distributions[key] || [];
              return (
                <TabsContent key={key} value={key}>
                  {data.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 35)}>
                      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
