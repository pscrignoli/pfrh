import { useState } from "react";
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
import { FlaskConical, Loader2, Send, ShieldCheck } from "lucide-react";

export default function EmpregareTab() {
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
        body: { method, endpoint: path, payload: parsedPayload },
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
    <div className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          Autenticação gerenciada via variáveis de ambiente seguras (Secrets do backend). O token nunca é exposto no frontend.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Laboratório de API (Sandbox)
          </CardTitle>
          <CardDescription>
            Teste endpoints da API Empregare. O token de autenticação é injetado automaticamente pelo servidor.
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
    </div>
  );
}
