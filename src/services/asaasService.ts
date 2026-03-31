import { supabase } from "@/integrations/supabase/client";

export async function createSubscription(planType: "monthly" | "annual"): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-asaas-checkout", {
    body: { planType },
  });

  if (error) {
    console.error("Error creating checkout:", error);
    throw new Error("Não foi possível criar o link de pagamento. Tente novamente.");
  }

  if (!data?.url) {
    throw new Error("URL de pagamento não retornada.");
  }

  return data.url as string;
}
