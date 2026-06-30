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
    let detail = "";
    let debugInfo = "";
    let errorCode = "";
    try {
      if (responseData && typeof responseData === "object") {
        detail    = (responseData as any).error   || (responseData as any).message || "";
        errorCode = (responseData as any).code    || "";
        // Campo debug contém o erro bruto do Asaas (ex: "asaas_error:400:{...}")
        const rawDebug = (responseData as any).debug as string | undefined;
        if (rawDebug) {
          if (rawDebug.startsWith("asaas_error:")) {
            // Extrair só o body JSON após "asaas_error:STATUS:"
            const thirdColon = rawDebug.indexOf(":", rawDebug.indexOf(":") + 1);
            debugInfo = rawDebug.slice(thirdColon + 1);
          } else {
            // Erro pré-Asaas (ex: credenciais faltando, erro de rede) — usar mensagem direta
            debugInfo = rawDebug;
          }
        }
      }
      if (!detail && (responseError as any).context) {
        const ctx = await (responseError as any).context.json().catch(() => null);
        detail    = ctx?.error || ctx?.message || "";
        errorCode = ctx?.code  || errorCode;
        // Fix: Supabase functions-js retorna data=null em respostas 400; ler debug do context.json
        if (!debugInfo && ctx?.debug) {
          const rawDebugCtx = ctx.debug as string;
          if (rawDebugCtx.startsWith("asaas_error:")) {
            const thirdColon = rawDebugCtx.indexOf(":", rawDebugCtx.indexOf(":") + 1);
            debugInfo = rawDebugCtx.slice(thirdColon + 1);
          } else {
            debugInfo = rawDebugCtx;
          }
        }
      }
    } catch (_) { /* ignore */ }

    // 422 "missing_cpf": erro de dados do usuário, não falha de servidor.
    // Não reportar ao Sentry — mostrar mensagem orientativa.
    if (errorCode === "missing_cpf") {
      throw new Error(detail || "Por favor, cadastre seu CPF em Ajustes → Meus Dados antes de assinar.");
    }

    // debug não é mais retornado ao cliente (removido por segurança — ver SEC-003)
    // requestId fica no Sentry context para correlação com logs da edge function
    const requestId = (responseData as Record<string, unknown>)?.requestId as string | undefined;
    captureException(responseError, {
      context: "asaasService.createSubscription.response",
      planType,
      asaasError: detail   || undefined,
      asaasDebug: debugInfo || undefined,
      requestId: requestId || undefined,
    });
    const reason = detail || responseError.message || "Desconhecido";
    throw new Error(`Erro do servidor financeiro: ${reason}`);
  }

  if (responseData?.error) {
    throw new Error(`Erro do servidor financeiro: ${responseData.error}`);
  }

  if (!responseData?.url) {
    throw new Error("URL de pagamento não retornada.");
  }

  return responseData.url as string;
}
