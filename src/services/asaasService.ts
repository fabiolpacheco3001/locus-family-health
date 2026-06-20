import { supabase } from "@/integrations/supabase/client";
import { captureException } from "@/lib/sentry";

export async function createSubscription(planType: "monthly" | "annual"): Promise<string> {
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

  if (refreshError || !refreshData?.session) {
    throw new Error("Sessão inválida. Faça login novamente para assinar.");
  }

  const token = refreshData.session.access_token;

  let responseData: any;
  let responseError: any;

  try {
    const result = await supabase.functions.invoke("create-asaas-checkout", {
      body: { planType },
      headers: {
        Authorization: `Bearer ${token}`,
        "x-request-id": crypto.randomUUID(),
      },
    });
    responseData = result.data;
    responseError = result.error;
  } catch (invokeErr: any) {
    captureException(invokeErr, { context: "asaasService.createSubscription.invoke", planType });
    throw new Error("Não foi possível conectar ao servidor de pagamento. Tente novamente.");
  }

  if (responseError) {
    captureException(responseError, { context: "asaasService.createSubscription.response", planType });
    let detail = "";
    let debugInfo = "";
    try {
      if (responseData && typeof responseData === "object") {
        detail = (responseData as any).error || (responseData as any).message || "";
        // Campo debug contém o erro bruto do Asaas (ex: "asaas_error:400:{...}")
        const rawDebug = (responseData as any).debug as string | undefined;
        if (rawDebug?.startsWith("asaas_error:")) {
          // Extrair só o body JSON após "asaas_error:STATUS:"
          const thirdColon = rawDebug.indexOf(":", rawDebug.indexOf(":") + 1);
          debugInfo = rawDebug.slice(thirdColon + 1);
        }
      }
      if (!detail && (responseError as any).context) {
        const ctx = await (responseError as any).context.json().catch(() => null);
        detail = ctx?.error || ctx?.message || "";
      }
    } catch (_) { /* ignore */ }
    const reason = detail || responseError.message || "Desconhecido";
    throw new Error(`Erro do servidor financeiro: ${reason}${debugInfo ? ` | Asaas: ${debugInfo}` : ""}`);
  }

  if (responseData?.error) {
    throw new Error(`Erro do servidor financeiro: ${responseData.error}`);
  }

  if (!responseData?.url) {
    throw new Error("URL de pagamento não retornada.");
  }

  return responseData.url as string;
}
