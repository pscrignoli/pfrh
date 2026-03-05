import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREGARE_BASE_URL = "https://corporate.empregare.com";

const PF_COMPANY_ID = "79d39d5d-7012-4e76-9b8c-f7457242aa03";
const BIO_COMPANY_ID = "7b550b60-c18b-4491-a7d5-8eebcf1f210e";

// Setores a ignorar (são empresas, não departamentos)
const IGNORAR_SETORES = [38553, 47993, 48619];
// Setores Biocollagen
const SETORES_BIO = [48843, 48844, 48845];

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getSetting(key: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb.from("system_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function logIntegration(endpoint: string, reqPayload: unknown, resPayload: unknown, status: "success" | "error", errorMessage?: string) {
  const sb = getServiceClient();
  await sb.from("integration_logs").insert({
    direction: "outbound",
    source: "empregare-sync",
    endpoint,
    request_payload: reqPayload as any,
    response_payload: typeof resPayload === "object" ? resPayload as any : { raw: String(resPayload).slice(0, 2000) },
    status,
    error_message: errorMessage ?? null,
  }).then(() => {});
}

function buildHeaders(format: string, bearer: string, empresaId: string): Record<string, string> {
  const base: Record<string, string> = { "Accept": "application/json", "Content-Type": "application/json" };
  if (format.startsWith("direct_")) {
    if (format === "direct_bearer") base["Authorization"] = `Bearer ${bearer}`;
    else if (format === "direct_no_prefix") base["Authorization"] = bearer;
    else if (format === "direct_xapikey") base["X-Api-Key"] = bearer;
    else if (format === "direct_token_header") base["Token"] = bearer;
    base["EmpresaId"] = empresaId;
  } else {
    base["Authorization"] = `Bearer ${bearer}`;
    base["EmpresaId"] = empresaId;
  }
  return base;
}

async function empregareGet(endpoint: string, bearer: string, format: string, empresaId: string): Promise<any> {
  const url = `${EMPREGARE_BASE_URL}${endpoint}`;
  const headers = buildHeaders(format, bearer, empresaId);
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 2000) }; }
  if (!res.ok) {
    await logIntegration(endpoint, { method: "GET" }, data, "error", `HTTP ${res.status}`);
    throw new Error(`HTTP ${res.status} - ${endpoint}`);
  }
  return data;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── SYNC DEPARTMENTS ──
async function syncDepartments(bearer: string, format: string, empresaId: string): Promise<{ synced: number }> {
  const sb = getServiceClient();
  const data = await empregareGet("/api/setores/listar", bearer, format, empresaId);

  const setores = Array.isArray(data) ? data : (data?.dados ?? data?.Dados ?? data?.setores ?? data?.Setores ?? []);
  await logIntegration("/api/setores/listar", {}, { count: setores.length }, "success");
  let synced = 0;

  for (const setor of setores) {
    const setorId = setor.ID ?? setor.id ?? setor.SetorID ?? setor.setorID;
    const nome = setor.Titulo ?? setor.titulo ?? setor.Nome ?? setor.nome ?? "";
    if (!setorId || IGNORAR_SETORES.includes(setorId)) continue;

    const companyId = SETORES_BIO.includes(setorId) ? BIO_COMPANY_ID : PF_COMPANY_ID;

    // Check if exists
    const { data: existing } = await sb.from("departments").select("id, name").eq("empregare_setor_id", setorId).maybeSingle();
    if (existing) {
      if (existing.name !== nome) {
        await sb.from("departments").update({ name: nome } as any).eq("id", existing.id);
      }
    } else {
      await sb.from("departments").insert({
        name: nome,
        company_id: companyId,
        empregare_setor_id: setorId,
        status: "active",
      } as any);
    }
    synced++;
  }

  return { synced };
}

// ── SYNC VAGAS (using listarBI) ──
async function syncVagas(bearer: string, format: string, empresaId: string): Promise<{ total: number; pages: number }> {
  const sb = getServiceClient();

  // Fetch company map
  const { data: companyMap } = await sb.from("empregare_company_map").select("*");
  const filialToCompany: Record<number, string> = {};
  for (const m of (companyMap || [])) {
    filialToCompany[(m as any).empregare_filial_id] = (m as any).company_id;
  }

  // Fetch department map
  const { data: deptMap } = await sb.from("departments").select("id, empregare_setor_id").not("empregare_setor_id", "is", null);
  const setorToDept: Record<number, string> = {};
  for (const d of (deptMap || [])) {
    if ((d as any).empregare_setor_id) setorToDept[(d as any).empregare_setor_id] = d.id;
  }

  let page = 1;
  let totalPages = 1;
  let totalVagas = 0;

  while (page <= totalPages) {
    const data = await empregareGet(`/api/vaga/listarBI?pagina=${page}&quantidade=50`, bearer, format, empresaId);
    await logIntegration(`/api/vaga/listarBI?pagina=${page}`, {}, { totalRegistros: data?.totalRegistros, pagAtual: data?.pagAtual, totalPag: data?.totalPag }, "success");

    totalPages = data?.totalPag ?? data?.TotalPag ?? 1;
    const vagas = data?.vagas ?? data?.Vagas ?? [];

    for (const v of vagas) {
      const empId = v.ID ?? v.id;
      if (!empId) continue;

      // setor is an ARRAY in listarBI response
      const setorArr = Array.isArray(v.setor) ? v.setor : (v.setor ? [v.setor] : []);
      const firstSetor = setorArr[0] ?? {};
      const filialId = firstSetor.filial?.id ?? firstSetor.filialID ?? firstSetor.FilialID;
      const setorId = firstSetor.id ?? firstSetor.setorID ?? firstSetor.SetorID;
      const companyId = filialId ? (filialToCompany[filialId] ?? PF_COMPANY_ID) : PF_COMPANY_ID;
      const departmentId = setorId ? (setorToDept[setorId] ?? null) : null;

      // cidades = vagaCidade in listarBI
      const cidades = v.vagaCidade ?? v.cidades ?? v.Cidades ?? [];
      const firstCity = cidades[0] ?? {};

      // etapas = vagaEtapa in listarBI
      const etapas = v.vagaEtapa ?? v.etapas ?? v.Etapas ?? [];

      // responsaveis = vagaGestor in listarBI
      const responsaveis = v.vagaGestor ?? v.vagaRequisitante ?? v.responsaveis ?? v.Responsaveis ?? [];

      // salario fields are TOP-LEVEL in listarBI (not nested)
      const salarioMin = v.salarioInicial ?? v.salario?.salarioInicial ?? null;
      const salarioMax = v.salarioFinal ?? v.salario?.salarioFinal ?? null;
      const salarioCombinar = v.salarioCombinar ?? v.salario?.salarioCombinar ?? false;

      // situacao = "status" in listarBI
      const situacao = v.status ?? v.situacao ?? v.Situacao ?? null;

      const record = {
        empregare_id: empId,
        company_id: companyId,
        department_id: departmentId,
        titulo: v.titulo ?? v.Titulo ?? "",
        descricao: v.descricao ?? v.Descricao ?? null,
        requisitos: v.requisito ?? v.Requisito ?? null,
        situacao,
        tipo_recrutamento: v.tipoRecrutamento ?? v.TipoRecrutamento ?? null,
        trabalho_remoto: v.trabalhoRemoto ?? v.TrabalhoRemoto ?? null,
        salario_min: salarioMin,
        salario_max: salarioMax,
        salario_combinar: salarioCombinar,
        total_vagas: v.totalVagas ?? v.TotalVagas ?? 1,
        cidade: firstCity.cidadeNome ?? firstCity.CidadeNome ?? null,
        estado: firstCity.estadoNome ?? firstCity.EstadoNome ?? null,
        horario: v.horario ?? v.Horario ?? null,
        meta_encerramento: v.metaEncerramento ?? v.MetaEncerramento ?? null,
        requisicao_id: v.requisicaoID ?? v.RequisicaoID ?? null,
        beneficios: JSON.stringify(v.beneficios ?? v.Beneficios ?? []),
        etapas: JSON.stringify(etapas),
        responsaveis: JSON.stringify(responsaveis),
        data_cadastro: v.dataCadastro ?? v.DataCadastro ?? null,
        data_sync: new Date().toISOString(),
        raw_json: JSON.stringify(v),
      };

      // Upsert
      const { error } = await sb.from("empregare_vagas").upsert(record as any, { onConflict: "empregare_id" });
      if (error) {
        await logIntegration("upsert empregare_vagas", { empregare_id: empId }, { error: error.message }, "error", error.message);
      }
      totalVagas++;
    }

    page++;
    if (page <= totalPages) await delay(200);
  }

  return { total: totalVagas, pages: totalPages };
}

// ── SYNC CANDIDATOS (contratados via requisicao) ──
async function syncCandidatos(bearer: string, format: string, empresaId: string): Promise<{ synced: number }> {
  const sb = getServiceClient();

  // Get vagas with requisicao_id
  const { data: vagas } = await sb.from("empregare_vagas").select("empregare_id, requisicao_id, company_id").not("requisicao_id", "is", null);
  let synced = 0;

  for (const vaga of (vagas || [])) {
    const reqId = (vaga as any).requisicao_id;
    if (!reqId) continue;

    try {
      const reqData = await empregareGet(`/api/requisicao/detalhes/${reqId}`, bearer, format, empresaId);
      await delay(200);

      const requisicao = reqData?.requisicao ?? reqData?.Requisicao ?? reqData;
      const contratados = requisicao?.contratados ?? requisicao?.Contratados ?? [];

      for (const c of contratados) {
        const pessoaId = c.pessoaID ?? c.PessoaID;
        if (!pessoaId) continue;

        try {
          const pessoaData = await empregareGet(`/api/pessoa/detalhes/${pessoaId}`, bearer, format, empresaId);
          await delay(200);

          const pessoa = pessoaData?.pessoa ?? pessoaData?.Pessoa ?? pessoaData;
          const localidade = pessoa?.localidade ?? pessoa?.Localidade ?? {};
          const curriculo = pessoa?.curriculo ?? pessoa?.Curriculo ?? {};

          const record = {
            empregare_pessoa_id: pessoaId,
            empregare_vaga_id: (vaga as any).empregare_id,
            company_id: (vaga as any).company_id,
            nome: pessoa?.nome ?? pessoa?.Nome ?? c.nome ?? c.Nome ?? "",
            email: pessoa?.email ?? pessoa?.Email ?? null,
            telefone: pessoa?.celular ?? pessoa?.Celular ?? pessoa?.telefone ?? pessoa?.Telefone ?? null,
            cidade: localidade?.cidade ?? localidade?.Cidade ?? null,
            estado: localidade?.estado ?? localidade?.Estado ?? null,
            etapa_atual: "Contratado",
            status: "contratado",
            data_contratacao: c.dataContratacao ?? c.DataContratacao ?? null,
            curriculo_url: curriculo?.arquivoCurriculo ?? curriculo?.ArquivoCurriculo ?? null,
            curriculo_json: JSON.stringify(curriculo),
            marcadores: JSON.stringify(pessoa?.marcadores ?? pessoa?.Marcadores ?? []),
            data_sync: new Date().toISOString(),
          };

          await sb.from("empregare_candidatos").upsert(record as any, { onConflict: "empregare_pessoa_id,empregare_vaga_id" });
          synced++;
        } catch (e) {
          await logIntegration(`/api/pessoa/detalhes/${pessoaId}`, {}, { error: e.message }, "error", e.message);
        }
      }
    } catch (e) {
      await logIntegration(`/api/requisicao/detalhes/${reqId}`, {}, { error: e.message }, "error", e.message);
    }
  }

  return { synced };
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get auth credentials
    const bearer = await getSetting("empregare_bearer");
    const format = await getSetting("empregare_auth_format");
    const empresaId = await getSetting("empregare_empresa_id") ?? "";
    if (!bearer || !format) {
      return new Response(JSON.stringify({ error: "Empregare não configurado. Teste a conexão primeiro." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { step } = body; // "departments", "vagas", "candidatos", "all"

    const results: Record<string, any> = {};

    if (step === "departments" || step === "all") {
      results.departments = await syncDepartments(bearer, format, empresaId);
    }

    if (step === "vagas" || step === "all") {
      results.vagas = await syncVagas(bearer, format, empresaId);
    }

    if (step === "candidatos" || step === "all") {
      results.candidatos = await syncCandidatos(bearer, format, empresaId);
    }

    // Save last sync timestamp
    const sb = getServiceClient();
    await sb.from("system_settings").upsert(
      { key: "empregare_last_sync", value: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    await logIntegration("sync-empregare", { step }, results, "success");

    return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    await logIntegration("sync-empregare", {}, { error: err.message }, "error", err.message).catch(() => {});
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
