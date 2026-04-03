import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Fetch the real subscription data from Asaas API.
 * Returns { nextDueDate, cycle } or null on failure.
 */
async function fetchAsaasSubscription(subscriptionId: string): Promise<{ nextDueDate: string | null; cycle: string | null } | null> {
  const asaasKey = Deno.env.get("ASAAS_API_KEY") || "";
  try {
    const resp = await fetch(
      `https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`,
      { headers: { access_token: asaasKey } }
    );
    if (!resp.ok) {
      console.warn("Failed to fetch Asaas subscription:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    console.log("Asaas subscription details:", JSON.stringify(data));
    return {
      nextDueDate: data.nextDueDate ?? null,
      cycle: data.cycle ?? null,
    };
  } catch (err) {
    console.error("Error fetching Asaas subscription:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Asaas webhook token
    const incomingToken = req.headers.get("asaas-access-token");
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

    if (!expectedToken || !incomingToken || incomingToken !== expectedToken) {
      console.warn("Webhook rejected: invalid or missing asaas-access-token header");
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const event = body.event as string;
    const payment = body.payment;

    if (!event) {
      console.warn("Webhook received without event:", JSON.stringify(body));
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Asaas webhook event: ${event}, payment ID: ${payment?.id}`);
    console.log("Full payload:", JSON.stringify(body));

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
        console.warn("SUBSCRIPTION_UPDATED without subscription object");
        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch fresh data from Asaas API
      const asaasData = await fetchAsaasSubscription(sub.id);
      if (!asaasData) {
        return new Response(
          JSON.stringify({ received: true, warning: "could not fetch subscription" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        updateData.user_id = extRef;
        const { data, error } = await adminClient
          .from("subscriptions")
          .upsert(updateData as any, { onConflict: "user_id" })
          .select();
        console.log("SUBSCRIPTION_UPDATED upsert:", JSON.stringify({ data, error }));
      }

      return new Response(
        JSON.stringify({ received: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PAYMENT EVENTS ───
    if (!payment) {
      console.warn("Unhandled event without payment:", event);
      return new Response(
        JSON.stringify({ received: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalReference = payment.externalReference as string | null;
    const customerId = payment.customer as string | null;

    if (!externalReference && !customerId) {
      console.warn("No externalReference or customer ID in payment payload");
      return new Response(
        JSON.stringify({ received: true, warning: "no identifier" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
              console.log("Using Asaas nextDueDate (SSOT):", asaasData.nextDueDate);
            }
            if (asaasData.cycle === "YEARLY") updateData.plan_type = "annual";
            else if (asaasData.cycle === "MONTHLY") updateData.plan_type = "monthly";
          }
        }

        // Fallback plan_type from value if not set by cycle
        if (!updateData.plan_type && payment.value) {
          const value = Number(payment.value);
          updateData.plan_type = value >= 150 ? "annual" : "monthly";
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
        console.log(`Unhandled Asaas event: ${event}`);
        return new Response(
          JSON.stringify({ received: true, event }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Always save the Asaas customer ID
    if (customerId) {
      updateData.asaas_customer_id = customerId;
    }

    console.log("Data to upsert:", JSON.stringify(updateData));

    if (externalReference) {
      updateData.user_id = externalReference;
      const { data, error } = await adminClient
        .from("subscriptions")
        .upsert(updateData as any, { onConflict: "user_id" })
        .select();

      if (error) {
        console.error("Failed to upsert subscription:", JSON.stringify(error));
        return new Response(
          JSON.stringify({ error: "Failed to upsert subscription", details: error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Subscription upserted successfully:", JSON.stringify(data));
    } else {
      const { data, error } = await adminClient
        .from("subscriptions")
        .update(updateData)
        .eq("asaas_customer_id", customerId!)
        .select();

      if (error) {
        console.error("Failed to update subscription by customer_id:", JSON.stringify(error));
        return new Response(
          JSON.stringify({ error: "Failed to update subscription", details: error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Subscription updated by customer_id:", JSON.stringify(data));
    }

    return new Response(
      JSON.stringify({ received: true, status: newStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("asaas-webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
