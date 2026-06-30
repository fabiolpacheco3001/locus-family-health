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

async function findOrCreateCustomer(
  creds: AsaasCredentials,
  email: string,
  name: string,
  cpfCnpj: string,
  phone: string,
  postalCode: string,
  addressNumber: string
): Promise<string> {
  // 1. Buscar por email
  const search = await asaasFetch(creds, `/customers?email=${encodeURIComponent(email)}`, { method: "GET" });
  if (search.data && search.data.length > 0) {
    const existing = search.data[0];
    log("info", "asaas_customer_found", { customerId: existing.id, env: creds.env });

    const needsCpf = !existing.cpfCnpj && !!cpfCnpj;
    // Telefone armazenado de tentativas anteriores (fallback inválido "11999999999")
    // causa invalid_mobilePhone no Asaas ao criar pagamento — atualizar para valor válido.
    const hasStalePhone =
      existing.phone === "11999999999" || existing.mobilePhone === "11999999999";
    const shouldUpdatePhone = !!phone && (hasStalePhone || !existing.phone);

    if (needsCpf || shouldUpdatePhone) {
      const updateBody: Record<string, string> = { name };
      if (cpfCnpj) updateBody.cpfCnpj = cpfCnpj;
      if (phone) updateBody.phone = phone;
      if (postalCode && postalCode !== "01310100") updateBody.postalCode = postalCode;
      if (addressNumber && addressNumber !== "1") updateBody.addressNumber = addressNumber;
      try {
        await asaasFetch(creds, `/customers/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify(updateBody),
        });
        log("info", "asaas_customer_updated", {
          customerId: existing.id, env: creds.env, needsCpf, shouldUpdatePhone,
        });
      } catch (updateErr) {
        log("warn", "asaas_customer_update_failed", {
          customerId: existing.id, env: creds.env,
          hint: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      }
    }
    return existing.id;
  }

  // 2. Tentar criar novo cliente
  // cpfCnpj/phone vazios = sandbox sem dado real; omitir campo para Asaas não rejeitar
  log("info", "asaas_customer_payload", {
    env: creds.env, hasCpf: !!cpfCnpj, hasPhone: !!phone,
  });
  const customerBody: Record<string, string> = { name, email };
  if (cpfCnpj) customerBody.cpfCnpj = cpfCnpj;
  if (phone) customerBody.phone = phone;
  if (postalCode && postalCode !== "01310100") customerBody.postalCode = postalCode;
  if (addressNumber && addressNumber !== "1") customerBody.addressNumber = addressNumber;

  try {
    const created = await asaasFetch(creds, "/customers", {
      method: "POST",
      body: JSON.stringify(customerBody),
    });
    log("info", "asaas_customer_created", { customerId: created.id, env: creds.env });
    return created.id;
  } catch (createErr) {
    // 3. Fallback: criação falhou (provável conflito de CPF) → buscar cliente por CPF
    if (cpfCnpj) {
      try {
        const cpfSearch = await asaasFetch(creds, `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`, { method: "GET" });
        if (cpfSearch.data && cpfSearch.data.length > 0) {
          const existingByCpf = cpfSearch.data[0];
          log("warn", "asaas_customer_found_by_cpf_fallback", {
            customerId: existingByCpf.id,
            env: creds.env,
            hint: "customer creation failed; found existing by CPF",
          });
          return existingByCpf.id;
        }
      } catch (cpfSearchErr) {
        log("warn", "asaas_customer_cpf_search_failed", {
          env: creds.env,
          hint: cpfSearchErr instanceof Error ? cpfSearchErr.message : String(cpfSearchErr),
        });
      }
    }
    throw createErr;
  }
}

/**
 * Finds all PENDING/OVERDUE payments for this user via externalReference,
 * and either reuses them (if same plan) or cancels them (if different plan).
 *
 * Using externalReference is more robust than customer ID:
 * - externalReference = userId is set on every payment we create
 * - avoids stale customer ID issues
 * - finds payments even if customer was recreated
 *
 * Returns { reusedPayment } if an existing PENDING payment for the same plan was found.
 * The caller should return its invoiceUrl immediately (true idempotency).
 */
async function handleExistingPayments(
  creds: AsaasCredentials,
  userId: string,
  planDescription: string
): Promise<{ reusedPayment: { id: string; invoiceUrl: string } | null }> {
  // Only statuses that are actionable (cancelable or reusable)
  // AWAITING_PAYMENT is NOT a valid Asaas v3 API status — use PENDING + OVERDUE only
  const actionableStatuses = ["PENDING", "OVERDUE"];

  for (const status of actionableStatuses) {
    try {
      // Search by externalReference=userId — catches ALL payments for this user
      // regardless of customer ID state in our DB
      const list = await asaasFetch(
        creds,
        `/payments?externalReference=${encodeURIComponent(userId)}&status=${status}&limit=20`,
        { method: "GET" }
      );
      const payments: Array<{ id: string; description: string; invoiceUrl: string }> =
        list?.data ?? [];

      for (const p of payments) {
        // Same plan + PENDING → reuse existing checkout URL (true idempotency)
        // Avoids creating zombie payments when user clicks "Assinar" multiple times
        if (p.description === planDescription && status === "PENDING") {
          log("info", "asaas_payment_reused_idempotent", {
            paymentId: p.id,
            description: p.description,
            env: creds.env,
            userId,
          });
          return { reusedPayment: { id: p.id, invoiceUrl: p.invoiceUrl } };
        }

        // Different plan (or OVERDUE same plan) → cancel before creating new
        try {
          await asaasFetch(creds, `/payments/${p.id}/cancel`, { method: "POST" });
          log("info", "asaas_payment_cancelled_pre_create", {
            paymentId: p.id,
            status,
            description: p.description,
            env: creds.env,
            userId,
          });
        } catch (cancelErr) {
          // Log full Asaas error for diagnosis — includes HTTP status + body
          log("warn", "asaas_payment_cancel_failed_pre_create", {
            paymentId: p.id,
            status,
            description: p.description,
            env: creds.env,
            userId,
            hint: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
          });
        }
      }
    } catch (listErr) {
      log("warn", "asaas_list_payments_failed_pre_create", {
        status,
        env: creds.env,
        userId,
        hint: listErr instanceof Error ? listErr.message : String(listErr),
      });
    }
  }

  return { reusedPayment: null };
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
      .select("test_mode, asaas_customer_id, id, status, plan_type, asaas_payment_id")
      .eq("user_id", userId)
      .maybeSingle();

    // CRITICAL: default testMode = true (sandbox) when no subscription row exists.
    // Without this, testMode = false and the production Asaas API is called with
    // a sandbox key, causing payment errors.
    const testMode = subRow?.test_mode !== false;
    const creds = resolveAsaasEnv(testMode);
    log("info", "asaas_env_selected", { env: creds.env, userId, testMode });

    // Guard: em produção, "00000000191" é recusado pela Receita Federal.
    // O usuário deve cadastrar CPF em Ajustes → Meus Dados antes de assinar.
    if (!testMode && cpfCnpj === "00000000191") {
      log("warn", "checkout_blocked_missing_cpf_prod", { userId, env: creds.env });
      return new Response(
        JSON.stringify({
          error: "Por favor, cadastre seu CPF em Ajustes → Meus Dados antes de assinar.",
          code: "missing_cpf",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Resolve customer ID.
    // Em sandbox, não enviar CPF placeholder "00000000191" (inválido) — Asaas sandbox aceita cliente sem CPF.
    // Em produção, CPF real já foi validado pelo guard acima.
    const effectiveCpfCnpj = (testMode && cpfCnpj === "00000000191") ? "" : cpfCnpj;
    // Só enviar telefone se o usuário preencheu um número real.
    // Nunca inventar números fictícios — o campo é opcional no Asaas e
    // inventar um número aparece para o usuário no checkout como "seu telefone".
    const effectivePhone = billingPhone !== "11999999999" ? billingPhone : "";

    // Reutilizar customer ID salvo no banco quando disponível — evita chamada Asaas e possível conflito de CPF.
    let customerId: string;
    if (subRow?.asaas_customer_id) {
      customerId = subRow.asaas_customer_id;
      log("info", "asaas_customer_reused_from_db", { customerId, env: creds.env, userId });
    } else {
      customerId = await findOrCreateCustomer(creds, userEmail, userName, effectiveCpfCnpj, effectivePhone, postalCode, addressNumber);
    }

    // ALWAYS sync CPF/phone/address with Asaas customer after obtaining customerId.
    // This ensures checkout pre-fill regardless of whether customerId came from DB or
    // findOrCreateCustomer (which may reuse an existing Asaas customer found by email).
    // When DB was cleared (asaas_customer_id = null) but customer still exists in Asaas,
    // the old conditional (subRow?.asaas_customer_id) would skip this sync — causing blank CPF.
    if (effectiveCpfCnpj || effectivePhone) {
      try {
        const syncPayload: Record<string, string> = { name: userName };
        if (effectiveCpfCnpj) syncPayload.cpfCnpj = effectiveCpfCnpj;
        if (effectivePhone) syncPayload.phone = effectivePhone;
        if (postalCode !== "01310100") syncPayload.postalCode = postalCode;
        if (addressNumber !== "1") syncPayload.addressNumber = addressNumber;
        await asaasFetch(creds, `/customers/${customerId}`, {
          method: "PUT",
          body: JSON.stringify(syncPayload),
        });
        log("info", "asaas_customer_synced", { customerId, env: creds.env, userId });

      } catch (syncErr) {
        // Non-critical: checkout continues even if sync fails
        log("warn", "asaas_customer_sync_failed", {
          customerId,
          env: creds.env,
          hint: syncErr instanceof Error ? syncErr.message : String(syncErr),
        });
      }
    }


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

    // Cancel orphaned payments or reuse existing PENDING for same plan.
    // Uses externalReference=userId for robust lookup (survives stale customer IDs).
    const { reusedPayment } = await handleExistingPayments(creds, userId, plan.description);

    if (reusedPayment) {
      // Idempotent path: existing PENDING payment for same plan — return its invoiceUrl.
      // This prevents zombie payments when user clicks "Assinar" multiple times
      // or when API retries occur.
      await adminClient
        .from("subscriptions")
        .update({
          asaas_payment_id: reusedPayment.id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      log("info", "asaas_checkout_reused", {
        paymentId: reusedPayment.id,
        env: creds.env,
        userId,
        planType,
      });

      return new Response(
        JSON.stringify({ url: reusedPayment.invoiceUrl, checkoutUrl: reusedPayment.invoiceUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Create a one-shot payment (Spotify/Netflix model — no subscription object on Asaas)
    const todayStr = new Date().toISOString().split("T")[0];
    log("info", "asaas_payment_payload", {
      customerId, env: creds.env, userId,
      hasCpf: !!effectiveCpfCnpj,
      hasPhone: billingPhone !== "11999999999",
    });
    const payment = await asaasFetch(creds, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: plan.value,
        dueDate: todayStr,
        description: plan.description,
        externalReference: userId,
        // creditCardHolderInfo é campo da API v2 para tokenização direta de cartão.
        // No fluxo de hosted checkout (invoiceUrl) que usamos, o pré-preenchimento
        // vem do customer profile (sincronizado via PUT /customers acima).
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
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    log("error", "create_checkout_unexpected_error", { error: msg, requestId });
    return new Response(
      JSON.stringify({
        error: "Erro ao processar pagamento. Tente novamente ou entre em contato com o suporte.",
        requestId,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
