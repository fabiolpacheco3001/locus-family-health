import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    let asaasSubscriptionId: string | null = null;
    try {
      const payload = await req.json();
      asaasSubscriptionId = typeof payload?.asaasSubscriptionId === "string" ? payload.asaasSubscriptionId : null;
    } catch {
      // No body or invalid JSON — proceed with DB lookup
    }

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

    let targetSubscriptionId = asaasSubscriptionId ?? sub.asaas_subscription_id ?? null;

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
      let errorData: unknown;
      try {
        errorData = await cancelRes.json();
      } catch {
        errorData = await cancelRes.text();
      }
      console.error("Asaas DELETE error:", JSON.stringify(errorData));
      return new Response(JSON.stringify({ error: errorData || "Erro ao cancelar assinatura no gateway." }), {
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
      console.error("Supabase update error:", updateErr.message);
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, asaasSubscriptionId: targetSubscriptionId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    console.error("Unexpected error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
