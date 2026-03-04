import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREGARE_BASE_URL = "https://api.empregare.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, method, endpoint, payload, credentials } = body;

    // Action: authenticate – get token from Empregare
    if (action === "authenticate") {
      const { username, password } = credentials || {};
      if (!username || !password) {
        return new Response(
          JSON.stringify({ error: "Credenciais são obrigatórias" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authRes = await fetch(`${EMPREGARE_BASE_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const authData = await authRes.text();
      let parsed;
      try {
        parsed = JSON.parse(authData);
      } catch {
        parsed = { raw: authData };
      }

      return new Response(
        JSON.stringify({ status: authRes.status, data: parsed }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Action: proxy – forward request to Empregare API
    if (action === "proxy") {
      const { empregareToken } = body;
      if (!empregareToken) {
        return new Response(
          JSON.stringify({ error: "Token Empregare não fornecido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const httpMethod = (method || "GET").toUpperCase();
      const targetUrl = `${EMPREGARE_BASE_URL}${endpoint}`;

      const fetchOptions: RequestInit = {
        method: httpMethod,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${empregareToken}`,
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
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida. Use 'authenticate' ou 'proxy'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
