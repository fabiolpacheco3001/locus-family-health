import { supabase } from "@/integrations/supabase/client";

export async function createSubscription(planType: "monthly" | "annual"): Promise<string> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Sessão não encontrada. Por favor, faça login novamente.");
  }

  const { data, error } = await supabase.functions.invoke("create-asaas-checkout", {
    body: { planType },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error("Error creating checkout:", error);
    // Try to extract detailed message from the response body
    let detail = "";
    try {
      if (data && typeof data === "object") {
        detail = (data as any).error || (data as any).message || "";
      }
    } catch (_) { /* ignore parse errors */ }
    throw new Error(detail || error.message || "Não foi possível criar o link de pagamento. Tente novamente.");
  }

  if (!data?.url) {
    throw new Error("URL de pagamento não retornada.");
  }

  return data.url as string;
}
