const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ASAAS_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch("https://api.asaas.com/v3/customers?limit=1", {
      method: "GET",
      headers: { "Content-Type": "application/json", access_token: apiKey },
    });

    const body = await res.text();
    return new Response(
      JSON.stringify({ asaas_status: res.status, response: JSON.parse(body) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
