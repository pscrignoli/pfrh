import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  FlaskConical, Loader2, Send, ShieldCheck, Eye, EyeOff,
  CheckCircle2, XCircle, Wifi, Building2, Briefcase, LayoutGrid,
  Clock, AlertTriangle, ArrowRight,
} from "lucide-react";
import { format } from "date-fns";

// ── Connection Status Card ──
interface ConnectionStatus {
  connected: boolean;
  vagasCount: number | null;
  setoresCount: number | null;
  unidadesCount: number | null;
  authFormat: string | null;
}

function StatusCard({ status, loading }: { status: ConnectionStatus; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Verificando conexão…</span>
        </CardContent>
      </Card>
    );
  }

  if (!status.connected) return null;

  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-400">Conectado</span>
          </div>
          {status.vagasCount !== null && (
            <Badge variant="outline" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              {status.vagasCount} vagas
            </Badge>
          )}
          {status.setoresCount !== null && (
            <Badge variant="outline" className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              {status.setoresCount} setores
            </Badge>
          )}
          {status.unidadesCount !== null && (
            <Badge variant="outline" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {status.unidadesCount} unidades
            </Badge>
          )}
          {status.authFormat && (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              Formato: {status.authFormat}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Integration Logs Card ──
interface LogEntry {
  id: string;
  created_at: string;
  endpoint: string | null;
  status: string;
  error_message: string | null;
  response_payload: any;
}

function DiagnosticsCard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("integration_logs")
      .select("id, created_at, endpoint, status, error_message, response_payload")
      .eq("source", "empregare")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setLogs((data as LogEntry[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Log de Diagnóstico (últimos 5)
        </CardTitle>
        <CardDescription>Requests recentes para a API Empregare.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando…</span>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nenhum log encontrado.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1 rounded-lg border p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <code className="font-mono text-xs truncate">{log.endpoint ?? "—"}</code>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM HH:mm:ss")}
                  </span>
                </div>
                {log.error_message && (
                  <p className="text-xs text-destructive ml-6">{log.error_message}</p>
                )}
                {log.response_payload && (
                  <pre className="text-xs text-muted-foreground ml-6 max-h-16 overflow-auto whitespace-pre-wrap font-mono bg-muted/50 rounded p-1.5">
                    {typeof log.response_payload === "string"
                      ? log.response_payload.slice(0, 300)
                      : JSON.stringify(log.response_payload, null, 1).slice(0, 300)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──
export default function EmpregareTab() {
  // Token config
  const [apiToken, setApiToken] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Status
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false, vagasCount: null, setoresCount: null, unidadesCount: null, authFormat: null,
  });
  const [statusLoading, setStatusLoading] = useState(false);

  // Sandbox
  const [method, setMethod] = useState("GET");
  const [endpoint, setEndpoint] = useState("");
  const [payload, setPayload] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  // Diagnostics refresh key
  const [diagKey, setDiagKey] = useState(0);

  // Load saved config
  useEffect(() => {
    Promise.all([
      supabase.from("system_settings").select("value").eq("key", "empregare_api_token").maybeSingle(),
      supabase.from("system_settings").select("value").eq("key", "empregare_empresa_id").maybeSingle(),
    ]).then(([tokenRes, empresaRes]) => {
      if (tokenRes.data?.value) setApiToken(tokenRes.data.value);
      if (empresaRes.data?.value) setEmpresaId(empresaRes.data.value);
      setLoadingConfig(false);
    });
  }, []);

  // Fetch status counts
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const endpoints = [
        { key: "vagas", endpoint: "/api/vaga/listar", method: "GET" },
        { key: "setores", endpoint: "/api/setores/listar", method: "GET" },
        { key: "unidades", endpoint: "/api/unidade-negocio/listar", method: "GET" },
      ];

      const [results, formatRes] = await Promise.all([
        Promise.allSettled(
          endpoints.map((ep) =>
            supabase.functions.invoke("empregare-proxy", {
              body: { method: ep.method, endpoint: ep.endpoint },
            })
          )
        ),
        supabase.from("system_settings").select("value").eq("key", "empregare_auth_format").maybeSingle(),
      ]);

      let vagasCount: number | null = null;
      let setoresCount: number | null = null;
      let unidadesCount: number | null = null;

      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.data?.data) {
          const d = r.value.data.data;
          const count = Array.isArray(d) ? d.length : (d?.Total ?? d?.total ?? d?.length ?? null);
          if (i === 0) vagasCount = count;
          if (i === 1) setoresCount = count;
          if (i === 2) unidadesCount = count;
        }
      });

      setStatus({
        connected: true,
        vagasCount,
        setoresCount,
        unidadesCount,
        authFormat: formatRes.data?.value ?? null,
      });
    } catch {
      // silent
    } finally {
      setStatusLoading(false);
      setDiagKey((k) => k + 1);
    }
  }, []);

  // Check if already connected on mount
  useEffect(() => {
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "empregare_auth_format")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) fetchStatus();
      });
  }, [fetchStatus]);

  // Test connection
  const handleTestConnection = async () => {
    if (!apiToken.trim()) {
      toast({ title: "Informe o token da API.", variant: "destructive" });
      return;
    }

    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("empregare-proxy", {
        body: {
          action: "test_connection",
          api_token: apiToken.trim(),
          empresa_id: empresaId.trim() || undefined,
        },
      });

      if (error) {
        setConnectionResult({ success: false, message: error.message });
        setDiagKey((k) => k + 1);
        return;
      }

      if (data?.success) {
        setConnectionResult({
          success: true,
          message: data.message || "Autenticação bem-sucedida!",
        });
        toast({ title: "Conectado ao Empregare com sucesso!" });
        await fetchStatus();
      } else {
        setConnectionResult({ success: false, message: data?.error || "Falha na autenticação." });
      }
    } catch (e: any) {
      setConnectionResult({ success: false, message: e.message });
    } finally {
      setTestingConnection(false);
      setDiagKey((k) => k + 1);
    }
  };

  // Sandbox send
  const handleSend = async () => {
    if (!endpoint.trim()) {
      toast({ title: "Informe o endpoint.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    setStatusCode(null);

    try {
      let parsedPayload = undefined;
      if (method !== "GET" && payload.trim()) {
        try {
          parsedPayload = JSON.parse(payload);
        } catch {
          toast({ title: "Payload JSON inválido.", variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const { data: fnData, error: fnError } = await supabase.functions.invoke("empregare-proxy", {
        body: { method, endpoint: path, payload: parsedPayload },
      });

      if (fnError) {
        setStatusCode(500);
        setResult(JSON.stringify({ error: fnError.message }, null, 2));
        return;
      }

      setStatusCode(fnData?.status ?? 200);
      setResult(JSON.stringify(fnData?.data ?? fnData, null, 2));
    } catch (e: any) {
      setResult(JSON.stringify({ error: e.message }, null, 2));
      setStatusCode(500);
    } finally {
      setLoading(false);
      setDiagKey((k) => k + 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <StatusCard status={status} loading={statusLoading} />

      {/* Token Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Configuração da API Empregare
          </CardTitle>
          <CardDescription>
            Insira o token permanente e o EmpresaID. A autenticação será descoberta automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Token da API</label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder="Cole o token da API aqui"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="pr-10 font-mono text-sm"
                  disabled={loadingConfig}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">EmpresaID</label>
              <Input
                type="text"
                placeholder="ID da empresa no Empregare"
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className="font-mono text-sm"
                disabled={loadingConfig}
              />
            </div>
          </div>

          <Button onClick={handleTestConnection} disabled={testingConnection || !apiToken.trim()}>
            {testingConnection ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4 mr-2" />
            )}
            Testar Conexão
          </Button>

          {connectionResult && (
            <Alert className={connectionResult.success ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}>
              {connectionResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <AlertDescription className="text-sm">
                {connectionResult.message}
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-primary/30 bg-primary/5">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              O proxy testa automaticamente múltiplos formatos de autenticação (body JSON, headers, token direto)
              e salva o formato que funcionar. Nos próximos requests, usa o formato salvo.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Diagnostics Log */}
      <DiagnosticsCard key={diagKey} />

      {/* Sandbox */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Laboratório de API (Sandbox)
          </CardTitle>
          <CardDescription>
            Teste endpoints da API Empregare. A autenticação é injetada automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full md:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="/api/vaga/listar"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button onClick={handleSend} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar
            </Button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Payload (JSON)
              {method === "GET" && (
                <span className="text-muted-foreground ml-2 font-normal">— desabilitado para GET</span>
              )}
            </label>
            <Textarea
              placeholder='{"campo": "valor"}'
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              disabled={method === "GET"}
              className="font-mono text-sm min-h-[100px]"
            />
          </div>

          {result !== null && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Resposta</span>
                {statusCode !== null && (
                  <Badge variant={statusCode < 300 ? "default" : "destructive"}>
                    HTTP {statusCode}
                  </Badge>
                )}
              </div>
              <pre className="bg-zinc-900 text-zinc-100 dark:bg-zinc-950 p-4 rounded-lg overflow-auto max-h-[500px] text-xs font-mono whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
