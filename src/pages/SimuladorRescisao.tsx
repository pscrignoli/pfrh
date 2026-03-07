import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Calculator, Download, ArrowUpRight, ArrowDownRight, History } from "lucide-react";
import { format, differenceInMonths, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  useSimuladorRescisao,
  calcularRescisao,
  type TipoRescisao,
  type TipoAvisoPrevio,
  type RescisaoInput,
  type RescisaoResult,
} from "@/hooks/useSimuladorRescisao";

const tipoRescisaoLabels: Record<TipoRescisao, string> = {
  sem_justa_causa: "Sem Justa Causa",
  pedido_demissao: "Pedido de Demissão",
  acordo_mutuo: "Acordo Mútuo",
  justa_causa: "Justa Causa",
};

const avisoOptions: Record<TipoRescisao, TipoAvisoPrevio[]> = {
  sem_justa_causa: ["trabalhado", "indenizado"],
  pedido_demissao: ["trabalhado", "dispensado"],
  acordo_mutuo: ["indenizado"],
  justa_causa: ["dispensado"],
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseNumBR = (s: string) => {
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  return Number(cleaned) || 0;
};

const formatInputBR = (v: number) =>
  v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

function calcAutoFields(dataAdmissao: string, dataDemissao: string) {
  const adm = new Date(dataAdmissao + "T00:00:00");
  const dem = new Date(dataDemissao + "T00:00:00");

  // Meses para 13º
  const meses13 = dem.getMonth() + 1; // months worked in current year

  // Período aquisitivo
  const admDay = adm.getDate();
  const admMonth = adm.getMonth();
  let anivYear = dem.getFullYear();
  let aniversario = new Date(anivYear, admMonth, admDay);
  if (aniversario > dem) aniversario = new Date(anivYear - 1, admMonth, admDay);
  const mesesPA = differenceInMonths(dem, aniversario);

  // Férias vencidas: se o período aquisitivo anterior não foi gozado
  // Simplified: if there's a complete period that ended >12 months ago
  const fimPAAnterior = new Date(aniversario);
  fimPAAnterior.setDate(fimPAAnterior.getDate() - 1);
  const inicioPAAnterior = new Date(aniversario);
  inicioPAAnterior.setFullYear(inicioPAAnterior.getFullYear() - 1);

  return { meses13, mesesPA, feriasVencidas: false };
}

export default function SimuladorRescisao() {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get("employee");

  const { employees, historico, loading, salvarSimulacao, fetchFgtsEstimado } = useSimuladorRescisao();

  const [employeeId, setEmployeeId] = useState<string>("");
  const [salarioBase, setSalarioBase] = useState(0);
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataDemissao, setDataDemissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tipoRescisao, setTipoRescisao] = useState<TipoRescisao>("sem_justa_causa");
  const [avisoPrevio, setAvisoPrevio] = useState<TipoAvisoPrevio>("indenizado");
  const [saldoFgts, setSaldoFgts] = useState(0);
  const [feriasVencidas, setFeriasVencidas] = useState(false);
  const [mesesPA, setMesesPA] = useState(0);
  const [meses13, setMeses13] = useState(0);
  const [resultado, setResultado] = useState<RescisaoResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Pre-select employee
  useEffect(() => {
    if (preselectedId && employees.length > 0) {
      handleSelectEmployee(preselectedId);
    }
  }, [preselectedId, employees]);

  const handleSelectEmployee = async (id: string) => {
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;
    setEmployeeId(id);
    setSalarioBase(emp.salario_base ?? 0);
    setDataAdmissao(emp.data_admissao);

    const auto = calcAutoFields(emp.data_admissao, dataDemissao);
    setMesesPA(auto.mesesPA);
    setMeses13(auto.meses13);
    setFeriasVencidas(auto.feriasVencidas);

    // Fetch FGTS
    const fgts = await fetchFgtsEstimado(id);
    setSaldoFgts(fgts);
  };

  // Recalc auto fields when dates change
  useEffect(() => {
    if (dataAdmissao && dataDemissao) {
      const auto = calcAutoFields(dataAdmissao, dataDemissao);
      setMesesPA(auto.mesesPA);
      setMeses13(auto.meses13);
    }
  }, [dataAdmissao, dataDemissao]);

  // Reset aviso prévio when tipo changes
  useEffect(() => {
    const opts = avisoOptions[tipoRescisao];
    if (!opts.includes(avisoPrevio)) {
      setAvisoPrevio(opts[0]);
    }
  }, [tipoRescisao]);

  const handleCalc = () => {
    if (!employeeId) {
      toast.error("Selecione um colaborador");
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    const input: RescisaoInput = {
      employeeId,
      nome: emp?.nome_completo ?? "",
      salarioBase,
      dataAdmissao,
      dataDemissao,
      tipoRescisao,
      avisoPrevio,
      saldoFgts,
      feriasVencidas,
      mesesPeriodoAquisitivo: mesesPA,
      meses13Proporcional: meses13,
    };
    setResultado(calcularRescisao(input));
  };

  const handleSave = async () => {
    if (!resultado) return;
    setSaving(true);
    try {
      await salvarSimulacao(employeeId, tipoRescisao, dataDemissao, resultado);
      toast.success("Simulação salva com sucesso!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Comparativo
  const comparativo = useMemo(() => {
    if (!employeeId || !dataAdmissao) return null;
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return null;

    const tipos: TipoRescisao[] = ["sem_justa_causa", "acordo_mutuo", "pedido_demissao"];
    return tipos.map((tipo) => {
      const aviso: TipoAvisoPrevio = tipo === "pedido_demissao" ? "dispensado" : "indenizado";
      const r = calcularRescisao({
        employeeId, nome: emp.nome_completo, salarioBase, dataAdmissao, dataDemissao,
        tipoRescisao: tipo, avisoPrevio: aviso, saldoFgts, feriasVencidas,
        mesesPeriodoAquisitivo: mesesPA, meses13Proporcional: meses13,
      });
      return { tipo, label: tipoRescisaoLabels[tipo], custoEmpresa: r.custoTotalEmpresa, liquidoColab: r.liquidoRescisao, totalRecebido: r.totalRecebido };
    });
  }, [employeeId, salarioBase, dataAdmissao, dataDemissao, saldoFgts, feriasVencidas, mesesPA, meses13]);

  const selectedEmp = employees.find((e) => e.id === employeeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Simulador de Rescisão
          </h1>
          <p className="text-muted-foreground text-sm">Calcule o custo de demissão de qualquer colaborador</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Dados da Rescisão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={employeeId} onValueChange={handleSelectEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEmp && (
              <p className="text-xs text-muted-foreground">
                {selectedEmp.cargo} • {selectedEmp.departamento}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Salário Base</Label>
                <Input type="number" value={salarioBase} onChange={(e) => setSalarioBase(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Saldo FGTS</Label>
                <Input type="number" value={saldoFgts} onChange={(e) => setSaldoFgts(Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Admissão</Label>
                <Input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Demissão</Label>
                <Input type="date" value={dataDemissao} onChange={(e) => setDataDemissao(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Tipo de Rescisão</Label>
              <Select value={tipoRescisao} onValueChange={(v) => setTipoRescisao(v as TipoRescisao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoRescisaoLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Aviso Prévio</Label>
              <Select value={avisoPrevio} onValueChange={(v) => setAvisoPrevio(v as TipoAvisoPrevio)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {avisoOptions[tipoRescisao].map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Meses 13º</Label>
                <Input type="number" value={meses13} onChange={(e) => setMeses13(Number(e.target.value))} min={0} max={12} />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Meses Férias</Label>
                <Input type="number" value={mesesPA} onChange={(e) => setMesesPA(Number(e.target.value))} min={0} max={12} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={feriasVencidas} onChange={(e) => setFeriasVencidas(e.target.checked)} className="rounded" />
                  Fér. vencidas
                </label>
              </div>
            </div>

            <Button onClick={handleCalc} className="w-full gap-2">
              <Calculator className="h-4 w-4" />
              Calcular Rescisão
            </Button>
          </CardContent>
        </Card>

        {/* Resultado */}
        <div className="lg:col-span-2 space-y-4">
          {resultado ? (
            <>
              {/* Proventos e Descontos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-emerald-600 flex items-center gap-1.5">
                      <ArrowUpRight className="h-4 w-4" /> Proventos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <Line label="Saldo de Salário" value={resultado.saldoSalario} />
                    {resultado.avisoPrevioIndenizado > 0 && (
                      <Line label={`Aviso Prévio Indenizado (${resultado.diasAviso}d)`} value={resultado.avisoPrevioIndenizado} />
                    )}
                    <Line label="13º Proporcional" value={resultado.decimoTerceiroProporcional} />
                    <Line label="Férias Proporcionais" value={resultado.feriasProporcionais} />
                    <Line label="1/3 sobre Férias" value={resultado.tercoFeriasProporcionais} />
                    {resultado.feriasVencidas > 0 && (
                      <>
                        <Line label="Férias Vencidas" value={resultado.feriasVencidas} />
                        <Line label="1/3 sobre Férias Vencidas" value={resultado.tercoFeriasVencidas} />
                      </>
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold text-emerald-700">
                      <span>Total Proventos</span>
                      <span>{fmtBRL(resultado.totalProventos)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-600 flex items-center gap-1.5">
                      <ArrowDownRight className="h-4 w-4" /> Descontos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <Line label="INSS" value={resultado.inssRescisao} negative />
                    <Line label="IRRF" value={resultado.irrfRescisao} negative />
                    {resultado.avisoPrevioDesconto > 0 && (
                      <Line label="Aviso Prévio (desconto)" value={resultado.avisoPrevioDesconto} negative />
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold text-red-600">
                      <span>Total Descontos</span>
                      <span>-{fmtBRL(resultado.totalDescontos)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Líquido */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="font-semibold text-lg">Líquido Rescisão</span>
                  <span className="text-2xl font-bold text-primary">{fmtBRL(resultado.liquidoRescisao)}</span>
                </CardContent>
              </Card>

              {/* Custos empresa + Resumo colaborador */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-destructive">Custo Total Empresa</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <Line label="Multa FGTS" value={resultado.multaFgts} />
                    <Line label="INSS Patronal" value={resultado.inssPatronal} />
                    <Line label="FGTS sobre Rescisão" value={resultado.fgtsSobreRescisao} />
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold text-destructive text-base">
                      <span>Custo Total</span>
                      <span>{fmtBRL(resultado.custoTotalEmpresa)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-700">Resumo Colaborador</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <Line label="Líquido Rescisão" value={resultado.liquidoRescisao} />
                    <Line label="Saque FGTS" value={resultado.saqueFgts} />
                    {resultado.seguroDesempregoParcelas > 0 && (
                      <Line
                        label={`Seguro Desemp. (${resultado.seguroDesempregoParcelas}x)`}
                        value={resultado.seguroDesempregoParcelas * resultado.seguroDesempregoValor}
                      />
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold text-blue-700 text-base">
                      <span>Total Recebido</span>
                      <span>{fmtBRL(resultado.totalRecebido)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar Simulação"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>

              {/* Comparativo */}
              {comparativo && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Comparativo de Cenários</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cenário</TableHead>
                          <TableHead className="text-right">Custo Empresa</TableHead>
                          <TableHead className="text-right">Líquido Colaborador</TableHead>
                          <TableHead className="text-right">Total Recebido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativo.map((c) => (
                          <TableRow key={c.tipo} className={c.tipo === tipoRescisao ? "bg-muted/50" : ""}>
                            <TableCell>
                              <span className="font-medium text-sm">{c.label}</span>
                              {c.tipo === tipoRescisao && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">Atual</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium text-destructive">{fmtBRL(c.custoEmpresa)}</TableCell>
                            <TableCell className="text-right">{fmtBRL(c.liquidoColab)}</TableCell>
                            <TableCell className="text-right font-medium text-blue-700">{fmtBRL(c.totalRecebido)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center text-muted-foreground py-12">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Selecione um colaborador e clique em <strong>Calcular Rescisão</strong></p>
              </CardContent>
            </Card>
          )}

          {/* Histórico */}
          {historico.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <History className="h-4 w-4" /> Simulações Recentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Custo Empresa</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((h: any) => {
                      const v = h.valores_json as any;
                      return (
                        <TableRow key={h.id}>
                          <TableCell className="text-xs">
                            {format(new Date(h.data_simulacao), "dd/MM/yy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {tipoRescisaoLabels[h.tipo_rescisao as TipoRescisao] ?? h.tipo_rescisao}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{fmtBRL(v?.custoTotalEmpresa ?? 0)}</TableCell>
                          <TableCell className="text-right text-sm">{fmtBRL(v?.liquidoRescisao ?? 0)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  if (value === 0) return null;
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{negative ? "-" : ""}{fmtBRL(value)}</span>
    </div>
  );
}
