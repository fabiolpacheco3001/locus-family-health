import { createClient } from "@supabase/supabase-js";
import { log } from "../_shared/logger.ts";

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
 * Fetch the real subscription data from Asaas API.
 * Returns { nextDueDate, cycle } or null on failure.
 */
async function fetchAsaasSubscription(subscriptionId: string): Promise<{ nextDueDate: string | null; cycle: string | null } | null> {
  const asaasKey = Deno.env.get("ASAAS_API_KEY") || "";
  try {
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL");
    if (!asaasApiUrl) {
      log("error", "asaas_api_url_missing");
      return null;
    }
    const resp = await fetch(
      `${asaasApiUrl}/subscriptions/${subscriptionId}`,
      { headers: { access_token: asaasKey } }
    );
    if (!resp.ok) {
      log("warn", "asaas_subscription_fetch_failed", { subscriptionId, status: resp.status, body: await resp.text() });
      return null;
    }
    const data = await resp.json();
    log("info", "asaas_subscription_fetched", { subscriptionId, nextDueDate: data.nextDueDate, cycle: data.cycle });
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
        JSON.stringify({ received: true }),
        { status: 200, headers: jsonHeaders }
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

      // Fetch fresh data from Asaas API
      const asaasData = await fetchAsaasSubscription(sub.id);
      if (!asaasData) {
        return new Response(
          JSON.stringify({ received: true, warning: "could not fetch subscription" }),
          { status: 200, headers: jsonHeaders }
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

        // Fetch the REAL nextDueDate from Asaas — Single Source of Truth
        if (payment.subscription) {
          const asaasData = await fetchAsaasSubscription(payment.subscription);
          if (asaasData) {
            // Use the Asaas nextDueDate EXACTLY as-is — no local calculations
            if (asaasData.nextDueDate) {
              updateData.next_billing_date = asaasData.nextDueDate;
              log("info", "payment_next_due_date_set", { nextDueDate: asaasData.nextDueDate });
            }
            if (asaasData.cycle === "YEARLY") updateData.plan_type = "annual";
            else if (asaasData.cycle === "MONTHLY") updateData.plan_type = "monthly";
          }
        }

        // Fallback plan_type from value if not set by cycle
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
            JSON.stringify({ error: "Failed to update subscription", details: error }),
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
            JSON.stringify({ error: "Failed to upsert subscription", details: error }),
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
          JSON.stringify({ error: "Failed to update subscription", details: error }),
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
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
