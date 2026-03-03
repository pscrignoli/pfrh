import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-hr`;

const suggestions = [
  "Quais são os direitos de férias na CLT?",
  "Qual o custo total da folha deste mês?",
  "Como funciona o cálculo do 13º salário?",
  "Quais são as regras de horas extras?",
];

export default function Assistente() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || isLoading) return;

    const userMsg: Msg = { role: "user", content: messageText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Get session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro na requisição" }));
        toast({ title: "Erro", description: err.error, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
                }
                return [...prev, { role: "assistant", content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Erro de conexão", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Assistente de RH
        </h1>
        <p className="text-muted-foreground text-sm">
          Pergunte sobre legislação trabalhista, dados de colaboradores ou cálculos de RH.
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="rounded-full bg-primary/10 p-6">
              <Bot className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold">Como posso ajudar?</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Sou especialista em RH, legislação trabalhista brasileira e análise de dados de pessoas.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm rounded-lg border p-3 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="shrink-0 mt-1 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:text-left [&_th]:p-1 [&_td]:p-1 [&_table]:border-collapse [&_th]:border-b [&_td]:border-b">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 mt-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="shrink-0 mt-1 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-xl px-4 py-3 space-y-2">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 pt-4">
        <Card className="flex items-end gap-2 p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua pergunta..."
            rows={1}
            className="flex-1 resize-none bg-transparent border-0 outline-none text-sm p-2 max-h-32 min-h-[2.5rem]"
            style={{ fieldSizing: "content" } as any}
          />
          <Button size="icon" onClick={() => send()} disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
