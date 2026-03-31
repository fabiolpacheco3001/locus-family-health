import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  planType: z.enum(["monthly", "annual"]),
});

const ASAAS_BASE = "https://sandbox.asaas.com/api/v3";

const PLAN_CONFIG = {
  monthly: {
    billingType: "CREDIT_CARD",
    cycle: "MONTHLY",
    value: 19.9,
    description: "Locus Vita — Plano Mensal",
  },
  annual: {
    billingType: "CREDIT_CARD",
    cycle: "YEARLY",
    value: 191.0,
    description: "Locus Vita — Plano Anual (20% OFF)",
  },
};

async function asaasFetch(path: string, options: RequestInit) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not configured");

  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Asaas API error: ${res.status} ${body}`);
    throw new Error(`Falha no Asaas (${res.status}): ${body}`);
  }

  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing auth header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
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

    const { data: { user }, error: userError } =
      await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Auth failed", details: userError?.message ?? null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Validate body
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { planType } = parsed.data;
    const plan = PLAN_CONFIG[planType];

    // Update plan_type in subscriptions (no customer creation — Asaas handles it via Payment Link)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await adminClient
      .from("subscriptions")
      .update({ plan_type: planType })
      .eq("user_id", userId);

    // Create payment link directly (Asaas creates the customer at checkout time)
    const paymentLink = await asaasFetch("/paymentLinks", {
      method: "POST",
      body: JSON.stringify({
        name: plan.description,
        billingType: plan.billingType,
        chargeType: "RECURRENT",
        subscriptionCycle: plan.cycle,
        value: plan.value,
        maxInstallmentCount: 1,
        dueDateLimitDays: 3,
        notificationEnabled: true,
        callback: {
          successUrl: "https://locus-family-vita.lovable.app/home",
          autoRedirect: true,
        },
        externalReference: userId,
      }),
    });

    return new Response(
      JSON.stringify({ url: paymentLink.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("create-asaas-checkout error:", error);
    const message = error instanceof Error ? error.message : "Erro interno no servidor";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
