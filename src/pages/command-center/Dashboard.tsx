import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, TrendingUp, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

const MONTHLY_PRICE = 19.9;
const ANNUAL_PRICE = 191.0;

const Dashboard = () => {
  const { data: metrics } = useQuery({
    queryKey: ["admin-dashboard-metrics"],
    queryFn: async () => {
      // Parallel fetch: subscriptions + titulares (for implicit trial count)
      const [subsRes, titularesRes] = await Promise.all([
        supabase.from("subscriptions").select("status, plan_type, user_id"),
        supabase
          .from("family_members")
          .select("user_id, created_at")
          .in("relationship", ["Eu", "Titular"])
          .is("deleted_at", null),
      ]);

      if (subsRes.error) throw subsRes.error;
      if (titularesRes.error) throw titularesRes.error;

      const subs = subsRes.data ?? [];
      const titulares = titularesRes.data ?? [];

      const activeSubs = subs.filter((s) => s.status === "active");

      // MRR: R$19,90 per monthly + R$191/12 per annual
      const mrr = activeSubs.reduce((acc, s) => {
        if (s.plan_type === "monthly" || s.plan_type === "mensal") return acc + MONTHLY_PRICE;
        if (s.plan_type === "annual" || s.plan_type === "anual" || s.plan_type === "yearly") return acc + ANNUAL_PRICE / 12;
        return acc;
      }, 0);

      // Titulares with subscription user_ids
      const subUserIds = new Set(subs.map((s: any) => s.user_id));

      // Build set of user_ids that have ANY subscription
      const allSubsRes = await supabase.from("subscriptions").select("user_id");
      const allSubUserIds = new Set((allSubsRes.data ?? []).map((s: any) => s.user_id));

      // Implicit trial: titulares without subscription, created <= 30 days ago
      const now = new Date();
      const implicitTrials = titulares.filter((t) => {
        if (allSubUserIds.has(t.user_id)) return false;
        const days = differenceInDays(now, new Date(t.created_at));
        return days <= 30;
      });

      return {
        totalTitulares: titulares.length,
        activePremium: activeSubs.length,
        mrr,
        implicitTrials: implicitTrials.length,
      };
    },
  });

  const stats = [
    {
      label: "Total de Titulares",
      value: metrics?.totalTitulares ?? 0,
      icon: Users,
      color: "text-[#2A5C82]",
    },
    {
      label: "Assinaturas Premium",
      value: metrics?.activePremium ?? 0,
      icon: CreditCard,
      color: "text-[#78C2AD]",
    },
    {
      label: "MRR Estimado",
      value: `R$ ${(metrics?.mrr ?? 0).toFixed(2).replace(".", ",")}`,
      icon: TrendingUp,
      color: "text-[#F2A97F]",
    },
    {
      label: "Plano Grátis (Trial)",
      value: metrics?.implicitTrials ?? 0,
      icon: Clock,
      color: "text-[#2A5C82]",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2A5C82]">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do Locus Vita</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <div className={`p-2 rounded-full bg-primary/10 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="text-sm">
            Gráficos de evolução e métricas avançadas serão implementados nas próximas fases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
