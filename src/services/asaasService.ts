import { supabase } from "@/integrations/supabase/client";

export async function createSubscription(planType: "monthly" | "annual"): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Usuário não autenticado. Faça login novamente.");
  }

  const { data, error } = await supabase.functions.invoke("create-asaas-checkout", {
    body: { planType },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error("Error creating checkout:", error);
    const detail = (data as any)?.error || (data as any)?.message || error.message || "";
    throw new Error(detail || "Não foi possível criar o link de pagamento. Tente novamente.");
  }

  if (!data?.url) {
    throw new Error("URL de pagamento não retornada.");
  }

  return data.url as string;
}
