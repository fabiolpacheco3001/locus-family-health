/**
 * send-appointment-reminders — Lembrete push de consultas, exames e vacinas.
 *
 * Chamado por pg_cron às 8h todos os dias (horário de Brasília).
 * Envia notificações para compromissos do dia seguinte (D-1) e do dia atual (D-0).
 *
 * Tipos notificados:
 *  - consultations (consultas médicas)
 *  - exams (exames laboratoriais/de imagem)
 *  - vaccines (vacinas)
 *
 * Secret obrigatório: CRON_SECRET
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import { getNotificationTargets } from "../_shared/notification-targets.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const TZ = "America/Sao_Paulo";

function todayInSP(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
}

function tomorrowInSP(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const today = todayInSP();
  const tomorrow = tomorrowInSP();
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  log("info", "appointment_reminders_started", { today, tomorrow });

  try {
    const notificationsToSend: {
      userId: string;
      title: string;
      body: string;
      url: string;
      type: string;
      tag: string;
    }[] = [];

    // Helper: resolve destinatários e enfileira notificações para um membro
    const enqueue = async (
      memberId: string,
      groupId: string,
      notification: Omit<(typeof notificationsToSend)[0], "userId">
    ) => {
      const targets = await getNotificationTargets(adminClient, memberId, groupId);
      for (const userId of targets) {
        notificationsToSend.push({ userId, ...notification });
      }
    };

    // ── 1. Consultations ─────────────────────────────────────────────────────
    const { data: consultations } = await adminClient
      .from("consultations")
      .select(`
        id, doctor_name, specialty, scheduled_date, scheduled_time,
        family_members!inner (id, name, group_id, deleted_at)
      `)
      .in("scheduled_date", [today, tomorrow])
      .not("status", "eq", "Cancelada")
      .is("family_members.deleted_at", null);

    for (const c of consultations ?? []) {
      const member = Array.isArray(c.family_members) ? c.family_members[0] : c.family_members;
      if (!member?.id || !member?.group_id) continue;
      const isToday = c.scheduled_date === today;
      const timeStr = c.scheduled_time ? ` às ${(c.scheduled_time as string).slice(0, 5)}` : "";
      const doctorStr = c.doctor_name ? ` com ${c.doctor_name}` : "";
      await enqueue(member.id, member.group_id, {
        title: isToday ? "🏥 Consulta Hoje!" : "🏥 Consulta Amanhã",
        body: `${member.name}: consulta${doctorStr} (${c.specialty ?? "Médica"})${timeStr}`,
        url: "/agenda",
        type: "appointment",
        tag: `consultation-${c.id}-${isToday ? "today" : "tomorrow"}`,
      });
    }

    // ── 2. Exams ──────────────────────────────────────────────────────────────
    const { data: exams } = await adminClient
      .from("exams")
      .select(`
        id, exam_name, exam_date, lab_name,
        family_members!inner (id, name, group_id, deleted_at)
      `)
      .in("exam_date", [today, tomorrow])
      .is("family_members.deleted_at", null);

    for (const e of exams ?? []) {
      const member = Array.isArray(e.family_members) ? e.family_members[0] : e.family_members;
      if (!member?.id || !member?.group_id) continue;
      const isToday = e.exam_date === today;
      const labStr = e.lab_name ? ` em ${e.lab_name}` : "";
      await enqueue(member.id, member.group_id, {
        title: isToday ? "🧪 Exame Hoje!" : "🧪 Exame Amanhã",
        body: `${member.name}: ${e.exam_name}${labStr}`,
        url: "/agenda",
        type: "exam",
        tag: `exam-${e.id}-${isToday ? "today" : "tomorrow"}`,
      });
    }

    // ── 3. Vaccines ───────────────────────────────────────────────────────────
    const { data: vaccines } = await adminClient
      .from("vaccines")
      .select(`
        id, vaccine_name, next_dose_date,
        family_members!inner (id, name, group_id, deleted_at)
      `)
      .in("next_dose_date", [today, tomorrow])
      .is("family_members.deleted_at", null);

    for (const v of vaccines ?? []) {
      const member = Array.isArray(v.family_members) ? v.family_members[0] : v.family_members;
      if (!member?.id || !member?.group_id) continue;
      const isToday = v.next_dose_date === today;
      await enqueue(member.id, member.group_id, {
        title: isToday ? "💉 Vacina Hoje!" : "💉 Vacina Amanhã",
        body: `${member.name}: ${v.vaccine_name}`,
        url: "/vacinas",
        type: "appointment",
        tag: `vaccine-${v.id}-${isToday ? "today" : "tomorrow"}`,
      });
    }

    log("info", "appointment_reminders_matched", { count: notificationsToSend.length });

    if (notificationsToSend.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send all pushes in parallel via send-push-notification
    const results = await Promise.allSettled(
      notificationsToSend.map(async ({ userId, title, body, url, type, tag }) => {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${CRON_SECRET}`,
            },
            body: JSON.stringify({ user_id: userId, title, body, url, type, tag }),
          }
        );
        return res.ok;
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
    log("info", "appointment_reminders_completed", { sent, total: notificationsToSend.length });

    return new Response(JSON.stringify({ processed: notificationsToSend.length, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("error", "appointment_reminders_unexpected_error", { error: String(err) });
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
