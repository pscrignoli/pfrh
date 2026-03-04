import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREGARE_BASE_URL = "https://corporate.empregare.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — verify Supabase user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read Empregare token from secure env
    const empregareToken = Deno.env.get("EMPREGARE_API_TOKEN");
    if (!empregareToken) {
      return new Response(
        JSON.stringify({ error: "EMPREGARE_API_TOKEN não configurado no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { method, endpoint, payload } = body;

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Endpoint é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const httpMethod = (method || "GET").toUpperCase();
    const targetUrl = `${EMPREGARE_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const empresaId = Deno.env.get("EMPREGARE_EMPRESA_ID");

    const fetchOptions: RequestInit = {
      method: httpMethod,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${empregareToken}`,
        ...(empresaId ? { "EmpresaId": empresaId } : {}),
      },
    };

    if (httpMethod !== "GET" && payload) {
      fetchOptions.body = typeof payload === "string" ? payload : JSON.stringify(payload);
    }

    const apiRes = await fetch(targetUrl, fetchOptions);
    const apiText = await apiRes.text();

    let apiData;
    try {
      apiData = JSON.parse(apiText);
    } catch {
      apiData = { raw: apiText };
    }

    return new Response(
      JSON.stringify({ status: apiRes.status, data: apiData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
