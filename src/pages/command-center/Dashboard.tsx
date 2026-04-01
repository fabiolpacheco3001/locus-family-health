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
      const { data, error } = await supabase.rpc("get_admin_clients");
      if (error) throw error;
      const clients = data ?? [];

      const activeSubs = clients.filter((c: any) => c.status === "active");

      const mrr = activeSubs.reduce((acc: number, c: any) => {
        if (c.plan_type === "monthly" || c.plan_type === "mensal") return acc + MONTHLY_PRICE;
        if (c.plan_type === "annual" || c.plan_type === "anual" || c.plan_type === "yearly") return acc + ANNUAL_PRICE / 12;
        return acc;
      }, 0);

      const now = new Date();
      const implicitTrials = clients.filter((c: any) => {
        if (c.status === "active" || c.status === "suspended" || c.status === "canceled") return false;
        if (c.status) return false; // any other explicit status
        return differenceInDays(now, new Date(c.created_at)) <= 30;
      });

      return {
        totalClients: clients.length,
        activePremium: activeSubs.length,
        mrr,
        implicitTrials: implicitTrials.length,
      };
    },
    retry: false,
    refetchOnWindowFocus: false,
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
