import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { log, createLogger } from "../_shared/logger.ts";
import { resolveAsaasEnv } from "../_shared/asaas-env.ts";
import { captureEdgeException } from "../_shared/sentry-edge.ts";

const PLAN_MONTHLY_PRICE = parseFloat(Deno.env.get("PLAN_MONTHLY_PRICE") ?? "19.90");
const PLAN_ANNUAL_PRICE  = parseFloat(Deno.env.get("PLAN_ANNUAL_PRICE")  ?? "191.00");

/**
 * Renovação automática diária. Para cada assinatura ativa com cartão tokenizado
 * cujo `next_billing_date` esteja dentro da janela (hoje + 3 dias), dispara uma
 * cobrança avulsa via token (sem novo checkout). A subscription será atualizada
 * pelo webhook PAYMENT_RECEIVED/PAYMENT_CONFIRMED.
 */
Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = createLogger({ requestId });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Acesso restrito: apenas service_role (cron interno) ou super_admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bearer = authHeader.replace("Bearer ", "");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    let authorized = bearer === serviceKey;
    if (!authorized && bearer) {
      const { data: userData } = await adminClient.auth.getUser(bearer);
      const uid = userData?.user?.id;
      if (uid) {
        const { data: role } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("id", uid)
          .in("role", ["admin", "super_admin"])
          .maybeSingle();
        authorized = !!role;
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    const renewalWindow = new Date(today);
    renewalWindow.setUTCDate(renewalWindow.getUTCDate() + 3);
    const renewalWindowStr = renewalWindow.toISOString().split("T")[0];

    const { data: subscriptions, error: subsErr } = await adminClient
      .from("subscriptions")
      .select("user_id, test_mode, credit_card_token, asaas_customer_id, next_billing_date, plan_type")
      .eq("status", "active")
      .not("credit_card_token", "is", null)
      .not("asaas_customer_id", "is", null)
      .lte("next_billing_date", renewalWindowStr);

    if (subsErr) {
      log("error", "renewal_query_failed", { error: subsErr.message });
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const sub of subscriptions ?? []) {
      let creds;
      try {
        creds = resolveAsaasEnv(sub.test_mode === true);
      } catch (_e) {
        log("error", "renewal_env_unavailable", { userId: sub.user_id });
        results.push({ userId: sub.user_id, status: "skipped", reason: "env_unavailable" });
        continue;
      }

      const value = sub.plan_type === "annual" ? PLAN_ANNUAL_PRICE : PLAN_MONTHLY_PRICE;
      const description = sub.plan_type === "annual"
        ? "Locus Vita — Renovação Anual"
        : "Locus Vita — Renovação Mensal";

      try {
        const res = await fetch(`${creds.apiUrl}/lean/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: creds.apiKey,
          },
          body: JSON.stringify({
            customer: sub.asaas_customer_id,
            billingType: "CREDIT_CARD",
            value,
            dueDate: sub.next_billing_date,
            description,
            externalReference: sub.user_id,
            creditCardToken: sub.credit_card_token,
          }),
        });

        const payment = await res.json().catch(() => ({}));

        if (!res.ok) {
          log("error", "renewal_charge_failed", { userId: sub.user_id, env: creds.env, status: res.status, body: payment });
          results.push({ userId: sub.user_id, status: "failed" });
        } else {
          log("info", "renewal_charge_created", { userId: sub.user_id, env: creds.env, paymentId: payment.id });
          results.push({ userId: sub.user_id, status: "created", paymentId: payment.id });
        }
      } catch (err) {
        log("error", "renewal_charge_exception", { userId: sub.user_id, error: err instanceof Error ? err.message : String(err) });
        results.push({ userId: sub.user_id, status: "exception" });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log("error", "generate_renewal_charge_error", { error: err instanceof Error ? err.message : String(err) });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
