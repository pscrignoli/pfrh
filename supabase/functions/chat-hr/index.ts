import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify token
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Fetch context: active employee count and recent payroll summary
    const { count: headcount } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo");

    const now = new Date();
    const { data: payrollSummary } = await supabase
      .from("payroll_monthly_records")
      .select("total_geral, he_total, salario, encargos, beneficios")
      .eq("ano", now.getFullYear())
      .eq("mes", now.getMonth() + 1)
      .limit(500);

    const totalFolha = (payrollSummary ?? []).reduce((s, r) => s + (Number(r.total_geral) || 0), 0);
    const totalHE = (payrollSummary ?? []).reduce((s, r) => s + (Number(r.he_total) || 0), 0);

    const contextBlock = `
DADOS ATUAIS DA EMPRESA (consulte sempre que relevante):
- Headcount ativo: ${headcount ?? 0}
- Custo total da folha (mês atual): R$ ${totalFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total de horas extras (mês atual): R$ ${totalHE.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Registros de folha no mês: ${payrollSummary?.length ?? 0}
`;

    const systemPrompt = `Você é o Assistente de RH, um especialista em Recursos Humanos, legislação trabalhista brasileira (CLT, eSocial) e análise de dados de pessoas.

Sua função é ajudar profissionais de RH respondendo perguntas sobre:
- Legislação trabalhista (CLT, férias, rescisão, jornada, horas extras, FGTS, INSS)
- Dados dos colaboradores e indicadores de RH
- Cálculos trabalhistas (férias, 13º, rescisão, encargos)
- Boas práticas de gestão de pessoas

${contextBlock}

REGRAS:
1. Sempre responda em português brasileiro.
2. Quando citar legislação, indique o artigo e a lei. Formate como: **Fonte:** Art. X da CLT (Lei nº Y/Z)
3. Para dados numéricos, formate em tabelas markdown quando apropriado.
4. Se não souber algo com certeza, diga que recomenda consultar o jurídico.
5. Seja objetivo mas completo. Use markdown para formatar respostas (negrito, listas, tabelas).`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-hr error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
