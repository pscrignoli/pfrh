import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREGARE_BASE_URL = "https://corporate.empregare.com";

// ── Supabase helpers ──

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getSetting(key: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("rh_system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const sb = getServiceClient();
  await sb
    .from("rh_system_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

async function logIntegration(
  endpoint: string,
  reqPayload: unknown,
  resPayload: unknown,
  status: "success" | "error",
  errorMessage?: string
) {
  const sb = getServiceClient();
  await sb.from("rh_integration_logs").insert({
    company_id: null,
    direction: "outbound",
    source: "empregare",
    endpoint,
    request_payload: reqPayload as any,
    response_payload: resPayload as any,
    status,
    error_message: errorMessage ?? null,
  }).then(() => {});
}

// ── Auth discovery ──

interface AuthResult {
  bearer: string;
  format: string;
}

/** Try to parse a bearer token from a JSON response */
function extractToken(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  return data.token || data.Token || data.bearer || data.Bearer ||
    data.access_token || data.AccessToken || data.accessToken || null;
}

/** Check if a response is valid JSON (not HTML error page) */
function isValidJsonResponse(text: string): boolean {
  if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) return false;
  try { JSON.parse(text); return true; } catch { return false; }
}

/** Try all auth formats and return the first that works */
async function discoverAuth(apiToken: string, empresaId: string): Promise<AuthResult> {
  const authUrl = `${EMPREGARE_BASE_URL}/api/auth/token`;

  // ── Phase 1: Try POST /api/auth/token with different body formats ──

  const bodyAttempts: { format: string; body?: string; headers: Record<string, string> }[] = [
    {
      format: "body_token_empresaId",
      body: JSON.stringify({ token: apiToken, empresaId }),
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    },
    {
      format: "body_apiKey_empresaId",
      body: JSON.stringify({ apiKey: apiToken, empresaId }),
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    },
    {
      format: "header_bearer_empresaId",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
        "EmpresaId": empresaId,
      },
    },
  ];

  for (const attempt of bodyAttempts) {
    try {
      const res = await fetch(authUrl, {
        method: "POST",
        headers: attempt.headers,
        ...(attempt.body ? { body: attempt.body } : {}),
      });
      const text = await res.text();

      await logIntegration("/api/auth/token", { format: attempt.format }, { status: res.status, body: text.slice(0, 500) }, res.ok ? "success" : "error", res.ok ? undefined : `HTTP ${res.status}`);

      if (res.ok && isValidJsonResponse(text)) {
        const data = JSON.parse(text);
        const bearer = extractToken(data);
        if (bearer) {
          return { bearer, format: attempt.format };
        }
      }
    } catch (e) {
      await logIntegration("/api/auth/token", { format: attempt.format }, { error: e.message }, "error", e.message);
    }
  }

  // ── Phase 2: Try calling /api/vaga/listar directly with different header formats ──

  const directAttempts: { format: string; headers: Record<string, string> }[] = [
    {
      format: "direct_bearer",
      headers: { "Accept": "application/json", "Authorization": `Bearer ${apiToken}`, "EmpresaId": empresaId },
    },
    {
      format: "direct_no_prefix",
      headers: { "Accept": "application/json", "Authorization": apiToken, "EmpresaId": empresaId },
    },
    {
      format: "direct_xapikey",
      headers: { "Accept": "application/json", "X-Api-Key": apiToken, "EmpresaId": empresaId },
    },
    {
      format: "direct_token_header",
      headers: { "Accept": "application/json", "Token": apiToken, "EmpresaId": empresaId },
    },
  ];

  const testUrl = `${EMPREGARE_BASE_URL}/api/vaga/listar`;

  for (const attempt of directAttempts) {
    try {
      const res = await fetch(testUrl, { method: "GET", headers: attempt.headers });
      const text = await res.text();

      await logIntegration("/api/vaga/listar (auth test)", { format: attempt.format }, { status: res.status, body: text.slice(0, 500) }, res.ok ? "success" : "error", res.ok ? undefined : `HTTP ${res.status}`);

      if (res.ok && isValidJsonResponse(text)) {
        // This format works — token is used directly (no bearer exchange needed)
        return { bearer: apiToken, format: attempt.format };
      }
    } catch (e) {
      await logIntegration("/api/vaga/listar (auth test)", { format: attempt.format }, { error: e.message }, "error", e.message);
    }
  }

  throw new Error("Nenhum formato de autenticação funcionou. Verifique token e EmpresaID.");
}

/** Build headers for a request using the discovered auth format */
function buildHeaders(format: string, bearer: string, empresaId: string): Record<string, string> {
  const base: Record<string, string> = { "Accept": "application/json", "Content-Type": "application/json" };

  if (format.startsWith("direct_")) {
    if (format === "direct_bearer") {
      base["Authorization"] = `Bearer ${bearer}`;
    } else if (format === "direct_no_prefix") {
      base["Authorization"] = bearer;
    } else if (format === "direct_xapikey") {
      base["X-Api-Key"] = bearer;
    } else if (format === "direct_token_header") {
      base["Token"] = bearer;
    }
    base["EmpresaId"] = empresaId;
  } else {
    // Bearer token from auth endpoint
    base["Authorization"] = `Bearer ${bearer}`;
    base["EmpresaId"] = empresaId;
  }

  return base;
}

/** Get or discover auth credentials */
async function getAuth(forceRediscover = false): Promise<{ bearer: string; format: string }> {
  const apiToken = await getSetting("empregare_api_token");
  const empresaId = await getSetting("empregare_empresa_id") ?? "";

  if (!apiToken) {
    throw new Error("Token da API Empregare não configurado.");
  }

  if (!forceRediscover) {
    const savedFormat = await getSetting("empregare_auth_format");
    const savedBearer = await getSetting("empregare_bearer");
    if (savedFormat && savedBearer) {
      return { bearer: savedBearer, format: savedFormat };
    }
  }

  const result = await discoverAuth(apiToken, empresaId);
  await setSetting("empregare_bearer", result.bearer);
  await setSetting("empregare_auth_format", result.format);
  return result;
}

/** Make a proxied request to the Empregare API */
async function empregareRequest(
  endpoint: string,
  method: string,
  payload?: unknown
): Promise<{ status: number; data: unknown }> {
  const empresaId = await getSetting("empregare_empresa_id") ?? "";
  let auth = await getAuth();

  const targetUrl = `${EMPREGARE_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const doFetch = async (bearer: string, format: string) => {
    const headers = buildHeaders(format, bearer, empresaId);
    const opts: RequestInit = { method, headers };
    if (method !== "GET" && payload) {
      opts.body = typeof payload === "string" ? payload : JSON.stringify(payload);
    }
    return fetch(targetUrl, opts);
  };

  let res = await doFetch(auth.bearer, auth.format);

  // Auto-retry: if 401, rediscover auth
  if (res.status === 401) {
    await res.text(); // consume
    auth = await getAuth(true);
    res = await doFetch(auth.bearer, auth.format);
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 2000) };
  }

  await logIntegration(endpoint, { method, ...(payload ? { payload } : {}) }, data, res.ok ? "success" : "error", res.ok ? undefined : `HTTP ${res.status}`).catch(() => {});

  return { status: res.status, data };
}

// ── Main handler ──

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { method, endpoint, payload, action } = body;

    // ── Action: test_connection ──
    if (action === "test_connection") {
      const { api_token, empresa_id } = body;
      if (!api_token) {
        return new Response(
          JSON.stringify({ error: "api_token é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save credentials first
      await setSetting("empregare_api_token", api_token);
      if (empresa_id) await setSetting("empregare_empresa_id", empresa_id);

      // Clear cached auth to force rediscovery
      await setSetting("empregare_bearer", "");
      await setSetting("empregare_auth_format", "");

      try {
        const auth = await getAuth(true);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Autenticação bem-sucedida! Formato: ${auth.format}`,
            format: auth.format,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Normal proxy ──
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
    console.error("empregare-proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno no proxy de integração." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
