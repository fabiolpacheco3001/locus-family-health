import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MoreHorizontal, Users, Ban, KeyRound, Eye } from "lucide-react";
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
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ClientRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  status: string | null;
  plan_type: string | null;
  next_billing_date: string | null;
}

const planStatusBadge = (client: ClientRow) => {
  if (client.status === "active") {
    const label = client.plan_type === "annual" || client.plan_type === "yearly"
      ? "Premium Anual" : "Premium Mensal";
    return <Badge className="bg-emerald-500 text-white border-none">{label}</Badge>;
  }
  if (client.status === "suspended" || client.status === "canceled") {
    return <Badge variant="destructive" className="border-none">Bloqueado</Badge>;
  }
  if (client.status === "past_due") {
    return <Badge className="bg-red-500 text-white border-none">Inadimplente</Badge>;
  }
  if (client.status === "trialing") {
    return <Badge className="bg-amber-400 text-gray-900 border-none">Trial</Badge>;
  }
  if (client.status) {
    return <Badge variant="outline">{client.status}</Badge>;
  }

  // No subscription → implicit free plan
  const daysUsed = differenceInDays(new Date(), new Date(client.created_at));
  const remaining = 30 - daysUsed;

  if (remaining > 0) {
    return (
      <Badge className="bg-[#2A5C82] text-white border-none">
        Plano Grátis ({remaining}d restantes)
      </Badge>
    );
  }
  return <Badge className="bg-red-500 text-white border-none">Expirado</Badge>;
};

const Clientes = () => {
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [blockTarget, setBlockTarget] = useState<ClientRow | null>(null);
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_clients");
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.user_id.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const handleResetPassword = async (client: ClientRow) => {
    if (!client.email) {
      toast.error("E-mail do usuário não disponível.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(client.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(`E-mail de recuperação enviado para ${client.email}.`);
    } catch {
      toast.error("Erro ao enviar e-mail de recuperação.");
    }
  };

  const handleBlockUser = async () => {
    if (!blockTarget) return;
    if (!blockTarget.status) {
      toast.error("Usuário não possui assinatura para bloquear.");
      setBlockTarget(null);
      return;
    }
    const newStatus = blockTarget.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("user_id", blockTarget.user_id);

    if (error) {
      toast.error("Erro ao atualizar status do usuário.");
    } else {
      toast.success(newStatus === "suspended" ? "Usuário bloqueado." : "Usuário desbloqueado.");
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    }
    setBlockTarget(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr.substring(0, 10) + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  const tableSkeletons = (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-8 w-32" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );

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
          placeholder="Buscar por nome, e-mail ou ID..."
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
              <TableHead className="font-semibold text-[#2A5C82]">Plano / Status</TableHead>
              <TableHead className="font-semibold text-[#2A5C82]">Próxima Cobrança</TableHead>
              <TableHead className="font-semibold text-[#2A5C82] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              tableSkeletons
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="w-8 h-8 opacity-40" />
                    <p className="text-sm">
                      {search ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente cadastrado ainda."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => (
                <TableRow key={client.user_id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground text-sm">{client.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{client.email || client.user_id.slice(0, 8) + "..."}</p>
                    </div>
                  </TableCell>
                  <TableCell>{planStatusBadge(client)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(client.next_billing_date)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedClient(client)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(client)}>
                          <KeyRound className="w-4 h-4 mr-2" />
                          Resetar Senha
                        </DropdownMenuItem>
                        {client.status && (
                          <DropdownMenuItem
                            className={client.status === "suspended" ? "text-emerald-600 focus:text-emerald-600" : "text-red-600 focus:text-red-600"}
                            onClick={() => setBlockTarget(client)}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            {client.status === "suspended" ? "Desbloquear" : "Bloquear Acesso"}
                          </DropdownMenuItem>
                        )}
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
                <p className="font-medium text-foreground">{selectedClient.full_name || "Não informado"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm text-foreground">{selectedClient.email || "Não disponível"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">User ID</p>
                <p className="text-sm font-mono text-foreground break-all">{selectedClient.user_id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Plano / Status</p>
                  {planStatusBadge(selectedClient)}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cadastro</p>
                  <p className="text-sm text-foreground">{formatDate(selectedClient.created_at)}</p>
                </div>
              </div>
              {selectedClient.next_billing_date && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Próxima Cobrança</p>
                  <p className="text-sm text-foreground">{formatDate(selectedClient.next_billing_date)}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Block Confirm Dialog */}
      <AlertDialog open={!!blockTarget} onOpenChange={() => setBlockTarget(null)}>
        <AlertDialogContent className="max-w-[340px] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockTarget?.status === "suspended" ? "Desbloquear Usuário?" : "Bloquear Usuário?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockTarget?.status === "suspended"
                ? `Deseja restaurar o acesso de ${blockTarget?.full_name || blockTarget?.email || "este usuário"}?`
                : `Deseja suspender o acesso de ${blockTarget?.full_name || blockTarget?.email || "este usuário"}? Ele não poderá usar o app enquanto estiver bloqueado.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant={blockTarget?.status === "suspended" ? "default" : "destructive"}
              onClick={handleBlockUser}
            >
              {blockTarget?.status === "suspended" ? "Desbloquear" : "Bloquear"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clientes;
