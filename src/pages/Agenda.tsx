import { useNavigate } from "react-router-dom";
import { Calendar, Stethoscope } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AgendaItem = {
  id: string;
  family_member_id: string;
  specialty: string;
  professional_name: string | null;
  consultation_date: string | null;
  type: string | null;
  status: string;
  family_members: { name: string } | null;
};

const Agenda = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["agenda", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("id, family_member_id, specialty, professional_name, consultation_date, type, status, family_members(name)")
        .eq("user_id", user!.id)
        .order("consultation_date", { ascending: true });
      if (error) throw error;
      return data as AgendaItem[];
    },
    enabled: !!user,
  });

  return (
    <div className="px-4 pt-6 pb-28 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground mb-6">Agenda</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Calendar className="text-primary" size={28} />
          </div>
          <p className="text-foreground font-semibold mb-1">Nenhum compromisso</p>
          <p className="text-muted-foreground text-sm">
            Sua família não tem compromissos agendados no momento.
          </p>
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          {items.map((item) => {
            const memberName = item.family_members?.name ?? "Familiar";
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/familiar/${item.family_member_id}/consultas`, { state: { from: '/agenda' } })}
                className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm text-left hover:bg-accent/50 transition-colors w-full"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Stethoscope className="text-primary" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  {item.consultation_date && (
                    <p className="text-sm font-bold text-primary mb-1">
                      {format(new Date(item.consultation_date), "dd MMM yyyy '-' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-secondary/20 text-secondary text-[10px] font-bold">
                        {memberName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">{memberName}</span>
                  </div>
                  <p className="text-sm text-foreground truncate">
                    {item.specialty}
                    {item.professional_name ? ` com ${item.professional_name}` : ""}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {item.type && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          item.type === "Emergência"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-secondary/10 text-secondary border-secondary/20"
                        }`}
                      >
                        {item.type}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        item.status === "Agendada"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : item.status === "Realizada"
                          ? "bg-secondary/10 text-secondary border-secondary/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Agenda;
