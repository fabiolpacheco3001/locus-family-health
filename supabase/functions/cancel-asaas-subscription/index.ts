import { createClient } from "npm:@supabase/supabase-js@2.49.4";
// A1: CORS restrito ao APP_ORIGIN
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security: do NOT read asaasSubscriptionId from the request body.
    // Accepting it from the client would allow any authenticated user to cancel
    // another customer's subscription by passing their Asaas ID.
    // The ID is always sourced exclusively from the DB row of the authenticated user.

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Chave da API de pagamento não configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const asaasApiUrl = Deno.env.get("ASAAS_API_URL");
    if (!asaasApiUrl) {
      return new Response(JSON.stringify({ error: "URL da API de pagamento não configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const { data: sub, error: subErr } = await serviceClient
      .from("subscriptions")
      .select("user_id, asaas_customer_id, asaas_subscription_id, next_billing_date")
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Assinatura não encontrada." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetSubscriptionId = sub.asaas_subscription_id ?? null;

    // Fallback: list active subscriptions from Asaas by customer
    if (!targetSubscriptionId && sub.asaas_customer_id) {
      const listRes = await fetch(
        `${asaasApiUrl}/subscriptions?customer=${sub.asaas_customer_id}`,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            access_token: apiKey,
          },
        }
      );

      if (listRes.ok) {
        const listData = await listRes.json();
        const activeSubscription = (listData.data ?? []).find(
          (item: { status?: string; id?: string }) =>
            ["ACTIVE", "PENDING"].includes(item.status ?? "")
        );
        targetSubscriptionId = activeSubscription?.id ?? null;
      }
    }

    if (!targetSubscriptionId) {
      return new Response(JSON.stringify({ error: "ID da assinatura Asaas não encontrado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE the subscription on Asaas
    const cancelRes = await fetch(
      `${asaasApiUrl}/subscriptions/${targetSubscriptionId}`,
      {
        method: "DELETE",
        headers: {
          accept: "application/json",
          access_token: apiKey,
        },
      }
    );

    if (!cancelRes.ok) {
      const errorBody = await cancelRes.text().catch(() => "(unreadable)");
      // Log full details server-side only — never forward raw gateway error bodies to clients
      log("error", "asaas_delete_subscription_failed", { status: cancelRes.status, body: errorBody });
      return new Response(JSON.stringify({ error: "Erro ao cancelar assinatura. Tente novamente ou entre em contato com o suporte." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update ONLY the status — preserve all date fields
    const { error: updateErr } = await serviceClient
      .from("subscriptions")
      .update({
        status: "canceled",
        asaas_subscription_id: targetSubscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateErr) {
      log("error", "subscription_status_update_failed", { error: updateErr.message });
      return new Response(JSON.stringify({ error: "Erro ao atualizar status da assinatura. Entre em contato com o suporte." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, asaasSubscriptionId: targetSubscriptionId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log("error", "cancel_subscription_unexpected_error", { error: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente ou entre em contato com o suporte." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
