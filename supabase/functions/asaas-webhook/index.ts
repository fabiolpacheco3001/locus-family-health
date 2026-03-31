import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    if (!event || !payment) {
      console.warn("Webhook received without event or payment:", JSON.stringify(body));
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Asaas webhook event: ${event}, payment ID: ${payment.id}`);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const externalReference = payment.externalReference as string | null;
    const customerId = payment.customer as string | null;

    if (!externalReference && !customerId) {
      console.warn("No externalReference or customer ID in payment payload");
      return new Response(
        JSON.stringify({ received: true, warning: "no identifier" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process event
    let newStatus: string | null = null;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    switch (event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        newStatus = "active";
        updateData.status = newStatus;

        // Fetch real subscription details from Asaas to get true nextDueDate
        if (payment.subscription) {
          try {
            const asaasKey = Deno.env.get("ASAAS_API_KEY") || "";
            const subResp = await fetch(
              `https://sandbox.asaas.com/api/v3/subscriptions/${payment.subscription}`,
              { headers: { access_token: asaasKey } }
            );
            if (subResp.ok) {
              const subData = await subResp.json();
              console.log("Asaas subscription details:", JSON.stringify(subData));
              if (subData.nextDueDate) {
                updateData.next_billing_date = subData.nextDueDate;
              }
              // Determine plan_type from subscription cycle
              if (subData.cycle === "YEARLY") {
                updateData.plan_type = "annual";
              } else if (subData.cycle === "MONTHLY") {
                updateData.plan_type = "monthly";
              }
            } else {
              console.warn("Failed to fetch Asaas subscription:", subResp.status, await subResp.text());
              // Fallback to payment dueDate
              if (payment.dueDate) updateData.next_billing_date = payment.dueDate;
            }
          } catch (fetchErr) {
            console.error("Error fetching Asaas subscription:", fetchErr);
            if (payment.dueDate) updateData.next_billing_date = payment.dueDate;
          }
        } else if (payment.dueDate) {
          updateData.next_billing_date = payment.dueDate;
        }

        // Fallback plan_type from value if not set by cycle
        if (!updateData.plan_type && payment.value) {
          const value = Number(payment.value);
          updateData.plan_type = value >= 150 ? "annual" : "monthly";
        }
        break;

      case "PAYMENT_OVERDUE":
        newStatus = "past_due";
        updateData.status = newStatus;
        break;

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED":
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

    // Log full payload for debugging
    console.log("Full payment payload:", JSON.stringify(payment));
    console.log("Data to upsert:", JSON.stringify(updateData));

    if (externalReference) {
      // UPSERT using user_id as conflict target
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
      // Fallback: update by asaas_customer_id
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
