import { supabase } from "@/integrations/supabase/client";

export async function logAiUsage(feature: string, tokensUsed: number = 0) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("ai_usage_logs").insert({
      user_id: user.id,
      feature,
      tokens_used: tokensUsed,
    });
  } catch (err) {
    console.error("Failed to log AI usage:", err);
  }
}
