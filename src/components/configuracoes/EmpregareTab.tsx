import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plug, FlaskConical, Loader2, Send, CheckCircle2, XCircle, Clock } from "lucide-react";

// ── Auth Section ──
function AuthSection({
  token,
  setToken,
  expiresAt,
  setExpiresAt,
}: {
  token: string;
  setToken: (t: string) => void;
  expiresAt: Date | null;
  setExpiresAt: (d: Date | null) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

  const isExpired = expiresAt ? new Date() > expiresAt : true;
  const isConnected = !!token && !isExpired;

  // Time remaining display
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expirado");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const handleConnect = async () => {
    if (!username.trim() || !password.trim()) {
      toast({ title: "Preencha usuário e senha.", variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("empregare-proxy", {
        body: {
          action: "authenticate",
          credentials: { username: username.trim(), password: password.trim() },
        },
      });

      if (fnError) throw new Error(fnError.message);

      const result = fnData;
      if (result.status >= 200 && result.status < 300 && result.data) {
        // Try common token field names
        const tk =
          result.data.token ||
          result.data.access_token ||
          result.data.accessToken ||
          result.data.Token ||
          (typeof result.data === "string" ? result.data : null);

        if (tk) {
          setToken(tk);
          const exp = new Date(Date.now() + 12 * 60 * 60 * 1000);
          setExpiresAt(exp);
          toast({ title: "Conectado com sucesso!" });
        } else {
          toast({
            title: "Token não encontrado na resposta",
            description: JSON.stringify(result.data).slice(0, 200),
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: `Erro ${result.status}`,
          description: JSON.stringify(result.data).slice(0, 200),
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro de conexão", description: e.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          Autenticação Empregare
        </CardTitle>
        <CardDescription>
          Insira as credenciais da API do Empregare para gerar um token de acesso (válido por 12h).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
          {isConnected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Conectado — Token Ativo
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" />
                  Expira em: {timeLeft}
                </div>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-300">Ativo</Badge>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground flex-1">
                {token ? "Token expirado — gere um novo" : "Desconectado — insira suas credenciais"}
              </span>
              <Badge variant="secondary">{token ? "Expirado" : "Offline"}</Badge>
            </>
          )}
        </div>

        {/* Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Usuário</label>
            <Input
              placeholder="usuario@empresa.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Senha / Chave</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plug className="h-4 w-4 mr-2" />
          )}
          {connecting ? "Conectando..." : "Conectar / Gerar Token"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Sandbox Section ──
function SandboxSection({ token }: { token: string }) {
  const [method, setMethod] = useState("GET");
  const [endpoint, setEndpoint] = useState("");
  const [payload, setPayload] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const handleSend = async () => {
    if (!endpoint.trim()) {
      toast({ title: "Informe o endpoint.", variant: "destructive" });
      return;
    }
    if (!token) {
      toast({ title: "Gere um token primeiro.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    setStatusCode(null);

    try {
      let parsedPayload = undefined;
      if (method === "POST" && payload.trim()) {
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
        body: {
          action: "proxy",
          method,
          endpoint: path,
          payload: parsedPayload,
          empregareToken: token,
        },
      });

      if (fnError) throw new Error(fnError.message);

      setStatusCode(fnData.status);
      setResult(JSON.stringify(fnData.data, null, 2));
    } catch (e: any) {
      setResult(JSON.stringify({ error: e.message }, null, 2));
      setStatusCode(500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          Laboratório de API (Sandbox)
        </CardTitle>
        <CardDescription>
          Teste endpoints da API Empregare. O token ativo será injetado automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
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
            placeholder="/api/admissao/detalhes/123"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Button onClick={handleSend} disabled={loading || !token}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Requisição
          </Button>
        </div>

        {/* Payload */}
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

        {/* Result */}
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
  );
}

// ── Main Export ──
export default function EmpregareTab() {
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  return (
    <div className="space-y-4">
      <AuthSection
        token={token}
        setToken={setToken}
        expiresAt={expiresAt}
        setExpiresAt={setExpiresAt}
      />
      <SandboxSection token={token} />
    </div>
  );
}
