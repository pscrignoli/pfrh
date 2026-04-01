import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller's token
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check new role system first (user_profiles + role_definitions)
    const { data: callerProfile } = await adminClient
      .from("rh_user_profiles")
      .select("role_id, rh_role_definitions(name)")
      .eq("user_id", caller.id)
      .maybeSingle();

    const callerRole = (callerProfile as any)?.role_definitions?.name;
    let isAdmin = ["super_admin", "admin"].includes(callerRole);

    // Fallback to old user_roles table
    if (!isAdmin) {
      const { data: oldRoles } = await adminClient
        .from("rh_user_roles")
        .select("role")
        .eq("user_id", caller.id);
      const oldRoleNames = (oldRoles ?? []).map((r: any) => r.role);
      isAdmin = oldRoleNames.includes("admin_rh") || oldRoleNames.includes("super_admin");
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all auth users
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    // Fetch all old roles (backward compat)
    const { data: allOldRoles } = await adminClient.from("rh_user_roles").select("*");

    // Build response
    const result = users.map((u: any) => ({
      id: u.id,
      email: u.email ?? "",
      name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? "",
      created_at: u.created_at,
      roles: (allOldRoles ?? [])
        .filter((r: any) => r.user_id === u.id)
        .map((r: any) => ({ id: r.id, role: r.role })),
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("list-users error:", e);
    return new Response(JSON.stringify({ error: "Erro interno ao listar usuários." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
