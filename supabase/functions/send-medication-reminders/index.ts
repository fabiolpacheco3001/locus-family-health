/**
 * send-medication-reminders — Lembrete push de medicamentos.
 *
 * Chamado por pg_cron a cada 5 minutos via net.http_post.
 * Verifica medicamentos cujo próximo horário cai dentro da janela atual
 * e envia push para todos os dispositivos do responsável.
 *
 * Lógica por frequency_type:
 *  - specific_times: verifica se algum horário do array cai no slot atual
 *  - specific_days:  verifica o dia da semana + horários
 *  - fixed_interval / interval: calcula próxima dose a partir de start_date + start_time
 *
 * Secret obrigatório: CRON_SECRET (mesmo valor configurado no pg_cron job).
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import { getNotificationTargets, prefetchGroupFamilyMembers, resolveNotificationTargets } from "../_shared/notification-targets.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Window for matching: how many minutes before/after the scheduled time to fire
// (handles clock drift between pg_cron and actual device time)
const MATCH_WINDOW_MINUTES = 3;

// Timezone: all times stored in America/Sao_Paulo
const TZ = "America/Sao_Paulo";

function nowInSP(): { date: Date; hour: number; minute: number; dayOfWeek: number } {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  return {
    date: sp,
    hour: sp.getHours(),
    minute: sp.getMinutes(),
    dayOfWeek: sp.getDay(), // 0=Sunday … 6=Saturday
  };
}

/** Returns true if the given HH:MM time slot falls within the current match window */
function isInWindow(targetH: number, targetM: number, nowH: number, nowM: number): boolean {
  const nowTotal = nowH * 60 + nowM;
  const targetTotal = targetH * 60 + targetM;
  const diff = Math.abs(nowTotal - targetTotal);
  return diff <= MATCH_WINDOW_MINUTES;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticate: only pg_cron with CRON_SECRET or internal calls
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { hour, minute, dayOfWeek } = nowInSP();

  log("info", "med_reminders_started", { hour, minute, dayOfWeek });

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // Fetch all active medications
    // Inner join ensures deleted family members are excluded
    const { data: medications, error } = await adminClient
      .from("medications")
      .select(`
        id,
        name,
        dosage,
        frequency_type,
        frequency_hours,
        start_date,
        start_time,
        end_date,
        specific_times,
        specific_days,
        family_members!inner (
          id,
          name,
          group_id,
          deleted_at
        )
      `)
      .in("status", ["Ativo", "ativo"])
      .is("family_members.deleted_at", null);

    if (error) {
      log("error", "med_reminders_fetch_failed", { error: error.message });
      return new Response(JSON.stringify({ error: "Erro interno ao buscar medicamentos" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!medications || medications.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toNotify: { userId: string; medName: string; dosage: string | null; memberName: string; medId: string }[] = [];

    // Pré-carrega todos os family_group_members em 1 query batch.
    // Elimina N+1: sem isso, getNotificationTargets() faria 1 SELECT por medicamento.
    const allGroupIds = medications
      .map((med) => {
        const m = Array.isArray(med.family_members) ? med.family_members[0] : med.family_members;
        return m?.group_id as string | undefined;
      })
      .filter((id): id is string => !!id);

    const fgmMap = await prefetchGroupFamilyMembers(adminClient, allGroupIds);

    for (const med of medications) {
      const member = Array.isArray(med.family_members) ? med.family_members[0] : med.family_members;
      if (!member?.id || !member?.group_id) continue;

      const freqType = (med.frequency_type as string) || "fixed_interval";
      const specificTimes = (med.specific_times as string[] | null) ?? [];
      const specificDays = (med.specific_days as number[] | null) ?? [];

      let shouldNotify = false;

      if (freqType === "specific_times" || (freqType !== "specific_days" && freqType !== "fixed_interval" && freqType !== "interval" && specificTimes.length > 0)) {
        // Check if current time matches any of the specific_times
        for (const t of specificTimes) {
          const [h, m] = t.split(":").map(Number);
          if (isInWindow(h, m, hour, minute)) {
            shouldNotify = true;
            break;
          }
        }
      } else if (freqType === "specific_days" || specificDays.length > 0) {
        // Check day of week first, then times
        if (specificDays.includes(dayOfWeek)) {
          for (const t of specificTimes) {
            const [h, m] = t.split(":").map(Number);
            if (isInWindow(h, m, hour, minute)) {
              shouldNotify = true;
              break;
            }
          }
        }
      } else if (freqType === "fixed_interval" || freqType === "interval") {
        // Handles both 'fixed_interval' and 'interval' (legacy value) frequency types
        if (!med.start_date) continue;

        const dateStr = (med.start_date as string).slice(0, 10);

        if (!med.frequency_hours || (med.frequency_hours as number) <= 0) {
          // No interval defined: treat start_time as a daily dose time (once per day)
          if (med.start_time) {
            const timePart = (med.start_time as string).slice(0, 5); // "HH:MM"
            const [h, m] = timePart.split(":").map(Number);
            if (isInWindow(h, m, hour, minute)) shouldNotify = true;
          }
        } else {
          // Interval-based: calculate next dose from start_date + N × frequency_hours
          // IMPORTANT: start_time is stored in BRT (e.g. "19:30:00").
          // nowMs uses toLocaleString(TZ) which gives BRT clock value re-parsed as "UTC"
          // on a UTC server. To stay in the same space, build startTime from the raw
          // BRT date+time string WITHOUT any extra timezone conversion.
          const timePart = med.start_time ? (med.start_time as string).slice(0, 5) : "00:00";
          const startTime = new Date(`${dateStr}T${timePart}:00`);

          const nowMs = new Date(new Date().toLocaleString("en-US", { timeZone: TZ })).getTime();
          const elapsedMs = nowMs - startTime.getTime();
          if (elapsedMs < 0) continue;

          const intervalMs = (med.frequency_hours as number) * 60 * 60 * 1000;
          const sinceLastDoseMs = elapsedMs % intervalMs;

          // Is the current time within MATCH_WINDOW_MINUTES of a dose?
          const windowMs = MATCH_WINDOW_MINUTES * 60 * 1000;
          if (sinceLastDoseMs <= windowMs || (intervalMs - sinceLastDoseMs) <= windowMs) {
            shouldNotify = true;
          }
        }
      }

      // Check end_date
      if (shouldNotify && med.end_date) {
        const endDate = new Date(new Date(`${med.end_date}T23:59:59`).toLocaleString("en-US", { timeZone: TZ }));
        if (new Date() > endDate) shouldNotify = false;
      }

      if (shouldNotify) {
        // Resolve destinatários via RBAC:
        // admin do grupo recebe tudo; usuário regular recebe apenas se member
        // está em seus managed_profiles.
        const targetUserIds = await getNotificationTargets(adminClient, member.id, member.group_id);
        for (const userId of targetUserIds) {
          toNotify.push({
            userId,
            medName: med.name,
            dosage: med.dosage,
            memberName: member.name,
            medId: med.id,
          });
        }
      }
    }

    log("info", "med_reminders_matched", { count: toNotify.length, hour, minute });

    if (toNotify.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire push notifications in parallel (via send-push-notification function)
    const results = await Promise.allSettled(
      toNotify.map(async ({ userId, medName, dosage, memberName, medId }) => {
        const body = dosage
          ? `${memberName}: tomar ${medName} (${dosage}) agora`
          : `${memberName}: hora de tomar ${medName}`;

        // Call send-push-notification (same project, internal call)
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${CRON_SECRET}`,
            },
            body: JSON.stringify({
              user_id: userId,
              title: "💊 Hora do Remédio!",
              body,
              url: "/home",
              type: "medication_dose",
              tag: `med-${medId}-${hour}${String(minute).padStart(2, "0")}`,
              data: { family_member_name: memberName, medication_id: medId },
            }),
          }
        );

        let pushResult: Record<string, unknown> = { http_ok: res.ok, status: res.status };
        try {
          pushResult = { ...pushResult, ...(await res.json()) };
        } catch { /* ignore parse errors */ }

        log("info", "push_result", { userId, medName, ...pushResult });
        return pushResult;
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && (r.value as Record<string, unknown>)?.http_ok
    ).length;
    const pushDetails = results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: String((r as PromiseRejectedResult).reason) }
    );
    log("info", "med_reminders_completed", { sent, total: toNotify.length, details: pushDetails });

    return new Response(JSON.stringify({ processed: toNotify.length, sent, push_details: pushDetails }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("error", "med_reminders_unexpected_error", { error: String(err) });
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
