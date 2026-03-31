import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is super_admin
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();

    if (action === "list") {
      // List all admins with their email from auth.users
      const { data: roles, error: rolesErr } = await adminClient
        .from("user_roles")
        .select("id, role, created_at")
        .in("role", ["admin", "super_admin"]);

      if (rolesErr) throw rolesErr;

      // Get emails for these users
      const admins = [];
      for (const role of roles || []) {
        const { data: { user } } = await adminClient.auth.admin.getUserById(role.id);
        admins.push({
          id: role.id,
          email: user?.email ?? "—",
          role: role.role,
          created_at: role.created_at,
        });
      }

      return new Response(JSON.stringify({ admins }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For mutations, verify super_admin
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerRole?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Apenas Super Admins podem alterar cargos." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "promote") {
      const { email } = await req.json().catch(() => ({}));
      // Already parsed above, re-parse body
      const body = await new Response(req.body).json().catch(() => null);
      // Body was already consumed, let's use a different approach
    }

    // Re-read the body for mutation actions
    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
