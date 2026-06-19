import { supabase } from "@/integrations/supabase/client";

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
      },
    });
    responseData = result.data;
    responseError = result.error;
  } catch (invokeErr: any) {
    console.error("Error invoking checkout function:", invokeErr);
    throw new Error("Não foi possível conectar ao servidor de pagamento. Tente novamente.");
  }

  if (responseError) {
    console.error("Error creating checkout:", responseError);
    let detail = "";
    try {
      if (responseData && typeof responseData === "object") {
        detail = (responseData as any).error || (responseData as any).message || "";
      }
      if (!detail && (responseError as any).context) {
        const ctx = await (responseError as any).context.json().catch(() => null);
        detail = ctx?.error || ctx?.message || "";
      }
    } catch (_) { /* ignore */ }
    const reason = detail || responseError.message || "Desconhecido";
    throw new Error(`Erro do servidor financeiro: ${reason}`);
  }

  if (!responseData?.url) {
    throw new Error("URL de pagamento não retornada.");
  }

  return responseData.url as string;
}
