import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  trial_end: string | null;
  next_billing_date: string | null;
  asaas_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!user?.id,
  });

  const isTrialing = subscription?.status === "trialing";
  const isActive = subscription?.status === "active";
  const isPastDue = subscription?.status === "past_due";
  const isCanceled = subscription?.status === "canceled";

  const trialDaysLeft = (() => {
    if (!isTrialing || !subscription?.trial_end) return 0;
    const diff = new Date(subscription.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const trialExpired = isTrialing && trialDaysLeft <= 0;

  const canUsePremium = isActive || (isTrialing && !trialExpired);

  return {
    subscription,
    isLoading,
    isTrialing,
    isActive,
    isPastDue,
    isCanceled,
    trialDaysLeft,
    trialExpired,
    canUsePremium,
  };
}
