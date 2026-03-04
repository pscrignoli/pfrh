import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREGARE_BASE_URL = "https://corporate.empregare.com";

/** Build a service-role Supabase client for reading system_settings */
function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** Read a system_settings value by key */
async function getSetting(key: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

/** Write a system_settings value */
async function setSetting(key: string, value: string): Promise<void> {
  const sb = getServiceClient();
  await sb
    .from("system_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

/** Log to integration_logs */
async function logIntegration(
  companyId: string | null,
  endpoint: string,
  reqPayload: unknown,
  resPayload: unknown,
  status: "success" | "error",
  errorMessage?: string
) {
  const sb = getServiceClient();
  await sb.from("integration_logs").insert({
    company_id: companyId,
    direction: "outbound",
    source: "empregare",
    endpoint,
    request_payload: reqPayload as any,
    response_payload: resPayload as any,
    status,
    error_message: errorMessage ?? null,
  });
}

/** Authenticate with Empregare and get a fresh bearer token */
async function authenticateEmpregare(apiToken: string): Promise<string> {
  const res = await fetch(`${EMPREGARE_BASE_URL}/api/auth/token`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  // The API may return the token in different fields; try common ones
  const bearer = data?.token || data?.access_token || data?.Token || data?.AccessToken;
  if (!bearer) {
    throw new Error(`Auth response did not contain a token: ${JSON.stringify(data)}`);
  }
  return bearer;
}

/** Get (or refresh) the bearer token */
async function getBearerToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = await getSetting("empregare_bearer");
    if (cached) return cached;
  }

  const apiToken = await getSetting("empregare_api_token");
  if (!apiToken) {
    throw new Error("Token da API Empregare não configurado. Vá em Configurações > Empregare.");
  }

  const bearer = await authenticateEmpregare(apiToken);
  await setSetting("empregare_bearer", bearer);
  return bearer;
}

/** Make a request to Empregare API with auto-retry on 401 */
async function empregareRequest(
  endpoint: string,
  method: string,
  payload?: unknown
): Promise<{ status: number; data: unknown }> {
  const empresaId = Deno.env.get("EMPREGARE_EMPRESA_ID") ?? (await getSetting("empregare_empresa_id"));

  let bearer = await getBearerToken();
  const targetUrl = `${EMPREGARE_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const doFetch = async (token: string) => {
    const opts: RequestInit = {
      method,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(empresaId ? { "EmpresaId": empresaId } : {}),
      },
    };
    if (method !== "GET" && payload) {
      opts.body = typeof payload === "string" ? payload : JSON.stringify(payload);
    }
    return fetch(targetUrl, opts);
  };

  let res = await doFetch(bearer);

  // Auto-retry on 401 (token expired)
  if (res.status === 401) {
    await res.text(); // consume body
    bearer = await getBearerToken(true);
    res = await doFetch(bearer);
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  // Log the call
  await logIntegration(
    null,
    endpoint,
    { method, ...(payload ? { payload } : {}) },
    data,
    res.ok ? "success" : "error",
    res.ok ? undefined : `HTTP ${res.status}`
  ).catch(() => {}); // non-blocking

  return { status: res.status, data };
}

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

    const body = await req.json();
    const { method, endpoint, payload, action } = body;

    // Special action: authenticate (test connection)
    if (action === "test_connection") {
      const apiToken = body.api_token;
      if (!apiToken) {
        return new Response(
          JSON.stringify({ error: "api_token é obrigatório para test_connection." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      try {
        const bearer = await authenticateEmpregare(apiToken);
        // Save both tokens
        await setSetting("empregare_api_token", apiToken);
        await setSetting("empregare_bearer", bearer);
        return new Response(
          JSON.stringify({ success: true, message: "Autenticação bem-sucedida." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Normal proxy request
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Endpoint é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const httpMethod = (method || "GET").toUpperCase();
    const result = await empregareRequest(endpoint, httpMethod, payload);

    return new Response(
      JSON.stringify({ status: result.status, data: result.data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
