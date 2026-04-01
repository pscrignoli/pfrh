import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPREGARE_BASE_URL = "https://corporate.empregare.com";
const PF_COMPANY_ID = "79d39d5d-7012-4e76-9b8c-f7457242aa03";
const BIO_COMPANY_ID = "7b550b60-c18b-4491-a7d5-8eebcf1f210e";
const IGNORAR_SETORES = [38553, 47993, 48619];
const SETORES_BIO = [48843, 48844, 48845];

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getSetting(key: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb.from("rh_system_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function logIntegration(endpoint: string, reqPayload: unknown, resPayload: unknown, status: "success" | "error", errorMessage?: string) {
  const sb = getServiceClient();
  await sb.from("rh_integration_logs").insert({
    direction: "outbound",
    source: "empregare-sync",
    endpoint,
    request_payload: reqPayload as any,
    response_payload: typeof resPayload === "object" ? resPayload as any : { raw: String(resPayload).slice(0, 2000) },
    status,
    error_message: errorMessage ?? null,
  });
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

    const { data: existing } = await sb.from("rh_departments").select("id, name").eq("empregare_setor_id", setorId).maybeSingle();
    if (existing) {
      if (existing.name !== nome) await sb.from("rh_departments").update({ name: nome } as any).eq("id", existing.id);
    } else {
      await sb.from("rh_departments").insert({ name: nome, company_id: companyId, empregare_setor_id: setorId, status: "active" } as any);
    }
    synced++;
  }
  return { synced };
}

// ── Helper: extract extra fields from listarBI item ──
function extractExtraFields(v: any) {
  const etapas = v.vagaEtapa ?? v.etapas ?? v.Etapas ?? [];
  
  // Total candidaturas from "Todos" etapa
  let totalCandidaturas = 0;
  for (const e of etapas) {
    const nome = (e.nome ?? e.Nome ?? "").toLowerCase();
    if (nome === "todos" || nome === "all") {
      totalCandidaturas = Number(e.qntde ?? e.Qntde ?? e.qtd ?? 0) || 0;
    }
  }
  
  const totalContratados = Number(v.totalContratado ?? v.TotalContratado ?? 0) || 0;
  
  // Setor info
  const setorArr = Array.isArray(v.setor) ? v.setor : (v.setor ? [v.setor] : []);
  const firstSetor = setorArr[0] ?? {};
  const filialObj = firstSetor.filial ?? {};
  
  // Parse meta_encerramento to date
  let metaEncerramentoData = null;
  const meta = v.metaEncerramento ?? v.MetaEncerramento ?? null;
  if (meta) {
    try {
      const d = new Date(meta);
      if (!isNaN(d.getTime())) metaEncerramentoData = d.toISOString().split("T")[0];
    } catch {}
  }
  
  // Dias andamento
  let diasAndamento = 0;
  const dataCadastro = v.dataCadastro ?? v.DataCadastro ?? null;
  if (dataCadastro) {
    try {
      const d = new Date(dataCadastro);
      diasAndamento = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    } catch {}
  }

  return {
    total_candidaturas: totalCandidaturas,
    total_contratados: totalContratados,
    total_em_andamento: Math.max(0, totalCandidaturas - totalContratados),
    total_reprovados: 0,
    total_cancelados: 0,
    dias_andamento: diasAndamento,
    dias_congelados: 0,
    meta_encerramento_data: metaEncerramentoData,
    meta_encerramento_texto: meta ? String(meta).slice(0, 100) : null,
    motivo_abertura: v.motivoAberturaDescricao ?? v.MotivoAberturaDescricao ?? v.motivoAbertura ?? v.MotivoAbertura ?? null,
    motivo_cancelamento: v.motivoCancelamento ?? v.MotivoCancelamento ?? null,
    nivel_hierarquico: v.nivelHierarquico ?? v.NivelHierarquico ?? null,
    regime_contratacao: v.regimeContratacao ?? v.RegimeContratacao ?? v.tipoContrato ?? v.TipoContrato ?? null,
    pcd: v.pcd ?? v.PCD ?? v.Pcd ?? false,
    vaga_confidencial: v.vagaConfidencial ?? v.VagaConfidencial ?? false,
    selecao_oculta: v.selecaoOculta ?? v.SelecaoOculta ?? false,
    modalidade_trabalho: v.trabalhoRemoto ?? v.TrabalhoRemoto ?? v.modalidadeTrabalho ?? null,
    data_encerramento: v.dataEncerramento ?? v.DataEncerramento ?? null,
    data_cancelamento: v.dataCancelamento ?? v.DataCancelamento ?? null,
    data_congelamento: v.dataCongelamento ?? v.DataCongelamento ?? null,
    codigo_requisicao: v.requisicaoID ?? v.RequisicaoID ?? null,
    setor: firstSetor.titulo ?? firstSetor.Titulo ?? firstSetor.nome ?? firstSetor.Nome ?? null,
    filial: filialObj.titulo ?? filialObj.Titulo ?? filialObj.nome ?? filialObj.Nome ?? null,
    unidade_negocio: v.unidadeNegocio ?? v.UnidadeNegocio ?? null,
  };
}

// ── Helper: build vaga record from listarBI item ──
function buildVagaRecord(v: any, filialToCompany: Record<number, string>, setorToDept: Record<number, string>) {
  const empId = v.ID ?? v.id;
  if (!empId) return null;

  const setorArr = Array.isArray(v.setor) ? v.setor : (v.setor ? [v.setor] : []);
  const firstSetor = setorArr[0] ?? {};
  const filialId = firstSetor.filial?.id ?? firstSetor.filialID ?? firstSetor.FilialID;
  const setorId = firstSetor.id ?? firstSetor.setorID ?? firstSetor.SetorID;
  const companyId = filialId ? (filialToCompany[filialId] ?? PF_COMPANY_ID) : PF_COMPANY_ID;
  const departmentId = setorId ? (setorToDept[setorId] ?? null) : null;

  const cidades = v.vagaCidade ?? v.cidades ?? v.Cidades ?? [];
  const firstCity = cidades[0] ?? {};
  const etapas = v.vagaEtapa ?? v.etapas ?? v.Etapas ?? [];
  const responsaveis = v.vagaGestor ?? v.vagaRequisitante ?? v.responsaveis ?? v.Responsaveis ?? [];

  const situacao = v.status ?? v.situacao ?? v.Situacao ?? null;

  const extra = extractExtraFields(v);

  return {
    empregare_id: empId,
    company_id: companyId,
    department_id: departmentId,
    titulo: v.titulo ?? v.Titulo ?? "",
    descricao: v.descricao ?? v.Descricao ?? null,
    requisitos: v.requisito ?? v.Requisito ?? null,
    situacao,
    tipo_recrutamento: v.tipoRecrutamento ?? v.TipoRecrutamento ?? null,
    trabalho_remoto: v.trabalhoRemoto ?? v.TrabalhoRemoto ?? null,
    salario_min: v.salarioInicial ?? v.salario?.salarioInicial ?? null,
    salario_max: v.salarioFinal ?? v.salario?.salarioFinal ?? null,
    salario_combinar: v.salarioCombinar ?? v.salario?.salarioCombinar ?? false,
    total_vagas: (() => {
      const cidades = v.vagaCidade ?? v.VagaCidade ?? [];
      if (Array.isArray(cidades) && cidades.length > 0) {
        const total = cidades.reduce((sum: number, c: any) => sum + (Number(c.nVaga ?? c.NVaga ?? 0) || 0), 0);
        if (total > 0) return total;
      }
      return Number(v.nVaga ?? v.totalVagas ?? v.TotalVagas ?? 1) || 1;
    })(),
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
    ...extra,
  };
}

// ── Fetch maps ──
async function fetchMaps() {
  const sb = getServiceClient();
  const { data: companyMap } = await sb.from("rh_empregare_company_map").select("*");
  const filialToCompany: Record<number, string> = {};
  for (const m of (companyMap || [])) filialToCompany[(m as any).empregare_filial_id] = (m as any).company_id;

  const { data: deptMap } = await sb.from("rh_departments").select("id, empregare_setor_id").not("empregare_setor_id", "is", null);
  const setorToDept: Record<number, string> = {};
  for (const d of (deptMap || [])) if ((d as any).empregare_setor_id) setorToDept[(d as any).empregare_setor_id] = d.id;

  return { filialToCompany, setorToDept };
}

// ── SYNC VAGAS: paginate ALL pages, optionally filtered ──
async function syncVagasPages(bearer: string, format: string, empresaId: string, filtroSituacao?: string): Promise<{ total: number; pages: number }> {
  const sb = getServiceClient();
  const { filialToCompany, setorToDept } = await fetchMaps();

  let page = 1;
  let totalPages = 1;
  let totalVagas = 0;

  while (page <= totalPages) {
    let url = `/api/vaga/listarBI?pagina=${page}&quantidade=50`;
    if (filtroSituacao) url += `&situacao=${filtroSituacao}`;

    const data = await empregareGet(url, bearer, format, empresaId);
    await logIntegration(url, {}, { totalRegistros: data?.totalRegistros, pagAtual: data?.pagAtual, totalPag: data?.totalPag ?? data?.totalPaginas }, "success");

    totalPages = data?.totalPag ?? data?.totalPaginas ?? data?.TotalPag ?? 1;
    const vagas = data?.vagas ?? data?.Vagas ?? [];

    for (const v of vagas) {
      const record = buildVagaRecord(v, filialToCompany, setorToDept);
      if (!record) continue;

      const { error } = await sb.from("rh_empregare_vagas").upsert(record as any, { onConflict: "empregare_id" });
      if (error) await logIntegration("upsert empregare_vagas", { empregare_id: record.empregare_id }, { error: error.message }, "error", error.message);
      totalVagas++;
    }

    page++;
    if (page <= totalPages) await delay(200);
  }

  return { total: totalVagas, pages: totalPages };
}

// ── ENRICH OPEN VACANCIES: fetch /api/vaga/detalhes/{id} for etapa counts ──
async function enrichOpenVacancies(bearer: string, format: string, empresaId: string): Promise<{ enriched: number }> {
  const sb = getServiceClient();

  const { data: openVagas } = await sb.from("rh_empregare_vagas").select("empregare_id, requisicao_id, company_id").eq("situacao", "Aberta");
  let enriched = 0;

  for (const vaga of (openVagas || [])) {
    const vagaId = (vaga as any).empregare_id;
    try {
      const detalhes = await empregareGet(`/api/vaga/detalhes/${vagaId}`, bearer, format, empresaId);
      await delay(200);

      const vagaData = detalhes?.vaga ?? detalhes?.Vaga ?? detalhes;
      const etapas = vagaData?.etapas ?? vagaData?.Etapas ?? vagaData?.vagaEtapa ?? [];

      if (etapas.length > 0) {
        await sb.from("rh_empregare_vagas").update({
          etapas: JSON.stringify(etapas),
          data_sync: new Date().toISOString(),
        } as any).eq("empregare_id", vagaId);
      }
      enriched++;
    } catch (e) {
      await logIntegration(`/api/vaga/detalhes/${vagaId}`, {}, { error: e.message }, "error", e.message);
    }
  }

  return { enriched };
}

// ── SYNC CANDIDATOS (contratados via requisicao) ──
async function syncCandidatos(bearer: string, format: string, empresaId: string): Promise<{ synced: number }> {
  const sb = getServiceClient();
  const { data: vagas } = await sb.from("rh_empregare_vagas").select("empregare_id, requisicao_id, company_id").not("requisicao_id", "is", null).eq("situacao", "Aberta");
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

          await sb.from("rh_empregare_candidatos").upsert(record as any, { onConflict: "empregare_pessoa_id,empregare_vaga_id" });

          const etapasVaga = await sb.from("rh_empregare_vagas").select("etapas").eq("empregare_id", (vaga as any).empregare_id).maybeSingle();
          const etapasArr = etapasVaga?.data?.etapas ? (typeof etapasVaga.data.etapas === "string" ? JSON.parse(etapasVaga.data.etapas as string) : etapasVaga.data.etapas) : [];
          const contratadoEtapa = etapasArr.find((e: any) => (e.nome ?? e.Nome ?? "").toLowerCase().includes("contratad"));
          const etapaNome = contratadoEtapa?.nome ?? contratadoEtapa?.Nome ?? "Contratados";
          const etapaOrdem = contratadoEtapa?.ordem ?? contratadoEtapa?.Ordem ?? 99;

          const { data: existingCard } = await sb.from("rh_empregare_kanban_cards")
            .select("id")
            .eq("empregare_vaga_id", (vaga as any).empregare_id)
            .eq("empregare_pessoa_id", pessoaId)
            .maybeSingle();

          if (!existingCard) {
            await sb.from("rh_empregare_kanban_cards").insert({
              empregare_vaga_id: (vaga as any).empregare_id,
              empregare_pessoa_id: pessoaId,
              company_id: (vaga as any).company_id,
              nome: record.nome,
              email: record.email,
              telefone: record.telefone,
              etapa_atual: etapaNome,
              etapa_ordem: etapaOrdem,
              origem: "api",
              data_entrada_etapa: record.data_contratacao ?? new Date().toISOString(),
            } as any);
          }

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

    const bearer = await getSetting("empregare_bearer");
    const format = await getSetting("empregare_auth_format");
    const empresaId = await getSetting("empregare_empresa_id") ?? "";
    if (!bearer || !format) {
      return new Response(JSON.stringify({ error: "Empregare não configurado. Teste a conexão primeiro." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { step } = body;

    const results: Record<string, any> = {};

    if (step === "departments" || step === "all") {
      results.departments = await syncDepartments(bearer, format, empresaId);
    }

    if (step === "vagas" || step === "all") {
      results.vagasAbertas = await syncVagasPages(bearer, format, empresaId, "Aberta");
      results.vagasHistorico = await syncVagasPages(bearer, format, empresaId);
      results.enriched = await enrichOpenVacancies(bearer, format, empresaId);
    }

    if (step === "candidatos" || step === "all") {
      results.candidatos = await syncCandidatos(bearer, format, empresaId);
    }

    const sb = getServiceClient();
    await sb.from("rh_system_settings").upsert(
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
