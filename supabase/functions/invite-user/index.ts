import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: callerProfile } = await adminClient
      .from("user_profiles")
      .select("role_id, role_definitions(name)")
      .eq("user_id", caller.id)
      .maybeSingle();

    const callerRole = (callerProfile as any)?.role_definitions?.name;
    if (!["super_admin", "admin"].includes(callerRole)) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body?.action;

    // Revoke invite through backend to avoid direct PATCH calls from frontend
    if (action === "revoke") {
      const inviteId = body?.invite_id;
      if (!inviteId) {
        return new Response(JSON.stringify({ error: "ID do convite é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: revokeError } = await adminClient
        .from("user_invites")
        .update({ status: "revoked" })
        .eq("id", inviteId)
        .in("status", ["pending", "expired"]);

      if (revokeError) {
        return new Response(JSON.stringify({ error: "Não foi possível revogar o convite" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    const full_name = String(body?.full_name ?? "").trim();
    const role_name = String(body?.role_name ?? "").trim();
    const company_id = body?.company_id ?? null;

    if (!email || !full_name || !role_name) {
      return new Response(JSON.stringify({ error: "Email, nome e perfil são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role_name === "super_admin" && callerRole !== "super_admin") {
      return new Response(JSON.stringify({ error: "Apenas SuperAdmin pode convidar SuperAdmins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existing = existingUsers?.find((u: any) => (u.email ?? "").toLowerCase() === email);

    if (existing?.email_confirmed_at) {
      return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado e ativo no sistema" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("role_definitions")
      .select("id")
      .eq("name", role_name)
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || supabaseUrl;
    const siteUrl = origin.replace(/\/+$/, "");

    let linkData: any = null;
    let linkError: any = null;

    // First attempt: invite link
    const inviteAttempt = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { full_name, role: role_name, company_id, invited_by: caller.id },
        redirectTo: `${siteUrl}/set-password`,
      },
    });

    linkData = inviteAttempt.data;
    linkError = inviteAttempt.error;

    // Fallback for pending/unconfirmed existing accounts
    if (linkError && existing && !existing.email_confirmed_at) {
      const recoveryAttempt = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          data: { full_name, role: role_name, company_id, invited_by: caller.id },
          redirectTo: `${siteUrl}/set-password`,
        },
      });
      linkData = recoveryAttempt.data;
      linkError = recoveryAttempt.error;
    }

    if (linkError) {
      console.error("invite-user generateLink error:", linkError);
      return new Response(JSON.stringify({ error: "Erro ao gerar convite. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteLink = linkData?.properties?.action_link;
    const newUserId = linkData?.user?.id ?? existing?.id ?? null;

    const { data: latestInvite } = await adminClient
      .from("user_invites")
      .select("id, status")
      .eq("email", email)
      .neq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let inviteId: string | null = null;

    if (latestInvite) {
      const { data: updated } = await adminClient
        .from("user_invites")
        .update({
          full_name,
          role_id: roleData.id,
          company_id: company_id || null,
          user_id: newUserId,
          status: "pending",
          invite_link: inviteLink,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", latestInvite.id)
        .select("id")
        .single();

      inviteId = updated?.id ?? latestInvite.id;
    } else {
      const { data: created } = await adminClient
        .from("user_invites")
        .insert({
          email,
          full_name,
          role_id: roleData.id,
          company_id: company_id || null,
          invited_by: caller.id,
          user_id: newUserId,
          status: "pending",
          invite_link: inviteLink,
        })
        .select("id")
        .single();

      inviteId = created?.id ?? null;
    }

    if (newUserId) {
      await adminClient
        .from("user_profiles")
        .upsert(
          {
            user_id: newUserId,
            full_name,
            role_id: roleData.id,
            company_id: company_id || null,
            is_active: true,
          },
          { onConflict: "user_id" },
        );
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUserId,
      invite_id: inviteId,
      invite_link: inviteLink,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-user error:", e);
    return new Response(JSON.stringify({ error: "Erro interno ao processar convite." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
