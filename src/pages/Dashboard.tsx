import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, DollarSign, HeartPulse, TrendingUp, TrendingDown, Briefcase,
  ArrowRight, Palmtree, Cake, GraduationCap, Clock, AlertTriangle,
  UserPlus, UserMinus, BarChart3, PieChart as PieIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line, Tooltip as RTooltip, Legend,
} from "recharts";
import { useDashboardGeralRH } from "@/hooks/useDashboardGeralRH";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTH_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : fmt(v);
const pct = (v: number) => `${v.toFixed(1)}%`;

const tipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  fontSize: "0.75rem",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedComp, setSelectedComp] = useState<{ mes: number; ano: number } | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const d = useDashboardGeralRH(selectedComp, selectedDept);

  const compKey = selectedComp ? `${selectedComp.ano}-${selectedComp.mes}` : `${d.competencia.ano}-${d.competencia.mes}`;

  if (d.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard RH</h1>
          <p className="text-muted-foreground">
            Visão geral · {MONTH_FULL[d.competencia.mes - 1]} {d.competencia.ano}
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={compKey}
            onValueChange={v => {
              const [a, m] = v.split("-").map(Number);
              setSelectedComp({ ano: a, mes: m });
            }}
          >
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              {d.competencias.map(c => (
                <SelectItem key={`${c.ano}-${c.mes}`} value={`${c.ano}-${c.mes}`}>
                  {MONTH_NAMES[c.mes - 1]}/{c.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedDept ?? "all"} onValueChange={v => setSelectedDept(v === "all" ? null : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {d.departamentos.map(dep => (
                <SelectItem key={dep} value={dep}>{dep}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* LINHA 1 - Cards Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Headcount" value={String(d.headcount)} delta={d.headcountDelta} deltaLabel="vs mês anterior" icon={<Users className="h-4 w-4" />} onClick={() => navigate("/colaboradores")} />
        <KPICard title="Folha Bruta" value={fmt(d.folhaBruta)} deltaPct={d.folhaDelta} deltaLabel="vs mês anterior" icon={<DollarSign className="h-4 w-4" />} onClick={() => navigate("/financeiro")} />
        <KPICard title="Encargos" value={fmt(d.encargos)} subtitle={`${pct(d.encargosPercentFolha)} da folha`} icon={<BarChart3 className="h-4 w-4" />} onClick={() => navigate("/folha/custo-pessoal")} />
        <KPICard title="Saúde" value={fmt(d.saudeTotal)} subtitle={`${d.saudeVidas} vidas cobertas`} icon={<HeartPulse className="h-4 w-4" />} onClick={() => navigate("/saude")} />
        <KPICard title="Custo Total" value={fmt(d.custoTotal)} subtitle={`Per capita: ${fmt(d.custoPerCapita)}`} icon={<TrendingUp className="h-4 w-4" />} onClick={() => navigate("/folha/custo-pessoal")} accent />
      </div>

      {/* LINHA 2 - Indicadores da Folha */}
      <div>
        <SectionHeader title="Indicadores da Folha" icon={<DollarSign className="h-4 w-4" />} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <MiniCard title="Custo da Folha" value={fmt(d.custoFolha)} onClick={() => navigate("/folha/custo-pessoal")}>
            {d.sparkline.length > 1 && (
              <div className="flex items-end gap-0.5 h-6 mt-1">
                {d.sparkline.map((v, i) => {
                  const max = Math.max(...d.sparkline);
                  const h = max > 0 ? (v / max) * 100 : 10;
                  return <div key={i} className="flex-1 bg-primary/30 rounded-t" style={{ height: `${Math.max(h, 5)}%` }} />;
                })}
              </div>
            )}
          </MiniCard>
          <MiniCard title="Custo de Férias" value={fmt(d.custoFerias)} subtitle={`${d.feriasCount} colaboradores`} onClick={() => navigate("/ferias")} />
          <MiniCard title="Custo de Afastamento" value={d.afastadosCount > 0 ? fmt(d.custoAfastamento) : "—"} subtitle={d.afastadosCount > 0 ? `${d.afastadosCount} afastados` : "Nenhum afastamento"} />
          <MiniCard title="Custo de Rescisão" value={d.custoRescisao > 0 ? fmt(d.custoRescisao) : "—"} subtitle={d.rescisoesList.length > 0 ? `${d.rescisoesList.length} desligamentos: ${d.rescisoesList.join(", ")}` : "Nenhum desligamento"} />
          <MiniCard title="Custo de HE" value={fmt(d.custoHE)} subtitle={d.custoHE > 0 ? `${pct(d.hePercentFolha)} da folha${d.heTopDept ? ` · Top: ${d.heTopDept}` : ""}` : "Sem horas extras"} alert={d.hePercentFolha > 10} />
          <MiniCard title="Saldo Banco de Horas" value="—" subtitle="Integrar ponto eletrônico" disabled badge="Em breve" />
        </div>
      </div>

      {/* LINHA 3 - Turnover + Absenteísmo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Turnover */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserMinus className="h-4 w-4" /> Turnover
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 text-center">
                <p className="text-lg font-bold text-green-700 dark:text-green-400">{d.admitidos}</p>
                <p className="text-xs text-muted-foreground">Admitidos</p>
              </div>
              <div className="rounded-lg bg-destructive/5 p-3 text-center">
                <p className="text-lg font-bold text-destructive">{d.demitidos}</p>
                <p className="text-xs text-muted-foreground">Demitidos</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-lg font-bold">{pct(d.taxaTurnover)}</p>
                <p className="text-xs text-muted-foreground">Taxa Turnover</p>
              </div>
            </div>

            {d.turnoverHistory.length > 1 && (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={d.turnoverHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <RTooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="admitidos" name="Admitidos" fill="hsl(142, 60%, 45%)" radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="left" dataKey="demitidos" name="Demitidos" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="taxa" name="Turnover %" stroke="hsl(217, 70%, 50%)" strokeDasharray="5 5" dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {d.turnoverByDept.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-muted/50"><th className="text-left p-2">Depto</th><th className="p-2 text-center">Adm</th><th className="p-2 text-center">Dem</th><th className="p-2 text-right">Turnover</th></tr></thead>
                  <tbody>
                    {d.turnoverByDept.map(t => (
                      <tr key={t.dept} className="border-t">
                        <td className="p-2 truncate max-w-[120px]">{t.dept}</td>
                        <td className="p-2 text-center text-green-700 dark:text-green-400">{t.admitidos}</td>
                        <td className="p-2 text-center text-destructive">{t.demitidos}</td>
                        <td className="p-2 text-right font-medium">{pct(t.taxa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Absenteísmo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Absenteísmo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-2xl font-bold">{pct(d.taxaAbsenteismo)}</p>
              <p className="text-xs text-muted-foreground">Taxa de absenteísmo</p>
            </div>

            {d.absenteismoByDept.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Por departamento</p>
                {d.absenteismoByDept.map(a => (
                  <div key={a.dept} className="flex items-center gap-2">
                    <span className="text-xs truncate flex-1 max-w-[120px]">{a.dept}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500/70 rounded-full" style={{ width: `${Math.min(a.taxa * 5, 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">{pct(a.taxa)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* LINHA 4 - Férias + Aniversariantes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Férias */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/ferias")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Palmtree className="h-4 w-4" /> Férias</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-primary/5 p-3 text-center">
                <p className="text-lg font-bold">{d.emFeriasAgora}</p>
                <p className="text-[11px] text-muted-foreground">Em férias agora</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${d.feriasVencidas > 0 ? "bg-destructive/10 animate-pulse" : "bg-muted"}`}>
                <p className={`text-lg font-bold ${d.feriasVencidas > 0 ? "text-destructive" : ""}`}>{d.feriasVencidas}</p>
                <p className="text-[11px] text-muted-foreground">Vencidas ⚠️</p>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 text-center">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{d.feriasAVencer90}</p>
                <p className="text-[11px] text-muted-foreground">A vencer 90d</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-lg font-bold">{d.feriasProgramadas}</p>
                <p className="text-[11px] text-muted-foreground">Programadas</p>
              </div>
            </div>
            {d.feriasVencidas > 0 && (
              <div className="mt-3 rounded-lg bg-destructive/5 border border-destructive/20 p-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive font-medium">
                  {d.feriasVencidas} colaborador{d.feriasVencidas > 1 ? "es" : ""} com férias VENCIDAS! Ação imediata necessária.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aniversariantes */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/aniversariantes")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Cake className="h-4 w-4" /> Aniversariantes</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{d.aniversariantesMes} no mês</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.aniversariantesHoje.length > 0 ? (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 mb-3">
                <p className="text-xs font-semibold text-primary mb-1">🎂 Hoje</p>
                {d.aniversariantesHoje.map((a, i) => (
                  <p key={i} className="text-sm font-medium">{a.nome} <span className="text-xs text-muted-foreground">· {a.dept}</span></p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">Nenhum aniversariante hoje</p>
            )}
            {d.proximosAniversariantes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Próximos 7 dias</p>
                {d.proximosAniversariantes.map((a, i) => (
                  <p key={i} className="text-sm">
                    {a.nome} <span className="text-xs text-muted-foreground">· {String(a.dia).padStart(2, "0")}/{String(a.mes).padStart(2, "0")}</span>
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* LINHA 5 - Perfil da Equipe */}
      <div>
        <SectionHeader title="Perfil da Equipe" icon={<PieIcon className="h-4 w-4" />} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
          {/* Gênero */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Gênero</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Feminino", value: d.genero.feminino },
                        { name: "Masculino", value: d.genero.masculino },
                        ...(d.genero.naoInformado > 0 ? [{ name: "N/I", value: d.genero.naoInformado }] : []),
                      ]}
                      cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2}
                    >
                      <Cell fill="hsl(280, 60%, 55%)" />
                      <Cell fill="hsl(217, 70%, 50%)" />
                      {d.genero.naoInformado > 0 && <Cell fill="hsl(var(--muted-foreground))" />}
                    </Pie>
                    <RTooltip contentStyle={tipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 text-sm flex-1">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: "hsl(280, 60%, 55%)" }} />
                    <span>Feminino</span>
                    <span className="ml-auto font-bold">{d.genero.feminino}</span>
                    <span className="text-muted-foreground text-xs">({d.headcount > 0 ? pct((d.genero.feminino / d.headcount) * 100) : "0%"})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: "hsl(217, 70%, 50%)" }} />
                    <span>Masculino</span>
                    <span className="ml-auto font-bold">{d.genero.masculino}</span>
                    <span className="text-muted-foreground text-xs">({d.headcount > 0 ? pct((d.genero.masculino / d.headcount) * 100) : "0%"})</span>
                  </div>
                </div>
              </div>
              {d.generoPorDept.length > 0 && (
                <div className="border rounded-lg overflow-hidden mt-3">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50"><th className="text-left p-2">Depto</th><th className="p-2 text-center">Fem</th><th className="p-2 text-center">Masc</th><th className="p-2 text-right">% Fem</th></tr></thead>
                    <tbody>
                      {d.generoPorDept.map(g => (
                        <tr key={g.dept} className="border-t">
                          <td className="p-2 truncate max-w-[120px]">{g.dept}</td>
                          <td className="p-2 text-center">{g.fem}</td>
                          <td className="p-2 text-center">{g.masc}</td>
                          <td className="p-2 text-right font-medium">{g.fem + g.masc > 0 ? pct((g.fem / (g.fem + g.masc)) * 100) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Faixa Etária */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Faixa Etária</CardTitle></CardHeader>
            <CardContent>
              {d.faixaEtaria.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={d.faixaEtaria} layout="vertical" margin={{ left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="faixa" width={50} tick={{ fontSize: 11 }} />
                    <RTooltip contentStyle={tipStyle} />
                    <Bar dataKey="count" name="Colaboradores" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="rounded-lg bg-muted p-2 text-center">
                  <p className="text-lg font-bold">{d.idadeMedia}</p>
                  <p className="text-[10px] text-muted-foreground">Média</p>
                </div>
                <div className="rounded-lg bg-muted p-2 text-center">
                  <p className="text-lg font-bold">{d.idadeMaisJovem}</p>
                  <p className="text-[10px] text-muted-foreground">Mais jovem</p>
                </div>
                <div className="rounded-lg bg-muted p-2 text-center">
                  <p className="text-lg font-bold">{d.idadeMaisExperiente}</p>
                  <p className="text-[10px] text-muted-foreground">Mais experiente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* LINHA 6 - Formação + Recrutamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Formação */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/colaboradores")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Formação Acadêmica</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {d.formacao.length > 0 && (
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={d.formacao.slice(0, 6).map(f => ({ name: f.grau, value: f.count }))} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={1}>
                      {d.formacao.slice(0, 6).map((_, i) => (
                        <Cell key={i} fill={["hsl(217,70%,50%)","hsl(142,60%,45%)","hsl(280,60%,55%)","hsl(45,90%,50%)","hsl(0,70%,50%)","hsl(200,60%,45%)"][i % 6]} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={tipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex-1 space-y-1">
                {d.formacao.slice(0, 6).map((f, i) => (
                  <div key={f.grau} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: ["hsl(217,70%,50%)","hsl(142,60%,45%)","hsl(280,60%,55%)","hsl(45,90%,50%)","hsl(0,70%,50%)","hsl(200,60%,45%)"][i % 6] }} />
                      <span className="truncate max-w-[100px]">{f.grau}</span>
                    </span>
                    <span className="font-medium">{f.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {d.cursando > 0 && (
              <Badge variant="secondary" className="mt-2 text-xs">{d.cursando} cursando</Badge>
            )}
          </CardContent>
        </Card>

        {/* Recrutamento */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/recrutamento/dashboard-vagas")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Briefcase className="h-4 w-4" /> Recrutamento</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 text-center">
                <p className="text-lg font-bold text-green-700 dark:text-green-400">{d.vagasAbertas}</p>
                <p className="text-[11px] text-muted-foreground">Abertas</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-lg font-bold">{d.vagasEncerradas}</p>
                <p className="text-[11px] text-muted-foreground">Encerradas</p>
              </div>
              <div className="rounded-lg bg-primary/5 p-3 text-center">
                <p className="text-lg font-bold text-primary">{d.contratados}</p>
                <p className="text-[11px] text-muted-foreground">Contratados</p>
              </div>
            </div>
            {d.tempoMedioPreenchimento > 0 && (
              <p className="text-xs text-muted-foreground">
                Tempo médio de preenchimento: <strong>{d.tempoMedioPreenchimento} dias</strong>
              </p>
            )}
            {d.vagasMetaUltrapassada > 0 && (
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive font-medium">
                  {d.vagasMetaUltrapassada} vaga{d.vagasMetaUltrapassada > 1 ? "s" : ""} com meta ultrapassada!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Sub-components ---

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
      {icon}
      <span>{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function KPICard({ title, value, delta, deltaPct, deltaLabel, subtitle, icon, onClick, accent }: {
  title: string; value: string; delta?: number; deltaPct?: number; deltaLabel?: string;
  subtitle?: string; icon: React.ReactNode; onClick?: () => void; accent?: boolean;
}) {
  const d = delta ?? (deltaPct != null ? deltaPct : null);
  const isPercent = deltaPct != null;
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all group ${accent ? "border-primary/30 bg-primary/[0.02]" : ""}`}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
        </div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          {d != null && d !== 0 && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${d > 0 && !isPercent ? "text-green-600" : d > 0 && isPercent ? "text-destructive" : d < 0 ? "text-green-600" : ""}`}>
              {d > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {d > 0 ? "+" : ""}{isPercent ? `${d}%` : d}
              {deltaLabel && <span className="text-muted-foreground font-normal ml-0.5">{deltaLabel}</span>}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniCard({ title, value, subtitle, children, onClick, disabled, badge, alert }: {
  title: string; value: string; subtitle?: string; children?: React.ReactNode;
  onClick?: () => void; disabled?: boolean; badge?: string; alert?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 transition-all ${disabled ? "opacity-50 bg-muted/30" : "hover:shadow-sm cursor-pointer hover:border-primary/20"} ${alert ? "border-destructive/30 bg-destructive/[0.02]" : ""}`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{title}</span>
        {badge && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{badge}</Badge>}
      </div>
      <p className={`text-lg font-bold tabular-nums ${alert ? "text-destructive" : ""}`}>{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      {children}
    </div>
  );
}
