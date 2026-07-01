import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, identityId } = body;

    if (action !== "unlink") {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!identityId || typeof identityId !== "string") {
      return new Response(
        JSON.stringify({ error: "identityId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData } = await adminClient.auth.admin.getUserById(user.id);
    const userIdentities = userData?.user?.identities ?? [];

    // IDOR guard: só permite desvincular identidades que pertencem ao usuário autenticado.
    const identityBelongsToUser = userIdentities.some((i: { id: string }) => i.id === identityId);
    if (!identityBelongsToUser) {
      log("warn", "identity_unlink_idor_attempt", { userId: user.id, identityId });
      return new Response(
        JSON.stringify({ error: "Identidade não encontrada ou não pertence a este usuário" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guard: não permitir remover o último método de acesso.
    if (userIdentities.length <= 1) {
      return new Response(
        JSON.stringify({ error: "Não é possível remover o único método de login. Adicione uma senha primeiro." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usa RPC com SECURITY DEFINER em vez do endpoint REST admin do GoTrue,
    // pois DELETE /auth/v1/admin/users/{userId}/identities/{identityId}
    // não está disponível nesta versão do GoTrue (Lovable Cloud).
    const { error: deleteError } = await adminClient.rpc("admin_delete_identity", {
      p_user_id: user.id,
      p_identity_id: identityId,
    });

    if (deleteError) {
      log("error", "identity_unlink_failed", {
        userId: user.id,
        identityId,
        error: deleteError.message,
        code: deleteError.code,
      });
      const isNotFound = deleteError.message?.includes("identity_not_found");
      return new Response(
        JSON.stringify({
          error: isNotFound
            ? "Identidade não encontrada ou não pertence a este usuário."
            : "Não foi possível desvincular. Tente novamente.",
        }),
        {
          status: isNotFound ? 404 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    log("info", "identity_unlinked_via_admin", { userId: user.id, identityId });
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    log("error", "manage_google_identity_unexpected_error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
