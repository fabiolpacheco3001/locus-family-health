import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MoreHorizontal, Users, Ban, KeyRound, Eye, FlaskConical, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const PAGE_SIZE = 20;

interface ClientRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  status: string | null;
  plan_type: string | null;
  next_billing_date: string | null;
  test_mode: boolean | null;
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
  const [page, setPage] = useState(0);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [blockTarget, setBlockTarget] = useState<ClientRow | null>(null);
  const [trialTarget, setTrialTarget] = useState<ClientRow | null>(null);
  const [trialDays, setTrialDays] = useState("7");
  const [trialPending, setTrialPending] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading, error: queryError } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_clients");
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
    retry: false,
    refetchOnWindowFocus: false,
    // Admin data is non-PHI — 5 min staleTime prevents redundant fetches when
    // navigating between Dashboard and Clientes tabs (same queryKey, shared cache).
    staleTime: 5 * 60 * 1000,
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

  // Reset to page 0 when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleResetPassword = async (client: ClientRow) => {
    if (!client.email) {
      toast.error("E-mail do usuário não disponível.");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("manage-admins", {
        body: { action: "reset", email: client.email },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);
      toast.success(`E-mail de redefinição enviado para ${client.email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail de recuperação.");
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

  const handleSetTrial = async () => {
    if (!trialTarget) return;
    const days = parseInt(trialDays, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      toast.error("Informe um número de dias entre 1 e 365.");
      return;
    }
    setTrialPending(true);
    try {
      const { error } = await supabase.rpc("admin_set_user_trial", {
        target_user_id: trialTarget.user_id,
        days_remaining: days,
      });
      if (error) throw error;
      toast.success(`Plano Grátis de ${days} dia(s) ativado para ${trialTarget.full_name || trialTarget.email}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setTrialTarget(null);
      setTrialDays("7");
    } catch {
      toast.error("Erro ao alterar Plano Grátis. Verifique suas permissões.");
    } finally {
      setTrialPending(false);
    }
  };

  const handleToggleTestMode = async (client: ClientRow) => {
    const newValue = !client.test_mode;
    const { error } = await supabase.rpc("set_user_test_mode", {
      target_user_id: client.user_id,
      enabled: newValue,
    });
    if (error) {
      toast.error("Erro ao alternar modo teste.");
      return;
    }
    toast.success(newValue ? "Modo teste ativado (SANDBOX)." : "Modo produção ativado.");
    queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(toSPTime(parseDateInSP(dateStr.substring(0, 10)) ?? new Date()), "dd/MM/yyyy", { locale: ptBR });
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
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9 bg-white border-gray-200 text-base"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
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
            ) : queryError ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="w-8 h-8 opacity-40" />
                    <p className="text-sm">Não foi possível carregar a lista de clientes no momento.</p>
                  </div>
                </TableCell>
              </TableRow>
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
              paginated.map((client) => (
                <TableRow key={client.user_id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm">{client.full_name || "—"}</p>
                        {client.test_mode && (
                          <Badge className="bg-amber-500 text-white border-none text-[10px] px-1.5 py-0">
                            SANDBOX
                          </Badge>
                        )}
                      </div>
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
                        <DropdownMenuItem
                          className="text-blue-600 focus:text-blue-600"
                          onClick={() => { setTrialTarget(client); setTrialDays("7"); }}
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          Alterar Plano Grátis
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={client.test_mode ? "text-emerald-600 focus:text-emerald-600" : "text-amber-600 focus:text-amber-600"}
                          onClick={() => handleToggleTestMode(client)}
                        >
                          <FlaskConical className="w-4 h-4 mr-2" />
                          {client.test_mode ? "Desativar Modo Teste" : "Ativar Modo Teste (Sandbox)"}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {filtered.length} resultado(s) · página {page + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

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

      {/* Trial Days Dialog */}
      <Dialog open={!!trialTarget} onOpenChange={(open) => !open && setTrialTarget(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#2A5C82]">
              <Clock size={18} aria-hidden="true" />
              Alterar Plano Grátis
            </DialogTitle>
            <DialogDescription>
              Define quantos dias de acesso gratuito o usuário{" "}
              <strong>{trialTarget?.full_name || trialTarget?.email}</strong> terá a partir de agora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="trial-days">Dias de trial</Label>
            <Input
              id="trial-days"
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              className="text-base w-28"
            />
            <p className="text-xs text-muted-foreground">Entre 1 e 365 dias a partir de agora.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSetTrial} disabled={trialPending}>
              {trialPending ? <Loader2 size={16} className="animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
