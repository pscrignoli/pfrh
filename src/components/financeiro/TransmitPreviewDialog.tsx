import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { PayrollRecord } from "@/hooks/useFinanceiroData";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Copy, Download, Send, Loader2, CheckCircle2, AlertTriangle, DollarSign, Users, ShieldCheck, Gift,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  ano: number;
  mes: number;
  records: PayrollRecord[];
  onTransmitted: () => void;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function n(v: number | null | undefined): number {
  return Number(v) || 0;
}

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildPayload(records: PayrollRecord[], companyName: string, ano: number, mes: number) {
  const totals = {
    headcount: records.length,
    total_folha: 0,
    total_encargos: 0,
    total_provisoes: 0,
    total_beneficios: 0,
    total_geral: 0,
  };

  const centroCustoMap = new Map<string, {
    centro_custo: string;
    headcount: number;
    total_folha: number;
    encargos: number;
    beneficios: number;
    total_geral: number;
  }>();

  const detalhamento = records.map(r => {
    const folha = n(r.total_folha);
    const encargos = n(r.encargos);
    const provisoes = n(r.ferias) + n(r.terco_ferias) + n(r.decimo_terceiro);
    const beneficios = n(r.beneficios);
    const total = n(r.total_geral);

    totals.total_folha += folha;
    totals.total_encargos += encargos;
    totals.total_provisoes += provisoes;
    totals.total_beneficios += beneficios;
    totals.total_geral += total;

    const cc = r.centro_custo || r.codigo_centro_custo || "Sem Centro de Custo";
    const existing = centroCustoMap.get(cc) ?? {
      centro_custo: cc,
      headcount: 0,
      total_folha: 0,
      encargos: 0,
      beneficios: 0,
      total_geral: 0,
    };
    existing.headcount += 1;
    existing.total_folha += folha;
    existing.encargos += encargos;
    existing.beneficios += beneficios;
    existing.total_geral += total;
    centroCustoMap.set(cc, existing);

    return {
      employee_id: r.employee_id,
      nome: r.employee_name,
      cargo: r.cargo,
      centro_custo: cc,
      remuneracao: {
        salario_base: n(r.salario_base),
        salario: n(r.salario),
        horas_extras: n(r.he_total),
        adicional_noturno: n(r.adicional_noturno),
        bonus_gratificacao: n(r.bonus_gratificacao),
        insalubridade: n(r.insalubridade),
        total_folha: folha,
      },
      encargos: {
        fgts_8: n(r.fgts_8),
        inss_20: n(r.inss_20),
        total: encargos,
      },
      provisoes: {
        ferias: n(r.ferias),
        terco_ferias: n(r.terco_ferias),
        decimo_terceiro: n(r.decimo_terceiro),
        fgts_ferias: n(r.fgts_ferias),
        inss_ferias: n(r.inss_ferias),
        fgts_13: n(r.fgts_13),
        inss_13: n(r.inss_13),
      },
      beneficios: {
        convenio_medico: n(r.convenio_medico),
        plano_odontologico: n(r.plano_odontologico),
        vr_alimentacao: n(r.vr_alimentacao),
        vale_transporte: n(r.vale_transporte),
        total: beneficios,
      },
      total_geral: total,
    };
  });

  return {
    empresa: companyName,
    competencia: { ano, mes, referencia: `${String(mes).padStart(2, "0")}/${ano}` },
    gerado_em: new Date().toISOString(),
    resumo: totals,
    por_centro_custo: Array.from(centroCustoMap.values()),
    detalhamento,
  };
}

export function TransmitPreviewDialog({ open, onClose, ano, mes, records, onTransmitted }: Props) {
  const { companyId, companyName } = useCompany();
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null);

  const payload = useMemo(
    () => buildPayload(records, companyName ?? "—", ano, mes),
    [records, companyName, ano, mes]
  );
  const jsonStr = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  // Load webhook URL
  useEffect(() => {
    if (!open) {
      setResponse(null);
      return;
    }
    setWebhookLoading(true);
    supabase
      .from("rh_system_settings")
      .select("value")
      .eq("key", "controladoria_webhook_url")
      .maybeSingle()
      .then(({ data }) => {
        setWebhookUrl(data?.value?.trim() || null);
        setWebhookLoading(false);
      });
  }, [open]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    toast({ title: "JSON copiado!" });
  };

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folha_${ano}_${String(mes).padStart(2, "0")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Arquivo baixado!" });
  };

  const handleSend = async () => {
    setSending(true);
    setResponse(null);

    try {
      let logStatus: "success" | "error" = "success";
      let logEndpoint = webhookUrl ?? "(mock)";
      let logResponse: any = null;
      let logError: string | null = null;

      if (webhookUrl) {
        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: jsonStr,
          });
          const body = await res.text();
          logResponse = { status: res.status, body: body.substring(0, 2000) };
          setResponse({ status: res.status, body });
          if (!res.ok) {
            logStatus = "error";
            logError = `HTTP ${res.status}: ${body.substring(0, 500)}`;
          }
        } catch (err: any) {
          logStatus = "error";
          logError = err.message;
          logResponse = { error: err.message };
          setResponse({ status: 0, body: err.message });
        }
      } else {
        logResponse = { status: 200, message: "Dados recebidos com sucesso (mock)" };
        setResponse({ status: 200, body: JSON.stringify(logResponse) });
      }

      // Log to integration_logs
      await supabase.from("rh_integration_logs").insert({
        source: "folha_mensal",
        direction: "outbound",
        endpoint: logEndpoint,
        status: logStatus as any,
        request_payload: payload as any,
        response_payload: logResponse as any,
        error_message: logError,
        company_id: companyId,
      });

      // Mark as transmitido
      if (logStatus === "success") {
        const ids = records.map(r => r.id);
        await supabase
          .from("rh_payroll_monthly_records")
          .update({ status: "enviado" })
          .in("id", ids);

        toast({ title: "Folha transmitida com sucesso!" });
        onTransmitted();
      } else {
        toast({ title: "Erro na transmissão", description: logError ?? "Erro desconhecido", variant: "destructive" });
      }
    } finally {
      setSending(false);
    }
  };

  const { resumo } = payload;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Transmitir Folha — {monthNames[mes - 1]}/{ano}
          </DialogTitle>
          <DialogDescription>
            Revise o payload antes de enviar para a Controladoria.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="resumo" className="flex-1 min-h-0">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="cc">Centro de Custo</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          {/* ── Resumo ── */}
          <TabsContent value="resumo" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard icon={Users} label="Headcount" value={String(resumo.headcount)} />
              <SummaryCard icon={DollarSign} label="Total Folha" value={currency(resumo.total_folha)} />
              <SummaryCard icon={ShieldCheck} label="Encargos" value={currency(resumo.total_encargos)} />
              <SummaryCard icon={Gift} label="Benefícios" value={currency(resumo.total_beneficios)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Provisões</p>
                  <p className="text-lg font-bold tabular-nums">{currency(resumo.total_provisoes)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Geral</p>
                  <p className="text-xl font-bold tabular-nums text-primary">{currency(resumo.total_geral)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium">{payload.empresa}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Competência</span>
                <span className="font-medium">{payload.competencia.referencia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gerado em</span>
                <span className="font-medium">{new Date(payload.gerado_em).toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Webhook</span>
                <span className="font-medium">
                  {webhookLoading ? "..." : webhookUrl ? (
                    <Badge variant="outline" className="text-xs font-mono">{webhookUrl}</Badge>
                  ) : (
                    <span className="text-muted-foreground italic">Não configurado</span>
                  )}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* ── Centro de Custo ── */}
          <TabsContent value="cc" className="mt-4">
            <ScrollArea className="h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead className="text-right">HC</TableHead>
                    <TableHead className="text-right">Folha</TableHead>
                    <TableHead className="text-right">Encargos</TableHead>
                    <TableHead className="text-right">Benefícios</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.por_centro_custo.map((cc, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{cc.centro_custo}</TableCell>
                      <TableCell className="text-right tabular-nums">{cc.headcount}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{currency(cc.total_folha)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{currency(cc.encargos)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{currency(cc.beneficios)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">{currency(cc.total_geral)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          {/* ── JSON ── */}
          <TabsContent value="json" className="mt-4">
            <ScrollArea className="h-[350px] rounded-lg border bg-muted/30">
              <pre className="p-4 text-xs font-mono whitespace-pre overflow-x-auto">
                {jsonStr}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Response display */}
        {response && (
          <div className={`mt-2 rounded-lg border p-3 text-sm ${response.status >= 200 && response.status < 300 ? "border-success/50 bg-success/10" : "border-destructive/50 bg-destructive/10"}`}>
            <div className="flex items-center gap-2 mb-1">
              {response.status >= 200 && response.status < 300 ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium">
                {response.status === 0 ? "Erro de conexão" : `HTTP ${response.status}`}
              </span>
            </div>
            <pre className="text-xs font-mono max-h-24 overflow-auto text-muted-foreground">
              {response.body.substring(0, 1000)}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t mt-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Baixar .json
          </Button>
          <div className="flex-1" />

          {!webhookUrl && !webhookLoading && (
            <span className="text-xs text-muted-foreground mr-2">
              Configure em Configurações &gt; Integrações
            </span>
          )}

          <Button onClick={handleSend} disabled={sending || records.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {webhookUrl ? "Enviar via Webhook" : "Enviar (Mock)"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-bold tabular-nums truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
