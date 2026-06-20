import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import { resolveAsaasEnv, type AsaasCredentials } from "../_shared/asaas-env.ts";

const BodySchema = z.object({
  planType: z.enum(["monthly", "annual"]),
});

const PLAN_MONTHLY_PRICE = parseFloat(Deno.env.get("PLAN_MONTHLY_PRICE") ?? "19.90");
const PLAN_ANNUAL_PRICE  = parseFloat(Deno.env.get("PLAN_ANNUAL_PRICE")  ?? "191.00");

const PLAN_CONFIG = {
  monthly: { value: PLAN_MONTHLY_PRICE, description: "Locus Vita — Plano Mensal" },
  annual:  { value: PLAN_ANNUAL_PRICE,  description: "Locus Vita — Plano Anual (20% OFF)" },
};

async function asaasFetch(creds: AsaasCredentials, path: string, options: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${creds.apiUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        access_token: creds.apiKey,
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      log("error", "asaas_api_error", { status: res.status, path, body, env: creds.env });
      throw new Error(`asaas_error:${res.status}:${body}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function findOrCreateCustomer(creds: AsaasCredentials, email: string, name: string): Promise<string> {
  const search = await asaasFetch(creds, `/customers?email=${encodeURIComponent(email)}`, { method: "GET" });
  if (search.data && search.data.length > 0) {
    log("info", "asaas_customer_found", { customerId: search.data[0].id, env: creds.env });
    return search.data[0].id;
  }

  const created = await asaasFetch(creds, "/customers", {
    method: "POST",
    body: JSON.stringify({ name, email }),
  });
  log("info", "asaas_customer_created", { customerId: created.id, env: creds.env });
  return created.id;
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
      log("error", "auth_failed", { error: userError?.message ?? null });
      return new Response(
        JSON.stringify({ error: "Não autenticado. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const userEmail = user.email!;
    const userName = user.user_metadata?.full_name || userEmail;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1b. Resolve billing info from the user's family_member profile.
    // PROD-01: CPF real (antifraude Asaas — obrigatório em produção)
    // PROD-02: phone, postal_code, address_number (antifraude Asaas)
    let cpfCnpj       = "00000000191"; // fallback — inválido em prod, dispara warn
    let billingPhone   = "11999999999"; // fallback numérico mínimo
    let postalCode     = "01310100";    // fallback — CEP da Av. Paulista
    let addressNumber  = "1";           // fallback mínimo

    const { data: fgm } = await adminClient
      .from("family_group_members")
      .select("family_member_id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (fgm?.family_member_id) {
      const { data: fm } = await adminClient
        .from("family_members")
        .select("cpf, phone, postal_code, address_number")
        .eq("id", fgm.family_member_id)
        .maybeSingle();

      if (fm) {
        if (fm.cpf)            cpfCnpj      = fm.cpf.replace(/\D/g, "");
        if (fm.phone)          billingPhone  = fm.phone.replace(/\D/g, "");
        if (fm.postal_code)    postalCode    = fm.postal_code.replace(/\D/g, "");
        if (fm.address_number) addressNumber = fm.address_number;
      }
    }

    // Warn when falling back to placeholder values — indicates incomplete profile
    if (cpfCnpj === "00000000191") {
      log("warn", "checkout_cpf_fallback", { userId, hint: "user has no CPF in family_members" });
    }
    if (postalCode === "01310100") {
      log("warn", "checkout_address_fallback", { userId, hint: "user has no postal_code in family_members" });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { planType } = parsed.data;
    const plan = PLAN_CONFIG[planType];

    // Read test_mode + existing customer ID
    const { data: subRow } = await adminClient
      .from("subscriptions")
      .select("test_mode, asaas_customer_id, id")
      .eq("user_id", userId)
      .maybeSingle();

    // CRITICAL: default testMode = true (sandbox) when no subscription row exists.
    // Without this, testMode = false and the production Asaas API is called with
    // a sandbox key, causing payment errors.
    const testMode = subRow?.test_mode !== false;
    const creds = resolveAsaasEnv(testMode);
    log("info", "asaas_env_selected", { env: creds.env, userId, testMode });

    // 1. Always resolve customer in the current env (sandbox vs prod).
    const customerId = await findOrCreateCustomer(creds, userEmail, userName);

    // 2. Persist customer ID — INSERT if first purchase, UPDATE otherwise.
    if (!subRow) {
      await adminClient.from("subscriptions").insert({
        user_id: userId,
        asaas_customer_id: customerId,
        plan_type: planType,
        test_mode: testMode,
        status: "pending_payment",
        next_billing_date: null,
      });
    } else {
      await adminClient
        .from("subscriptions")
        .update({ asaas_customer_id: customerId, plan_type: planType, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    // 3. Create a one-shot payment (Spotify/Netflix model — no subscription object on Asaas)
    const todayStr = new Date().toISOString().split("T")[0];
    const payment = await asaasFetch(creds, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: plan.value,
        dueDate: todayStr,
        description: plan.description,
        externalReference: userId,
        creditCardHolderInfo: {
          name: userName,
          email: userEmail,
          cpfCnpj,
          postalCode,
          addressNumber,
          phone: billingPhone,
        },
      }),
    });

    log("info", "asaas_payment_created", { paymentId: payment.id, env: creds.env, userId });

    // Persist payment id for traceability (token comes via webhook after authorization)
    await adminClient
      .from("subscriptions")
      .update({
        asaas_payment_id: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const checkoutUrl = payment.invoiceUrl;
    if (!checkoutUrl) {
      log("error", "asaas_payment_no_invoice_url", { paymentId: payment.id, payment });
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar o link de pagamento. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ url: checkoutUrl, checkoutUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("error", "create_checkout_unexpected_error", { error: msg });
    // Retornar a mensagem real do Asaas no campo debug para diagnóstico
    const isAsaasError = msg.startsWith("asaas_error:");
    return new Response(
      JSON.stringify({
        error: "Erro ao processar pagamento. Tente novamente ou entre em contato com o suporte.",
        debug: isAsaasError ? msg : undefined,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
