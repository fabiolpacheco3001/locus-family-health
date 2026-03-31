import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MoreHorizontal, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  trial_end: string | null;
  next_billing_date: string | null;
  created_at: string;
  asaas_customer_id: string | null;
  user_name?: string;
}

const planBadge = (plan: string) => {
  switch (plan) {
    case "monthly":
      return <Badge className="bg-[#78C2AD] text-white border-none">Mensal</Badge>;
    case "annual":
      return <Badge className="bg-[#F2A97F] text-white border-none">Anual</Badge>;
    default:
      return <Badge variant="secondary" className="bg-gray-200 text-gray-700 border-none">Free</Badge>;
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <Badge className="bg-emerald-500 text-white border-none">Ativo</Badge>;
    case "trialing":
      return <Badge className="bg-amber-400 text-gray-900 border-none">Trial</Badge>;
    case "past_due":
      return <Badge className="bg-red-500 text-white border-none">Inadimplente</Badge>;
    case "canceled":
      return <Badge variant="secondary" className="bg-gray-300 text-gray-600 border-none">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const Clientes = () => {
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<SubscriptionRow | null>(null);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = (subs ?? []).map((s: any) => s.user_id);
      const { data: members } = await supabase
        .from("family_members")
        .select("user_id, name, relationship")
        .in("user_id", userIds)
        .eq("relationship", "Eu");

      const memberMap = new Map<string, string>();
      (members ?? []).forEach((m: any) => memberMap.set(m.user_id, m.name));

      return (subs ?? []).map((s: any) => ({
        ...s,
        user_name: memberMap.get(s.user_id) || null,
      })) as SubscriptionRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return subscriptions;
    const q = search.toLowerCase();
    return subscriptions.filter(
      (s) =>
        s.user_name?.toLowerCase().includes(q) ||
        s.user_id.toLowerCase().includes(q) ||
        s.asaas_customer_id?.toLowerCase().includes(q)
    );
  }, [subscriptions, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2A5C82]">Gestão de Clientes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie assinaturas e acompanhe o ciclo de vida dos usuários.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white border-gray-200"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="font-semibold text-[#2A5C82]">Usuário</TableHead>
              <TableHead className="font-semibold text-[#2A5C82]">Plano</TableHead>
              <TableHead className="font-semibold text-[#2A5C82]">Status</TableHead>
              <TableHead className="font-semibold text-[#2A5C82]">Próxima Cobrança</TableHead>
              <TableHead className="font-semibold text-[#2A5C82]">Asaas ID</TableHead>
              <TableHead className="font-semibold text-[#2A5C82] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Carregando clientes...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="w-8 h-8 opacity-40" />
                    <p className="text-sm">
                      {search ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente cadastrado ainda."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground text-sm">{sub.user_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{sub.user_id.slice(0, 8)}...</p>
                    </div>
                  </TableCell>
                  <TableCell>{planBadge(sub.plan_type)}</TableCell>
                  <TableCell>{statusBadge(sub.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sub.next_billing_date
                      ? format(parseISO(sub.next_billing_date), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {sub.asaas_customer_id || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedClient(sub)}>
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => toast.info("Funcionalidade de bloqueio em desenvolvimento.")}
                        >
                          Bloquear Acesso
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Client Detail Sheet */}
      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-[#2A5C82]">Detalhes do Cliente</SheetTitle>
          </SheetHeader>
          {selectedClient && (
            <div className="space-y-5 mt-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="font-medium text-foreground">{selectedClient.user_name || "Não informado"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">User ID</p>
                <p className="text-sm font-mono text-foreground break-all">{selectedClient.user_id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Plano</p>
                  {planBadge(selectedClient.plan_type)}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  {statusBadge(selectedClient.status)}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Asaas Customer ID</p>
                <p className="text-sm font-mono text-foreground">{selectedClient.asaas_customer_id || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cadastro</p>
                  <p className="text-sm text-foreground">
                    {format(parseISO(selectedClient.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Próxima Cobrança</p>
                  <p className="text-sm text-foreground">
                    {selectedClient.next_billing_date
                      ? format(parseISO(selectedClient.next_billing_date), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
              </div>
              {selectedClient.trial_end && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Fim do Trial</p>
                  <p className="text-sm text-foreground">
                    {format(parseISO(selectedClient.trial_end), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Clientes;
