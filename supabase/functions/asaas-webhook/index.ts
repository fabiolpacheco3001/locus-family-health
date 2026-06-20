import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { log, createLogger } from "../_shared/logger.ts";
import { resolveAsaasEnv } from "../_shared/asaas-env.ts";
import { captureEdgeException } from "../_shared/sentry-edge.ts";

// C6: Validate that externalReference is a valid UUID before using as user_id.
// Prevents arbitrary user_id injection if webhook token is compromised or
// Asaas sends a malformed externalReference.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// A1: asaas-webhook é chamado server-to-server (Asaas → Supabase).
// Não há browser envolvido, portanto CORS headers são desnecessários.
// Respostas usam apenas Content-Type: application/json.
const jsonHeaders = { "Content-Type": "application/json" };

// C10: limiar de valor para classificar plano anual vs mensal via env var
const PLAN_ANNUAL_THRESHOLD = parseFloat(Deno.env.get("PLAN_ANNUAL_THRESHOLD") ?? "150");

/**
 * Resolve as credenciais Asaas a usar para um evento de webhook.
 *
 * Limitação conhecida: o payload do Asaas não traz uma flag oficial de ambiente.
 * Estratégia: usar `externalReference` (= user_id) para ler `test_mode` da
 * subscription. Quando não houver `externalReference` mapeável, cai nas
 * credenciais legadas e emite `warn` `asaas_webhook_env_unknown`.
 */
async function resolveWebhookCreds(
  adminClient: SupabaseClient,
  externalReference: string | null
) {
  let testMode = false;
  if (externalReference) {
    const { data } = await adminClient
      .from("subscriptions")
      .select("test_mode")
      .eq("user_id", externalReference)
      .maybeSingle();
    if (data) {
      testMode = data.test_mode === true;
    } else {
      log("warn", "asaas_webhook_env_unknown", { externalReference });
    }
  } else {
    log("warn", "asaas_webhook_env_unknown", { reason: "no_external_reference" });
  }
  try {
    return resolveAsaasEnv(testMode);
  } catch {
    return null;
  }
}

/**
 * Fetch the real subscription data from Asaas API.
 * Returns { nextDueDate, cycle } or null on failure.
 */
async function fetchAsaasSubscription(
  creds: { apiKey: string; apiUrl: string; env: string },
  subscriptionId: string
): Promise<{ nextDueDate: string | null; cycle: string | null } | null> {
  try {
    const resp = await fetch(
      `${creds.apiUrl}/subscriptions/${subscriptionId}`,
      { headers: { access_token: creds.apiKey } }
    );
    if (!resp.ok) {
      log("warn", "asaas_subscription_fetch_failed", { subscriptionId, status: resp.status, body: await resp.text(), env: creds.env });
      return null;
    }
    const data = await resp.json();
    log("info", "asaas_subscription_fetched", { subscriptionId, nextDueDate: data.nextDueDate, cycle: data.cycle, env: creds.env });
    return {
      nextDueDate: data.nextDueDate ?? null,
      cycle: data.cycle ?? null,
    };
  } catch (err) {
    log("error", "asaas_subscription_fetch_error", { subscriptionId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = createLogger({ requestId });
  // Webhook server-to-server — sem preflight CORS necessário
  try {
    // Validate Asaas webhook token
    const incomingToken = req.headers.get("asaas-access-token");
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

    if (!expectedToken || !incomingToken || incomingToken !== expectedToken) {
      log("warn", "webhook_token_invalid");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: jsonHeaders }
      );
    }

    const body = await req.json();
    const event = body.event as string;
    const payment = body.payment;

    if (!event) {
      log("warn", "webhook_missing_event", { body });
      return new Response(
        JSON.stringify({ error: "Missing event type" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    log("info", "webhook_received", { event, paymentId: payment?.id });

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── SUBSCRIPTION_UPDATED ───
    // Asaas sends this when a subscription's details change.
    // The subscription object is at body.subscription (not body.payment).
    if (event === "SUBSCRIPTION_UPDATED") {
      const sub = body.subscription;
      if (!sub?.id) {
        log("warn", "subscription_updated_missing_object");
        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: jsonHeaders }
        );
      }

      // Resolve credenciais (sandbox vs prod) por externalReference
      const subExtRefRaw = sub.externalReference as string | null;
      const subExtRef = isValidUUID(subExtRefRaw) ? subExtRefRaw : null;
      const subCreds = await resolveWebhookCreds(adminClient, subExtRef);
      if (!subCreds) {
        log("error", "asaas_credentials_unavailable", { event });
        return new Response(
          JSON.stringify({ error: "Payment gateway unavailable" }),
          { status: 503, headers: jsonHeaders }
        );
      }

      // Fetch fresh data from Asaas API
      const asaasData = await fetchAsaasSubscription(subCreds, sub.id);
      if (!asaasData) {
        return new Response(
          JSON.stringify({ error: "Failed to process webhook" }),
          { status: 422, headers: jsonHeaders }
        );
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        asaas_subscription_id: sub.id,
      };
      if (asaasData.nextDueDate) updateData.next_billing_date = asaasData.nextDueDate;
      if (asaasData.cycle === "YEARLY") updateData.plan_type = "annual";
      else if (asaasData.cycle === "MONTHLY") updateData.plan_type = "monthly";

      const extRef = sub.externalReference as string | null;
      if (extRef) {
        // C6: reject non-UUID externalReference to prevent user_id injection
        if (!isValidUUID(extRef)) {
          log("warn", "subscription_updated_invalid_ext_ref", { externalReference: extRef });
          return new Response(
            JSON.stringify({ received: true, warning: "invalid externalReference format" }),
            { status: 200, headers: jsonHeaders }
          );
        }
        updateData.user_id = extRef;
        const { data, error } = await adminClient
          .from("subscriptions")
          .upsert(updateData as any, { onConflict: "user_id" })
          .select();
        log("info", "subscription_updated_upserted", { data, error });
      }

      return new Response(
        JSON.stringify({ received: true, event }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // ─── PAYMENT EVENTS ───
    if (!payment) {
      log("warn", "webhook_event_without_payment", { event });
      return new Response(
        JSON.stringify({ received: true, event }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const externalReferenceRaw = payment.externalReference as string | null;
    const customerId = payment.customer as string | null;

    // C6: validate UUID format before using as user_id
    const externalReference = isValidUUID(externalReferenceRaw) ? externalReferenceRaw : null;
    if (externalReferenceRaw && !externalReference) {
      log("warn", "payment_invalid_external_reference", { externalReference: externalReferenceRaw });
    }

    if (!externalReference && !customerId) {
      log("warn", "payment_missing_identifier");
      return new Response(
        JSON.stringify({ received: true, warning: "no identifier" }),
        { status: 200, headers: jsonHeaders }
      );
    }

    let newStatus: string | null = null;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payment.subscription) {
      updateData.asaas_subscription_id = payment.subscription;
    }

    switch (event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED": {
        newStatus = "active";
        updateData.status = newStatus;
        updateData.asaas_payment_id = payment.id;
        const creditCardToken = payment.creditCardToken ?? payment.creditCard?.creditCardToken;
        if (creditCardToken) updateData.credit_card_token = creditCardToken;
        if (payment.customer) updateData.asaas_customer_id = payment.customer;

        // Legacy path: payment came from a subscription object — keep SSOT from Asaas
        if (payment.subscription) {
          const paymentCreds = await resolveWebhookCreds(adminClient, externalReference);
          const asaasData = paymentCreds ? await fetchAsaasSubscription(paymentCreds, payment.subscription) : null;
          if (asaasData) {
            if (asaasData.nextDueDate) {
              updateData.next_billing_date = asaasData.nextDueDate;
              log("info", "payment_next_due_date_set", { nextDueDate: asaasData.nextDueDate });
            }
            if (asaasData.cycle === "YEARLY") updateData.plan_type = "annual";
            else if (asaasData.cycle === "MONTHLY") updateData.plan_type = "monthly";
          }
        } else {
          // New model: one-shot payment → period = today + 30 days
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
          const periodEndStr = periodEnd.toISOString().split("T")[0];
          updateData.next_billing_date = periodEndStr;
          log("info", "payment_period_extended", { userId: externalReference, periodEnd: periodEndStr, env: (await resolveWebhookCreds(adminClient, externalReference))?.env });
        }

        // Fallback plan_type from value
        if (!updateData.plan_type && payment.value) {
          const value = Number(payment.value);
          updateData.plan_type = value >= PLAN_ANNUAL_THRESHOLD ? "annual" : "monthly";
        }
        break;
      }

      case "PAYMENT_OVERDUE":
        newStatus = "past_due";
        updateData.status = newStatus;
        break;

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED":
        // CRITICAL: Only update status — never touch date columns.
        // Date fields (next_billing_date) MUST be preserved for Grace Period.
        newStatus = "canceled";
        updateData.status = newStatus;
        break;

      default:
        log("info", "webhook_event_unhandled", { event });
        return new Response(
          JSON.stringify({ received: true, event }),
          { status: 200, headers: jsonHeaders }
        );
    }

    // Always save the Asaas customer ID
    if (customerId) {
      updateData.asaas_customer_id = customerId;
    }

    log("info", "subscription_update_payload", { updateData });

    // For cancellation events, use UPDATE (not upsert) to preserve existing date columns.
    // Upsert could INSERT a new row with null dates if the row doesn't match.
    const isCancellation = newStatus === "canceled";

    if (externalReference) {
      if (isCancellation) {
        // UPDATE only — preserve next_billing_date
        const { data, error } = await adminClient
          .from("subscriptions")
          .update(updateData)
          .eq("user_id", externalReference)
          .select();

        if (error) {
          log("error", "subscription_cancel_update_failed", { error });
          return new Response(
            JSON.stringify({ error: "Falha ao processar evento. Tente novamente." }),
            { status: 500, headers: jsonHeaders }
          );
        }
        log("info", "subscription_canceled", { rowsAffected: Array.isArray(data) ? data.length : null });
      } else {
        updateData.user_id = externalReference;
        const { data, error } = await adminClient
          .from("subscriptions")
          .upsert(updateData as any, { onConflict: "user_id" })
          .select();

        if (error) {
          log("error", "subscription_upsert_failed", { error });
          return new Response(
            JSON.stringify({ error: "Falha ao processar evento. Tente novamente." }),
            { status: 500, headers: jsonHeaders }
          );
        }
        log("info", "subscription_upserted", { rowsAffected: Array.isArray(data) ? data.length : null });
      }
    } else {
      const { data, error } = await adminClient
        .from("subscriptions")
        .update(updateData)
        .eq("asaas_customer_id", customerId!)
        .select();

      if (error) {
        log("error", "subscription_update_by_customer_failed", { error });
        return new Response(
          JSON.stringify({ error: "Falha ao processar evento. Tente novamente." }),
          { status: 500, headers: jsonHeaders }
        );
      }
      log("info", "subscription_updated_by_customer", { rowsAffected: Array.isArray(data) ? data.length : null });
    }

    return new Response(
      JSON.stringify({ received: true, status: newStatus }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    log("error", "asaas_webhook_unexpected_error", { error: error instanceof Error ? error.message : String(error) });
    captureEdgeException(error, { functionName: "asaas-webhook", requestId });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
