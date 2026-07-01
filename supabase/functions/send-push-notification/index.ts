/**
 * send-push-notification — Edge Function genérica de envio de Web Push.
 *
 * Pode ser chamada por:
 *  - Outras Edge Functions (ex: send-medication-reminders)
 *  - pg_cron jobs via net.http_post
 *  - Frontend (autenticado, para teste) — via isAdmin check
 *
 * Payload:
 *  {
 *    user_id: string          — UUID do usuário destino
 *    title: string            — Título da notificação
 *    body: string             — Corpo da mensagem
 *    url?: string             — Deep link ao clicar (default: '/home')
 *    type?: string            — 'medication_dose' | 'appointment' | 'exam' | 'subscription' | 'changelog' | 'generic'
 *    tag?: string             — Deduplicação: mesma tag substitui a anterior
 *    icon?: string            — URL do ícone (default: /icon-192.png)
 *    data?: Record<string,unknown> — Dados extras (family_member_id, etc.)
 *  }
 *
 * VAPID Secrets necessários (Supabase Dashboard → Edge Functions → Secrets):
 *  VAPID_PRIVATE_KEY   = <configurar no Supabase Dashboard — nunca versionar>
 *  VAPID_PUBLIC_KEY    = <configurar no Supabase Dashboard — nunca versionar>
 *  VAPID_SUBJECT       = mailto:suporte@locustech.com.br
 *  CRON_SECRET         = <configurar no Supabase Dashboard — nunca versionar>
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import { captureEdgeException } from "../_shared/sentry-edge.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@locustech.com.br";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Guard: verificar que as secrets VAPID estão configuradas
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    log("error", "push_vapid_secrets_missing", {});
    return new Response(
      JSON.stringify({ error: "Configuração de push incompleta" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  // ── Authentication: accept JWT (authenticated users) OR CRON_SECRET ──────
  const authHeader = req.headers.get("Authorization") ?? "";
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const isCronCall = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  // callerUserId é preenchido apenas para chamadas JWT (não-cron)
  let callerUserId: string | null = null;
  let callerIsAdmin = false;

  if (!isCronCall) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    callerUserId = user.id;

    // Verificar se o caller é admin da plataforma
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("id", user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();
    callerIsAdmin = !!roleRow;
  }

  try {
    const body = await req.json();
    const {
      user_id,
      title,
      body: notifBody,
      url = "/home",
      type = "generic",
      tag,
      icon = "https://locus-family-vita.lovable.app/icon-192.png",
      badge = "https://locus-family-vita.lovable.app/badge-96.png",
      data: extraData = {},
    } = body;

    if (!user_id || !title || !notifBody) {
      return new Response(
        JSON.stringify({ error: "user_id, title e body são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guard: usuário comum só pode enviar push para si mesmo.
    // Admins podem enviar para qualquer usuário. Chamadas cron não têm restrição.
    if (!isCronCall && callerUserId && user_id !== callerUserId && !callerIsAdmin) {
      log("warn", "push_unauthorized_user_id_spoof", { callerUserId, targetUserId: user_id });
      return new Response(
        JSON.stringify({ error: "Não autorizado a enviar notificações para este usuário" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Fetch all active push subscriptions for this user
    const { data: subs, error: subError } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id)
      .eq("is_active", true);

    if (subError) {
      log("error", "push_fetch_subscriptions_failed", { user_id, error: subError.message });
      return new Response(
        JSON.stringify({ error: "Erro ao buscar subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subs || subs.length === 0) {
      log("info", "push_no_subscriptions", { user_id, type });
      return new Response(
        JSON.stringify({ sent: 0, message: "Usuário sem subscriptions ativas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({ title, body: notifBody, url, type, tag, icon, badge, data: extraData });

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        try {
          await webpush.sendNotification(pushSub, payload, {
            TTL: 86400, // 24h — notification survives if device is offline
            urgency: type === "medication_dose" ? "high" : "normal",
          });
          sent++;
        } catch (err: unknown) {
          // WebPushError (npm:web-push) tem statusCode, body, headers além de message.
          // Acessamos via Record para compatibilidade com o runtime Deno npm compat layer,
          // onde o cast tipado pode falhar em ler propriedades próprias da classe.
          const webErr = err as Record<string, unknown>;
          const statusCode = typeof webErr.statusCode === 'number' ? webErr.statusCode : undefined;
          const responseBody = typeof webErr.body === 'string' ? webErr.body : '';
          const errMessage = err instanceof Error ? err.message : String(err);

          // APNs retorna 403 para VAPID key mismatch (InvalidAuthorization / ExpiredAuthorization).
          // FCM retorna 401 para credencial inválida.
          // Alguns push services não retornam 4xx mas incluem o motivo no body.
          const isVapidMismatch =
            statusCode === 403 ||
            statusCode === 401 ||
            responseBody.toLowerCase().includes('invalidauthorization') ||
            responseBody.toLowerCase().includes('expiredauthorization') ||
            responseBody.toLowerCase().includes('forbidden') ||
            responseBody.toLowerCase().includes('unauthorize');

          if (statusCode === 410 || statusCode === 404) {
            // Subscription expirada ou cancelada pelo usuário — limpar do banco
            expiredIds.push(sub.id);
            failed++;
          } else if (isVapidMismatch) {
            // VAPID key mismatch: a subscription foi criada com uma VAPID_PUBLIC_KEY diferente
            // da que está em Supabase Secrets. O push não chegará até o usuário re-abrir o app
            // e criar uma nova subscription com a chave correta.
            log("error", "push_vapid_key_mismatch", {
              user_id,
              endpoint: sub.endpoint.slice(0, 60),
              statusCode: statusCode ?? "unknown",
              responseBody: responseBody.slice(0, 300),
              errMessage,
              hint: "Comparar VAPID_PUBLIC_KEY em src/lib/pushConfig.ts com o valor configurado em Supabase Dashboard → Edge Functions → Secrets",
            });
            await captureEdgeException(
              new Error(`VAPID key mismatch ao enviar push: statusCode=${statusCode ?? 'unknown'} body=${responseBody.slice(0, 200)}`),
              {
                functionName: "send-push-notification",
                event: "push_vapid_key_mismatch",
                user_id,
                endpoint: sub.endpoint.slice(0, 60),
                statusCode: statusCode ?? "unknown",
                responseBody: responseBody.slice(0, 300),
                hint: "VAPID_PUBLIC_KEY nos Secrets não corresponde à chave usada para criar a subscription — re-subscribe necessário",
              }
            );
            // Marcar como inativa: o endpoint rejeita pushes com a chave atual.
            // Usuário precisará re-abrir o app para criar nova subscription com chave correta.
            expiredIds.push(sub.id);
            failed++;
          } else {
            // Erro inesperado (rede, timeout, erro do push service, etc.)
            log("error", "push_send_failed", {
              user_id,
              endpoint: sub.endpoint.slice(0, 60),
              statusCode: statusCode ?? "unknown",
              responseBody: responseBody.slice(0, 300),
              error: errMessage,
            });
            await captureEdgeException(err instanceof Error ? err : new Error(errMessage), {
              functionName: "send-push-notification",
              event: "push_send_failed",
              user_id,
              endpoint: sub.endpoint.slice(0, 60),
              statusCode: statusCode ?? "unknown",
              responseBody: responseBody.slice(0, 300),
            });
            failed++;
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await adminClient
        .from("push_subscriptions")
        .update({ is_active: false })
        .in("id", expiredIds);
      log("info", "push_subscriptions_expired", { count: expiredIds.length, user_id });
    }

    log("info", "push_notification_sent", { user_id, type, sent, failed });

    return new Response(
      JSON.stringify({ sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log("error", "push_unexpected_error", { error: String(err) });
    return new Response(
      JSON.stringify({ error: "Erro interno ao enviar notificação" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
