import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Sparkles, Bug, Zap, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const typeConfig: Record<string, { label: string; icon: any; className: string }> = {
  feature: { label: "Feature", icon: Sparkles, className: "bg-emerald-500/15 text-emerald-700 border-emerald-200" },
  bugfix: { label: "Bugfix", icon: Bug, className: "bg-orange-500/15 text-orange-700 border-orange-200" },
  improvement: { label: "Melhoria", icon: Zap, className: "bg-blue-500/15 text-blue-700 border-blue-200" },
};

const Changelog = () => {
  const navigate = useNavigate();

  const { data: changelogs = [], isLoading } = useQuery({
    queryKey: ["changelogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("changelogs")
        .select("*")
        .order("release_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="px-5 pt-4 pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-foreground text-lg">Novidades</h1>
          <p className="text-xs text-muted-foreground">Acompanhe as atualizações do app</p>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : changelogs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma atualização publicada ainda.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />

          <div className="space-y-6">
            {changelogs.map((cl: any, idx: number) => {
              const config = typeConfig[cl.type] ?? typeConfig.feature;
              const IconComponent = config.icon;

              return (
                <div key={cl.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className="absolute left-[9px] top-1 w-3 h-3 rounded-full bg-primary ring-2 ring-background" />

                  <div className="bg-card rounded-xl border p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">v{cl.version}</span>
                        <Badge variant="outline" className={`text-[11px] gap-1 ${config.className}`}>
                          <IconComponent className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {format(toSPTime(parseDateInSP(cl.release_date) ?? new Date()), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{cl.title}</h3>
                    <p className="text-sm text-muted-foreground text-justify whitespace-pre-line leading-relaxed">
                      {cl.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Changelog;
