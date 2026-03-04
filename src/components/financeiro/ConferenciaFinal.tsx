import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, XCircle, Users, DollarSign, Clock,
  UserPlus, UserX, Baby, Hospital, Timer, CreditCard, Heart, BarChart3,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import type { ConferenciaFinalData } from "@/utils/gerarConferenciaFinal";
import type { CorrectionLog } from "./AuditAlertCard";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface Props {
  data: ConferenciaFinalData;
}

export function ConferenciaFinal({ data }: Props) {
  const allTotalsMatch = data.totalizadores.every(t => t.confere) && data.provaReal.confere;

  const chartData = useMemo(() =>
    data.faixasSalariais.map(f => ({
      name: f.label,
      value: f.count,
      pct: f.pct,
    })),
  [data.faixasSalariais]);

  const barColors = [
    "hsl(var(--primary))",
    "hsl(var(--primary) / 0.85)",
    "hsl(var(--primary) / 0.7)",
    "hsl(var(--primary) / 0.55)",
    "hsl(var(--primary) / 0.4)",
    "hsl(var(--primary) / 0.3)",
  ];

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="space-y-5 pr-3">
        {/* Status Banner */}
        {allTotalsMatch ? (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-700">Todos os totais conferem com o arquivo original</p>
              <p className="text-[10px] text-green-600">Prova real validada — dados prontos para importação</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Divergências encontradas</p>
              <p className="text-[10px] text-destructive/80">Revise os valores abaixo antes de confirmar</p>
            </div>
          </div>
        )}

        {/* ── 1. Totalizadores ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Totalizadores
          </h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] py-1.5">Item</TableHead>
                  <TableHead className="text-[10px] py-1.5 text-right">Arquivo TXT</TableHead>
                  <TableHead className="text-[10px] py-1.5 text-right">Após Correções</TableHead>
                  <TableHead className="text-[10px] py-1.5 text-center w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.totalizadores.map((t) => (
                  <TableRow key={t.label}>
                    <TableCell className="text-xs font-medium py-1.5">
                      {t.label}
                      {t.detalhamento && (
                        <span className="block text-[10px] text-muted-foreground">{t.detalhamento}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right py-1.5 font-mono">{fmtNum(t.valorTxt)}</TableCell>
                    <TableCell className={`text-xs text-right py-1.5 font-mono ${!t.confere ? "text-destructive font-semibold" : ""}`}>
                      {fmtNum(t.valorCorrigido)}
                      {!t.confere && (
                        <span className="block text-[9px] text-destructive">Δ {fmtNum(t.delta)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      {t.confere ? (
                        <Badge className="text-[9px] bg-green-600 hover:bg-green-700 px-1.5 py-0">✓ Confere</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">⚠ Diverge</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Prova Real */}
          <div className={`mt-2 rounded-lg border p-2.5 text-xs flex items-center gap-3 ${
            data.provaReal.confere ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
          }`}>
            <span className="font-medium text-muted-foreground">Prova real:</span>
            <span className="font-mono">
              {fmtNum(data.provaReal.proventos)} − {fmtNum(data.provaReal.descontos)} = {fmtNum(data.provaReal.calculado)}
            </span>
            <span className="text-muted-foreground">vs Líquido:</span>
            <span className="font-mono font-medium">{fmtNum(data.provaReal.informado)}</span>
            {data.provaReal.confere ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-auto shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive ml-auto shrink-0" />
            )}
          </div>
        </section>

        {/* ── 2. Headcount ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Headcount por Situação
          </h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[10px] py-1.5">Situação</TableHead>
                  <TableHead className="text-[10px] py-1.5 text-right">Qtd</TableHead>
                  <TableHead className="text-[10px] py-1.5 text-right">Proventos</TableHead>
                  <TableHead className="text-[10px] py-1.5 text-right">% Folha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.headcount.map((h) => (
                  <TableRow key={h.situacao}>
                    <TableCell className="text-xs py-1.5 font-medium">{h.situacao}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-mono">{h.qtd}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-mono">{fmt(h.proventos)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-mono">{fmtPct(h.pctFolha)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell className="text-xs py-1.5">TOTAL</TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-mono">
                    {data.headcount.reduce((s, h) => s + h.qtd, 0)}
                  </TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-mono">
                    {fmt(data.headcount.reduce((s, h) => s + h.proventos, 0))}
                  </TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-mono">100,0%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ── 3. Encargos ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Encargos e Impostos
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["INSS Funcionários", data.encargos.inssFuncionarios],
              ["INSS Empresa (20%)", data.encargos.inssEmpresa],
              ["IRRF Total", data.encargos.irrfTotal],
              ["FGTS GFIP", data.encargos.fgtsGfip],
              ["FGTS GRRF", data.encargos.fgtsGrrf],
            ] as [string, number][]).map(([label, valor]) => (
              <div key={label} className="rounded-lg border p-2 text-center">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="text-xs font-semibold font-mono">{fmt(valor)}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center italic">
            Encargos patronais representam <strong>{fmtPct(data.encargos.pctFolhaBruta)}</strong> da folha bruta
          </p>
        </section>

        {/* ── 4. Distribuição Salarial ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Distribuição Salarial
          </h3>
          <div className="rounded-lg border p-3">
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number, _name: string, props: { payload: { pct: number } }) =>
                      [`${value} funcionário(s) (${props.payload.pct.toFixed(1)}%)`, ""]
                    }
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={barColors[i % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Menor salário:</span>
                <span className="font-mono font-medium">{fmt(data.estatisticas.menor.valor)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maior salário:</span>
                <span className="font-mono font-medium">{fmt(data.estatisticas.maior.valor)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground truncate pr-1">{data.estatisticas.menor.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground truncate pr-1">{data.estatisticas.maior.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mediana:</span>
                <span className="font-mono font-medium">{fmt(data.estatisticas.mediana)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Média:</span>
                <span className="font-mono font-medium">{fmt(data.estatisticas.media)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Tipo de Contrato ── */}
        {data.tiposContrato.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Tipo de Contrato
            </h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] py-1.5">Tipo</TableHead>
                    <TableHead className="text-[10px] py-1.5 text-right">Qtd</TableHead>
                    <TableHead className="text-[10px] py-1.5 text-right">Proventos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tiposContrato.map((t) => (
                    <TableRow key={t.tipo}>
                      <TableCell className="text-xs py-1.5 font-medium">{t.tipo}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">{t.qtd}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right font-mono">{fmt(t.proventos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {/* ── 6. Carga Horária ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Carga Horária
          </h3>
          <div className="flex gap-2 flex-wrap">
            {data.cargasHorarias.map((ch) => (
              <div key={ch.horas} className="rounded-lg border p-2.5 text-center min-w-[100px]">
                <div className="text-sm font-bold">{ch.horas}h/mês</div>
                <div className="text-[10px] text-muted-foreground">
                  {ch.qtd} func. ({fmtPct(ch.pct)})
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Destaques do Mês ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Destaques do Mês
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {data.destaques.admissoes.length > 0 && (
              <DestacCard
                icon={<UserPlus className="h-4 w-4 text-blue-600" />}
                title={`${data.destaques.admissoes.length} Admissão(ões)`}
                items={data.destaques.admissoes.map(a => a.nome)}
                variant="blue"
              />
            )}
            {data.destaques.demissoes.length > 0 && (
              <DestacCard
                icon={<UserX className="h-4 w-4 text-red-600" />}
                title={`${data.destaques.demissoes.length} Demissão(ões)`}
                items={data.destaques.demissoes.map(d => d.nome)}
                variant="red"
              />
            )}
            {data.destaques.licencas.length > 0 && (
              <DestacCard
                icon={<Baby className="h-4 w-4 text-pink-600" />}
                title={`${data.destaques.licencas.length} Licença(s)`}
                items={data.destaques.licencas.map(l => l.nome)}
                variant="pink"
              />
            )}
            {data.destaques.afastamentos.length > 0 && (
              <DestacCard
                icon={<Hospital className="h-4 w-4 text-yellow-600" />}
                title={`${data.destaques.afastamentos.length} Afastamento(s)`}
                items={data.destaques.afastamentos.map(a => a.nome)}
                variant="yellow"
              />
            )}
            {data.destaques.heFuncionarios > 0 && (
              <DestacCard
                icon={<Timer className="h-4 w-4 text-orange-600" />}
                title={`${data.destaques.heFuncionarios} com HE`}
                items={[`Total: ${fmt(data.destaques.heTotal)}`]}
                variant="orange"
              />
            )}
            {data.destaques.planoSaudeTotal > 0 && (
              <DestacCard
                icon={<Heart className="h-4 w-4 text-emerald-600" />}
                title="Plano de Saúde"
                items={[`Total: ${fmt(data.destaques.planoSaudeTotal)}`]}
                variant="emerald"
              />
            )}
          </div>
        </section>

        {/* ── 8. Correções Aplicadas ── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Correções na Auditoria
          </h3>
          {data.correctionCount > 0 ? (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                <span className="text-green-600 font-medium">{data.correctionCount} correção(ões)</span>
                {" · "}
                <span>{data.reviewedCount} alerta(s) revisado(s)</span>
              </p>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] py-1.5">Funcionário</TableHead>
                      <TableHead className="text-[10px] py-1.5">Campo</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right">Antes</TableHead>
                      <TableHead className="text-[10px] py-1.5 text-right">Depois</TableHead>
                      <TableHead className="text-[10px] py-1.5">Justificativa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.correctionLogs.map((log, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-[10px] py-1 font-medium truncate max-w-[100px]">{log.funcionario}</TableCell>
                        <TableCell className="text-[10px] py-1 text-muted-foreground">{log.campo}</TableCell>
                        <TableCell className="text-[10px] py-1 text-right font-mono">
                          {formatLogValue(log.valor_original)}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 text-right font-mono text-green-600 font-medium">
                          {formatLogValue(log.valor_corrigido)}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 text-muted-foreground truncate max-w-[120px]">{log.justificativa}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border p-4 text-center">
              <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Nenhuma correção necessária</p>
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}

// ── Sub-components ──

function DestacCard({ icon, title, items, variant }: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  variant: string;
}) {
  const borderColor: Record<string, string> = {
    blue: "border-blue-500/30",
    red: "border-red-500/30",
    pink: "border-pink-500/30",
    yellow: "border-yellow-500/30",
    orange: "border-orange-500/30",
    emerald: "border-emerald-500/30",
  };

  return (
    <div className={`rounded-lg border ${borderColor[variant] ?? ""} p-2.5`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <ul className="space-y-0.5">
        {items.slice(0, 5).map((item, i) => (
          <li key={i} className="text-[10px] text-muted-foreground truncate">• {item}</li>
        ))}
        {items.length > 5 && (
          <li className="text-[10px] text-muted-foreground">+{items.length - 5} mais</li>
        )}
      </ul>
    </div>
  );
}

function formatLogValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return fmtNum(v);
  return String(v);
}
