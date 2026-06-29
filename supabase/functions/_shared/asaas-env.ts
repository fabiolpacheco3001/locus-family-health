// Centraliza a resolução de credenciais Asaas por ambiente (sandbox vs produção).
// Prioriza secrets nomeadas por ambiente; cai para as legadas (ASAAS_API_KEY/URL)
// quando as específicas não estão configuradas — garante compatibilidade durante
// a transição.

export type AsaasEnv = "sandbox" | "prod";

export interface AsaasCredentials {
  apiKey: string;
  apiUrl: string;
  env: AsaasEnv;
}

export function resolveAsaasEnv(testMode: boolean): AsaasCredentials {
  const env: AsaasEnv = testMode ? "sandbox" : "prod";

  const suffixed = testMode
    ? { key: Deno.env.get("ASAAS_API_KEY_SANDBOX"), url: Deno.env.get("ASAAS_API_URL_SANDBOX") }
    : { key: Deno.env.get("ASAAS_API_KEY_PROD"),    url: Deno.env.get("ASAAS_API_URL_PROD") };

  const legacyKey = Deno.env.get("ASAAS_API_KEY");
  const legacyUrl = Deno.env.get("ASAAS_API_URL");

  const apiKey = suffixed.key || legacyKey;
  const apiUrl = suffixed.url || legacyUrl;

  if (!apiKey || !apiUrl) {
    const missing: string[] = [];
    if (!apiKey) missing.push(testMode ? "ASAAS_API_KEY_SANDBOX (ou ASAAS_API_KEY)" : "ASAAS_API_KEY_PROD (ou ASAAS_API_KEY)");
    if (!apiUrl) missing.push(testMode ? "ASAAS_API_URL_SANDBOX (ou ASAAS_API_URL)" : "ASAAS_API_URL_PROD (ou ASAAS_API_URL)");
    throw new Error(`Credenciais de pagamento não configuradas: ${missing.join(", ")}`);
  }

  return { apiKey, apiUrl, env };
}
