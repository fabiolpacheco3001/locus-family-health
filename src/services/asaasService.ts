import { supabase } from "@/integrations/supabase/client";

export async function createSubscription(planType: "monthly" | "annual"): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData?.session) {
    throw new Error("Sessão não encontrada. Por favor, faça login novamente.");
  }

  const session = sessionData.session;

  let responseData: any;
  let responseError: any;

  try {
    const result = await supabase.functions.invoke("create-asaas-checkout", {
      body: { planType },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
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
        detail = responseData.error || responseData.message || "";
      }
    } catch (_) { /* ignore */ }
    throw new Error(detail || responseError.message || "Não foi possível criar o link de pagamento.");
  }

  if (!responseData?.url) {
    throw new Error("URL de pagamento não retornada.");
  }

  return responseData.url as string;
}
