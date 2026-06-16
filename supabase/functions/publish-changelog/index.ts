import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
// A1: CORS restrito ao APP_ORIGIN
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!roleData || !["admin", "super_admin"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json();
    const { version, title, description, type, release_date } = body;

    if (!version || !title || !description) {
      return new Response(JSON.stringify({ error: "version, title e description são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Insert the changelog
    const { data: changelog, error: insertError } = await adminClient
      .from("changelogs")
      .insert({
        version,
        title,
        description,
        type: type || "feature",
        release_date: release_date || new Date().toISOString().split("T")[0],
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get all unique user IDs to notify
    const { data: users, error: usersError } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });

    if (usersError) {
      console.error("Error listing users:", usersError);
      // Changelog was created successfully, just skip notifications
      return new Response(JSON.stringify({ changelog, notified: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = (users?.users ?? []).map((u: any) => u.id);

    // 3. Batch insert notifications (chunks of 500)
    const BATCH_SIZE = 500;
    let totalNotified = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE).map((uid: string) => ({
        user_id: uid,
        type: "changelog",
        title: `Nova versão: ${version}`,
        message: title,
        scheduled_for: now,
        action_url: "/changelog",
        is_read: false,
      }));

      const { error: notifError } = await adminClient.from("notifications").insert(batch);
      if (notifError) {
        console.error(`Batch insert error (offset ${i}):`, notifError.message);
      } else {
        totalNotified += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ changelog, notified: totalNotified }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("publish-changelog error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
