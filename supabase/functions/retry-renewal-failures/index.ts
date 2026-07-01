/**
 * RX-33 · retry-renewal-failures
 *
 * Cron a cada 4h. Busca registros em public.renewal_failures que estão
 * pending e cujo next_retry_at já passou, tenta novamente a cobrança via
 * Asaas, e atualiza o status:
 *   - sucesso        → status='resolved', resolved_at=NOW()
 *   - falha + <3     → retry_count++, next_retry_at = NOW() + 4h
 *   - falha + ==3    → status='exhausted'
 *
 * Registra resumo em public.cron_job_log ao final.
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { resolveAsaasEnv } from "../_shared/asaas-env.ts";
import { captureEdgeException } from "../_shared/sentry-edge.ts";

const PLAN_MONTHLY_PRICE = parseFloat(Deno.env.get("PLAN_MONTHLY_PRICE") ?? "19.90");
const PLAN_ANNUAL_PRICE  = parseFloat(Deno.env.get("PLAN_ANNUAL_PRICE")  ?? "191.00");
const MAX_RETRIES = 3;

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = createLogger({ requestId });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Auth: aceita apenas o service_role (chamado por cron/pg_net)
    const authHeader = req.headers.get("Authorization") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // Busca falhas pendentes prontas para retry
    const { data: failures, error: fetchErr } = await adminClient
      .from("renewal_failures")
      .select("id, user_id, subscription_id, retry_count")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .lt("retry_count", MAX_RETRIES)
      .limit(100);

    if (fetchErr) {
      log("error", "retry_fetch_failed", { error: fetchErr.message });
      await adminClient.from("cron_job_log").insert({
        job_name: "retry-renewal-failures",
        status: "error",
        detail: `fetch_failed: ${fetchErr.message}`,
        rows_affected: 0,
      });
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolved = 0;
    let stillFailing = 0;
    let exhausted = 0;

    for (const f of failures ?? []) {
      // Carrega dados atuais da subscription
      const { data: sub } = await adminClient
        .from("subscriptions")
        .select("user_id, test_mode, credit_card_token, asaas_customer_id, next_billing_date, plan_type, status")
        .eq("user_id", f.user_id)
        .maybeSingle();

      if (!sub || sub.status !== "active" || !sub.credit_card_token || !sub.asaas_customer_id) {
        // Não dá mais para cobrar — encerra como exhausted
        await adminClient
          .from("renewal_failures")
          .update({ status: "exhausted", retry_count: f.retry_count + 1 })
          .eq("id", f.id);
        exhausted++;
        continue;
      }

      let creds;
      try {
        creds = resolveAsaasEnv(sub.test_mode === true);
      } catch (_e) {
        await adminClient
          .from("renewal_failures")
          .update({
            retry_count: f.retry_count + 1,
            next_retry_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            reason: "env_unavailable",
            status: f.retry_count + 1 >= MAX_RETRIES ? "exhausted" : "pending",
          })
          .eq("id", f.id);
        if (f.retry_count + 1 >= MAX_RETRIES) exhausted++; else stillFailing++;
        continue;
      }

      const value = sub.plan_type === "annual" ? PLAN_ANNUAL_PRICE : PLAN_MONTHLY_PRICE;
      const description = sub.plan_type === "annual"
        ? "Locus Vita — Renovação Anual (retry)"
        : "Locus Vita — Renovação Mensal (retry)";

      try {
        const res = await fetch(`${creds.apiUrl}/lean/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: creds.apiKey },
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

        if (res.ok) {
          await adminClient
            .from("renewal_failures")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
              retry_count: f.retry_count + 1,
            })
            .eq("id", f.id);
          resolved++;
          log("info", "retry_resolved", { userId: f.user_id, paymentId: payment.id });
        } else {
          const nextCount = f.retry_count + 1;
          const isExhausted = nextCount >= MAX_RETRIES;
          await adminClient
            .from("renewal_failures")
            .update({
              retry_count: nextCount,
              next_retry_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
              reason: `http_${res.status}: ${payment?.errors?.[0]?.description ?? "unknown"}`,
              status: isExhausted ? "exhausted" : "pending",
            })
            .eq("id", f.id);
          if (isExhausted) exhausted++; else stillFailing++;
          log("warn", "retry_failed", { userId: f.user_id, status: res.status });
        }
      } catch (err) {
        const nextCount = f.retry_count + 1;
        const isExhausted = nextCount >= MAX_RETRIES;
        await adminClient
          .from("renewal_failures")
          .update({
            retry_count: nextCount,
            next_retry_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            reason: `exception: ${err instanceof Error ? err.message : String(err)}`,
            status: isExhausted ? "exhausted" : "pending",
          })
          .eq("id", f.id);
        if (isExhausted) exhausted++; else stillFailing++;
        log("error", "retry_exception", { userId: f.user_id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const total = (failures ?? []).length;
    const hasErrors = stillFailing > 0 || exhausted > 0;
    await adminClient.from("cron_job_log").insert({
      job_name: "retry-renewal-failures",
      status: hasErrors ? "error" : "ok",
      detail: `resolved=${resolved} pending=${stillFailing} exhausted=${exhausted} total=${total}`,
      rows_affected: resolved,
    });

    return new Response(
      JSON.stringify({ total, resolved, pending: stillFailing, exhausted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    captureEdgeException(err, { functionName: "retry-renewal-failures", requestId });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
