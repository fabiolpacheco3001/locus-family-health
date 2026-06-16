/**
 * _shared/cors.ts — Locus Vita
 *
 * A1 fix: CORS headers restritos ao domínio configurado em APP_ORIGIN.
 *
 * Configuração:
 *   - Supabase Dashboard → Settings → Edge Functions → Secrets
 *   - Adicionar: APP_ORIGIN = https://seu-dominio.com.br
 *
 * Comportamento:
 *   - APP_ORIGIN definido → restringe ao domínio exato + adiciona Vary: Origin
 *   - APP_ORIGIN não definido → fallback para "*" (desenvolvimento / preview Lovable)
 *
 * Uso:
 *   import { corsHeaders } from "../_shared/cors.ts";
 *   // Substitui a definição local de corsHeaders — nenhuma outra mudança necessária.
 */

const ALLOWED_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  ...(ALLOWED_ORIGIN !== "*" ? { "Vary": "Origin" } : {}),
};
