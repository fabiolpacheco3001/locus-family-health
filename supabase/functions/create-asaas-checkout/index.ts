import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.25.76";
// A1: CORS restrito ao APP_ORIGIN
import { corsHeaders } from "../_shared/cors.ts";

const BodySchema = z.object({
  planType: z.enum(["monthly", "annual"]),
});

const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL");
if (!ASAAS_API_URL) throw new Error("ASAAS_API_URL secret not configured");

// C10: preços lidos de env vars (secrets Supabase) — nunca hardcoded
const PLAN_MONTHLY_PRICE = parseFloat(Deno.env.get("PLAN_MONTHLY_PRICE") ?? "19.90");
const PLAN_ANNUAL_PRICE  = parseFloat(Deno.env.get("PLAN_ANNUAL_PRICE")  ?? "191.00");

const PLAN_CONFIG = {
  monthly: {
    billingType: "CREDIT_CARD",
    cycle: "MONTHLY",
    value: PLAN_MONTHLY_PRICE,
    description: "Locus Vita — Plano Mensal",
  },
  annual: {
    billingType: "CREDIT_CARD",
    cycle: "YEARLY",
    value: PLAN_ANNUAL_PRICE,
    description: "Locus Vita — Plano Anual (20% OFF)",
  },
};

async function asaasFetch(path: string, options: RequestInit) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not configured");

  const res = await fetch(`${ASAAS_API_URL}${path}`, {
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

/** Find existing Asaas customer by email, or create one */
async function findOrCreateCustomer(email: string, name: string): Promise<string> {
  const search = await asaasFetch(`/customers?email=${encodeURIComponent(email)}`, { method: "GET" });
  if (search.data && search.data.length > 0) {
    console.log("Found existing Asaas customer:", search.data[0].id);
    return search.data[0].id;
  }

  const created = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({ name, email }),
  });
  console.log("Created new Asaas customer:", created.id);
  return created.id;
}

/** Get the invoiceUrl from the first payment of a subscription */
async function getSubscriptionInvoiceUrl(subscriptionId: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1500));

  const payments = await asaasFetch(`/payments?subscription=${subscriptionId}`, { method: "GET" });
  if (payments.data && payments.data.length > 0) {
    const payment = payments.data[0];
    if (payment.invoiceUrl) return payment.invoiceUrl;
    // Fallback: deriva o base web da API URL removendo o path da API.
    // Em produção, payment.invoiceUrl é sempre retornado pelo Asaas e esta linha nunca executa.
    const webBase = ASAAS_API_URL
      .replace(/\/api\/v3\/?$/, "")
      .replace(/\/v3\/?$/, "")
      .replace("api-sandbox.", "sandbox.");
    return `${webBase}/i/${payment.id}`;
  }

  throw new Error("Nenhuma cobrança gerada para a assinatura. Tente novamente.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing auth header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Auth failed", details: userError?.message ?? null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const userEmail = user.email!;
    const userName = user.user_metadata?.full_name || userEmail;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { planType } = parsed.data;
    const plan = PLAN_CONFIG[planType];

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find or create customer in Asaas
    const customerId = await findOrCreateCustomer(userEmail, userName);

    // Save the asaas_customer_id and plan_type
    await adminClient
      .from("subscriptions")
      .update({ plan_type: planType, asaas_customer_id: customerId })
      .eq("user_id", userId);

    // 2. Check for existing active/pending subscription
    const existingSubs = await asaasFetch(
      `/subscriptions?customer=${customerId}&status=ACTIVE&status=PENDING`,
      { method: "GET" }
    );

    let subscriptionId: string;

    if (existingSubs.data && existingSubs.data.length > 0) {
      subscriptionId = existingSubs.data[0].id;
      console.log("Reusing existing Asaas subscription:", subscriptionId);
    } else {
      // 3. Create subscription with CREDIT_CARD only
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 1);
      const dueDateStr = nextDueDate.toISOString().split("T")[0];

      const subscription = await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: plan.value,
          nextDueDate: dueDateStr,
          cycle: plan.cycle,
          description: plan.description,
          externalReference: userId,
        }),
      });

      subscriptionId = subscription.id;
      console.log("Created Asaas subscription:", subscriptionId);
    }

    await adminClient
      .from("subscriptions")
      .update({
        plan_type: planType,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // 4. Get the invoice URL
    const invoiceUrl = await getSubscriptionInvoiceUrl(subscriptionId);

    return new Response(
      JSON.stringify({ url: invoiceUrl }),
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
