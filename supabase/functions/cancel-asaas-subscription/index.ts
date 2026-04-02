import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Get subscription for this user
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sub, error: subErr } = await serviceClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Assinatura não encontrada." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const asaasCustomerId = sub.asaas_customer_id;

    // If there's an Asaas customer, find and cancel active subscriptions
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (asaasApiKey && asaasCustomerId) {
      // List subscriptions for this customer
      const listRes = await fetch(
        `https://api-sandbox.asaas.com/v3/subscriptions?customer=${asaasCustomerId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            access_token: asaasApiKey,
          },
        }
      );

      if (listRes.ok) {
        const listData = await listRes.json();
        const activeSubscriptions = (listData.data ?? []).filter(
          (s: any) => s.status === "ACTIVE"
        );

        for (const asaasSub of activeSubscriptions) {
          const deleteRes = await fetch(
            `https://api-sandbox.asaas.com/v3/subscriptions/${asaasSub.id}`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                access_token: asaasApiKey,
              },
            }
          );
          if (!deleteRes.ok) {
            const errText = await deleteRes.text();
            console.error("Asaas delete failed:", errText);
          }
        }
      }
    }

    // Update local subscription status
    const { error: updateErr } = await serviceClient
      .from("subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateErr) {
      console.error("DB update error:", updateErr);
      return new Response(JSON.stringify({ error: "Erro ao atualizar assinatura." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
