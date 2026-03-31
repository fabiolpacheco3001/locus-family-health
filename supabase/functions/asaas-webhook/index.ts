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

    // Determine which identifier to use for the lookup
    let updateQuery = adminClient.from("subscriptions");

    if (externalReference) {
      // externalReference = user_id
      updateQuery = updateQuery.update({} as Record<string, unknown>).eq("user_id", externalReference) as typeof updateQuery;
    } else if (customerId) {
      updateQuery = updateQuery.update({} as Record<string, unknown>).eq("asaas_customer_id", customerId) as typeof updateQuery;
    } else {
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
        if (payment.dueDate) {
          updateData.next_billing_date = payment.dueDate;
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

    // Execute update
    const identifier = externalReference
      ? { column: "user_id", value: externalReference }
      : { column: "asaas_customer_id", value: customerId! };

    const { error } = await adminClient
      .from("subscriptions")
      .update(updateData)
      .eq(identifier.column, identifier.value);

    if (error) {
      console.error("Failed to update subscription:", error);
      return new Response(
        JSON.stringify({ error: "Failed to update subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Subscription updated: ${identifier.column}=${identifier.value}, status=${newStatus}`);

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
