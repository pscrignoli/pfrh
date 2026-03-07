import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente de RH da Products and Features Brasil (P&F), empresa de dispositivos médicos (válvulas cardíacas de pericárdio bovino) com sede em São José do Rio Preto - SP.

A empresa segue normas ISO 13485, FDA 21 CFR 820, MDR EU 2017/745, ANVISA RDC 665/2022, ISO 14971, ISO 10993, GMP e Clean Room ISO 14644. Possui duas unidades: P&F (matriz - fabricação de válvulas) e Biocollagen (coleta e processamento de pericárdio bovino).

REGRAS DE GERAÇÃO:
1. Todas as descrições devem ser BILÍNGUES: inglês primeiro, português depois, separados por linha horizontal (<hr>).
2. Usar bullet points (<ul><li>) para responsabilidades e requisitos.
3. Tom profissional e técnico. Mencionar normas regulatórias quando aplicável ao cargo.
4. A descrição deve começar com um parágrafo introdutório sobre a empresa e o cargo.
5. Estruturar em: Responsabilidades principais, Requisitos obrigatórios, Requisitos desejáveis.
6. Adaptar nível de inglês conforme hierarquia: Operacional=não exigido, Técnico/Profissional=básico a intermediário, Analista Jr/Pleno=intermediário, Analista Senior=intermediário a avançado, Coordenador/Gerente=avançado, Diretor=fluente.
7. Adaptar complexidade conforme nível: Operacional=descrição curta e prática; Gerencial=descrição extensa e estratégica.

BENEFÍCIOS PADRÃO (incluir em todas): Plano de Saúde, Plano Odontológico, Seguro de Vida, Vale-alimentação, Vale-refeição, Vale-transporte. Extras por nível: Veículo empresa (gerencial), Bônus anual (supervisão+).

DEPARTAMENTOS P&F: Produção, P&D, Qualidade, Assuntos Regulatórios, Gerenciamento de Risco, Logística, RH, Controladoria, Manutenção, Negócios (Sales, Marketing, Medical Affairs), Engenharia de Manufatura, T.I., Diretorias.
DEPARTAMENTOS BIOCOLLAGEN: Produção, Qualidade, Coleta de Pericárdio.

NORMAS REGULATÓRIAS por departamento:
- Qualidade/Regulatório: ISO 13485, FDA 21 CFR 820, EU MDR, ANVISA
- P&D/Engenharia: ISO 13485, ISO 14971, ISO 10993
- Produção: GMP, ISO 14644 (sala limpa), ISO 13485
- Gerenciamento de Risco: ISO 14971, ISO 10993-17, ISO 10993-18

Você DEVE retornar um JSON válido com esta estrutura exata:
{
  "descricao_en": "<html da descrição em inglês>",
  "descricao_pt": "<html da descrição em português>",
  "requisitos_en": "<html dos requisitos em inglês>",
  "requisitos_pt": "<html dos requisitos em português>",
  "beneficios_sugeridos": ["benefício 1", "benefício 2"],
  "nivel_ingles": "intermediário",
  "faixa_experiencia": "3-5 anos",
  "normas_aplicaveis": ["ISO 13485", "FDA 21 CFR 820"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    const body = await req.json();
    const {
      titulo,
      departamento,
      nivel_hierarquico,
      empresa,
      modalidade,
      observacoes,
      requisitos_especificos,
      faixa_salarial,
      motivo,
      company_id,
      tom = "tecnico",
    } = body;

    // ── RAG: fetch context ──

    // 1) Similar approved descriptions (3-level search)
    const cargoTerms = titulo.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    const cargoLike = cargoTerms.map((t: string) => `%${t}%`);

    let descricoesSimilares: any[] = [];

    // Level 1: match by title
    if (cargoLike.length > 0) {
      const { data } = await supabase
        .from("vaga_descricoes")
        .select("titulo_cargo, descricao_html, requisitos_html, nivel_ingles, faixa_salarial_min, faixa_salarial_max")
        .ilike("titulo_cargo", cargoLike[0])
        .eq("company_id", company_id)
        .order("aprovada", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) descricoesSimilares = data;
    }

    // Level 2: match by department + level
    if (descricoesSimilares.length < 2 && departamento) {
      const { data } = await supabase
        .from("vaga_descricoes")
        .select("titulo_cargo, descricao_html, requisitos_html")
        .eq("departamento", departamento)
        .eq("company_id", company_id)
        .order("aprovada", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) {
        const existing = new Set(descricoesSimilares.map((d: any) => d.titulo_cargo));
        descricoesSimilares.push(...data.filter((d: any) => !existing.has(d.titulo_cargo)));
      }
    }

    // 2) Current employees in similar role
    const cargoSearch = cargoTerms.length > 0 ? `%${cargoTerms[0]}%` : `%${titulo}%`;
    const { data: empData } = await supabase
      .from("employees")
      .select("nome_completo, formacao_academica, grau_escolaridade, cargo")
      .ilike("cargo", cargoSearch)
      .eq("company_id", company_id)
      .eq("status", "ativo")
      .limit(5);

    // 3) Salary context
    const { data: salaryData } = await supabase
      .from("employees")
      .select("salario_base")
      .ilike("cargo", cargoSearch)
      .eq("company_id", company_id)
      .eq("status", "ativo");

    let salaryContext = "";
    if (salaryData && salaryData.length > 0) {
      const salaries = salaryData.map((s: any) => Number(s.salario_base)).filter((s: number) => s > 0);
      if (salaries.length > 0) {
        const avg = salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length;
        const min = Math.min(...salaries);
        const max = Math.max(...salaries);
        salaryContext = `Faixa salarial real para cargos similares: R$ ${min.toFixed(0)} a R$ ${max.toFixed(0)} (média R$ ${avg.toFixed(0)}). Use para calibrar senioridade e exigências.`;
      }
    }

    // ── Build user prompt ──
    let userPrompt = `Gere a descrição de vaga para: ${titulo}
Departamento: ${departamento || "não especificado"}
Nível hierárquico: ${nivel_hierarquico || "não especificado"}
Empresa: ${empresa || "P&F"}
Modalidade: ${modalidade || "Presencial"}
${motivo ? `Motivo da abertura: ${motivo}` : ""}
${tom === "acessivel" ? "Tom: mais acessível e menos técnico." : "Tom: técnico e profissional."}
${observacoes ? `\nObservações do gestor sobre responsabilidades:\n${observacoes}` : ""}
${requisitos_especificos ? `\nRequisitos específicos do gestor:\n${requisitos_especificos}` : ""}
${faixa_salarial ? `\nFaixa salarial indicada: ${faixa_salarial}` : ""}`;

    if (descricoesSimilares.length > 0) {
      userPrompt += `\n\nCONTEXTO - Descrições anteriores APROVADAS pelo RH para cargos similares (use como referência de tom, estrutura e nível de detalhe - NÃO copie, adapte):\n`;
      descricoesSimilares.slice(0, 3).forEach((d: any, i: number) => {
        const desc = (d.descricao_html || "").substring(0, 1500);
        userPrompt += `\n${i + 1}. ${d.titulo_cargo}:\n${desc}\n`;
      });
    }

    if (empData && empData.length > 0) {
      userPrompt += `\n\nCONTEXTO - Colaboradores atuais em cargos similares (calibre requisitos de acordo):\n`;
      empData.forEach((e: any) => {
        userPrompt += `- ${e.cargo}: ${e.grau_escolaridade || "N/I"}, ${e.formacao_academica || "N/I"}\n`;
      });
    }

    if (salaryContext) {
      userPrompt += `\n\nCONTEXTO SALARIAL:\n${salaryContext}`;
    }

    userPrompt += `\n\nRetorne APENAS o JSON, sem markdown, sem code blocks, sem texto adicional.`;

    // ── Call Lovable AI ──
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle code blocks)
    let parsed;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      // Try to extract JSON from the response
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("A IA não retornou um JSON válido. Tente novamente.");
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: parsed,
      context: {
        descricoes_similares: descricoesSimilares.length,
        colaboradores_encontrados: empData?.length || 0,
        salario_context: salaryContext || null,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-job-description error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
