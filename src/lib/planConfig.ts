/**
 * planConfig.ts — Fonte única de verdade para preços dos planos Locus Vita.
 *
 * C10 fix: Preços centralizados aqui em vez de hardcoded em PaywallModal,
 * Landing, Ajustes e MeuPlano.
 *
 * Para alterar os preços:
 *  1. Atualizar as constantes abaixo (frontend)
 *  2. Atualizar os secrets no Supabase Dashboard:
 *     - PLAN_MONTHLY_PRICE   (ex: "19.90")
 *     - PLAN_ANNUAL_PRICE    (ex: "191.00")
 *     - PLAN_ANNUAL_THRESHOLD (ex: "150" — limiar para classificar plano no webhook)
 */

/** Valor numérico — usado em cálculos e comparações */
export const PLAN_MONTHLY_VALUE = 19.90;
export const PLAN_ANNUAL_VALUE = 191.00;

/** Strings formatadas para exibição em PT-BR */
export const PLAN_MONTHLY_DISPLAY = "R$ 19,90";
export const PLAN_ANNUAL_DISPLAY  = "R$ 191,00";

/** Strings com período — usadas em cards de assinatura */
export const PLAN_MONTHLY_DISPLAY_PERIOD = "R$ 19,90/mês";
export const PLAN_ANNUAL_DISPLAY_PERIOD  = "R$ 191,00/ano";

/** Desconto anual em relação ao mensal × 12 */
export const PLAN_ANNUAL_DISCOUNT_PCT = Math.round(
  (1 - PLAN_ANNUAL_VALUE / (PLAN_MONTHLY_VALUE * 12)) * 100
);
