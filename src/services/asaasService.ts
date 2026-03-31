import { supabase } from "@/integrations/supabase/client";

export async function createSubscription(planType: "monthly" | "annual"): Promise<string> {
  let session;
  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data?.session) {
      throw new Error("Sessão não encontrada. Por favor, faça login novamente.");
    }
    session = data.session;
  } catch (e: any) {
    throw new Error(e?.message || "Sessão não encontrada. Por favor, faça login novamente.");
  }

  let data: any;
  let error: any;
  try {
    const result = await supabase.functions.invoke("create-asaas-checkout", {
      body: { planType },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    data = result.data;
    error = result.error;
  } catch (invokeErr: any) {
    console.error("Error invoking checkout function:", invokeErr);
    throw new Error("Não foi possível conectar ao servidor de pagamento. Tente novamente.");
  }

  if (error) {
    console.error("Error creating checkout:", error);
    let detail = "";
    try {
      if (data && typeof data === "object") {
        detail = (data as any).error || (data as any).message || "";
      }
    } catch (_) { /* ignore */ }
    throw new Error(detail || error.message || "Não foi possível criar o link de pagamento.");
  }

  if (!data?.url) {
    throw new Error("URL de pagamento não retornada.");
  }

  return data.url as string;
}
