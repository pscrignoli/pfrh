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

    // Verify caller
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

    // Check caller role
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

    const { email, full_name, role_name, company_id } = await req.json();

    if (!email || !full_name || !role_name) {
      return new Response(JSON.stringify({ error: "Email, nome e role são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin cannot invite super_admin
    if (role_name === "super_admin" && callerRole !== "super_admin") {
      return new Response(JSON.stringify({ error: "Apenas SuperAdmin pode convidar SuperAdmins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email already exists and has confirmed (active user)
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existing = existingUsers?.find((u: any) => u.email === email);
    
    // If user exists AND has confirmed their email, they are an active user - block
    if (existing && existing.email_confirmed_at) {
      return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado e ativo no sistema" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get role UUID
    const { data: roleData } = await adminClient
      .from("role_definitions")
      .select("id")
      .eq("name", role_name)
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Role não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine site URL for redirect
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || supabaseUrl;
    const siteUrl = origin.replace(/\/+$/, "");

    // Generate invite link (no email sent by Supabase)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: email,
      options: {
        data: { full_name, role: role_name, company_id, invited_by: caller.id },
        redirectTo: `${siteUrl}/set-password`,
      },
    });

    if (linkError) {
      console.error("invite-user generateLink error:", linkError);
      return new Response(JSON.stringify({ error: "Erro ao gerar convite. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteLink = linkData?.properties?.action_link;
    const newUserId = linkData?.user?.id;

    // Upsert invite record (update if same email exists with pending status)
    const { data: existingInvite } = await adminClient
      .from("user_invites")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    let inviteId: string | null = null;

    if (existingInvite) {
      // Update existing pending invite with new link
      const { data: updated } = await adminClient
        .from("user_invites")
        .update({
          invite_link: inviteLink,
          full_name,
          role_id: roleData.id,
          company_id: company_id || null,
          user_id: newUserId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", existingInvite.id)
        .select("id")
        .single();
      inviteId = updated?.id || existingInvite.id;
    } else {
      // Create new invite record
      const { data: inviteRecord } = await adminClient.from("user_invites").insert({
        email,
        full_name,
        role_id: roleData.id,
        company_id: company_id || null,
        invited_by: caller.id,
        user_id: newUserId,
        status: "pending",
        invite_link: inviteLink,
      }).select("id").single();
      inviteId = inviteRecord?.id;
    }

    // Pre-create user_profiles
    if (newUserId) {
      await adminClient.from("user_profiles").upsert({
        user_id: newUserId,
        full_name,
        role_id: roleData.id,
        company_id: company_id || null,
        is_active: true,
      }, { onConflict: "user_id" });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUserId,
      invite_id: inviteId,
      invite_link: inviteLink,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("invite-user error:", e);
    return new Response(JSON.stringify({ error: "Erro interno ao processar convite." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
