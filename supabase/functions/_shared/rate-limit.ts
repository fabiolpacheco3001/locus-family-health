/**
 * _shared/rate-limit.ts — Locus Vita
 *
 * A4 fix: Rate limiting de chamadas de IA por usuário.
 *
 * Limite padrão: AI_CALLS_PER_HOUR (env var) ou 10 chamadas/hora por feature.
 * Comportamento fail-closed: se não conseguir verificar, bloqueia a chamada.
 *
 * Uso:
 *   import { checkAiRateLimit, logAiUsage } from "../_shared/rate-limit.ts";
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { log } from "./logger.ts";

/** Máximo de chamadas de IA por hora por usuário (configurável via env var). */
const AI_CALLS_PER_HOUR = parseInt(Deno.env.get("AI_CALLS_PER_HOUR") ?? "10", 10);

/**
 * Verifica se o usuário ainda tem cota de chamadas de IA na última hora.
 * Fail-closed: retorna { allowed: false } se ocorrer erro na consulta.
 */
export async function checkAiRateLimit(
  supabase: SupabaseClient,
  userId: string,
  feature: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("ai_usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("created_at", oneHourAgo);

  if (error) {
    // Fail-closed: erro ao verificar → bloqueia por segurança
    log("error", "ai_rate_limit_check_failed", { userId, feature, error: error.message });
    return { allowed: false, count: -1, limit: AI_CALLS_PER_HOUR };
  }

  const callCount = count ?? 0;
  return {
    allowed: callCount < AI_CALLS_PER_HOUR,
    count: callCount,
    limit: AI_CALLS_PER_HOUR,
  };
}

/**
 * Registra uma chamada de IA bem-sucedida em ai_usage_logs.
 * Non-blocking: erros são logados mas não lançados.
 */
export async function logAiUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: string,
  tokensUsed = 0
): Promise<void> {
  const { error } = await supabase
    .from("ai_usage_logs")
    .insert({ user_id: userId, feature, tokens_used: tokensUsed });

  if (error) {
    log("error", "ai_usage_log_failed", { userId, feature, error: error.message });
  }
}
