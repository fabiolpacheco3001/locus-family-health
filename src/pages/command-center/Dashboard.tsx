import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, TrendingUp, Clock } from "lucide-react";

const Dashboard = () => {
  const { data: metrics } = useQuery({
    queryKey: ["admin-dashboard-metrics"],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("status, plan_type");

      if (error) throw error;
      const all = subs ?? [];

      return {
        total: all.length,
        active: all.filter((s) => s.status === "active").length,
        trialing: all.filter((s) => s.status === "trialing").length,
      };
    },
  });

  const stats = [
    {
      label: "Total de Clientes",
      value: metrics?.total ?? 0,
      icon: Users,
      color: "text-[#2A5C82]",
    },
    {
      label: "Assinaturas Ativas",
      value: metrics?.active ?? 0,
      icon: CreditCard,
      color: "text-[#78C2AD]",
    },
    {
      label: "MRR Estimado",
      value: "R$ 0,00",
      icon: TrendingUp,
      color: "text-[#F2A97F]",
    },
    {
      label: "Em Período de Teste",
      value: metrics?.trialing ?? 0,
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
