import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
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

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  trial_end: string | null;
  next_billing_date: string | null;
  created_at: string;
  asaas_customer_id: string | null;
  user_name: string | null;
  user_email: string | null;
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
    case "suspended":
      return <Badge variant="destructive" className="border-none">Bloqueado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const Clientes = () => {
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<SubscriptionRow | null>(null);
  const [blockTarget, setBlockTarget] = useState<SubscriptionRow | null>(null);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      // Single query: fetch all subscriptions
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!subs?.length) return [] as SubscriptionRow[];

      // Batch fetch names for all user_ids in one go
      const userIds = subs.map((s: any) => s.user_id);
      const { data: members } = await supabase
        .from("family_members")
        .select("user_id, name")
        .in("user_id", userIds)
        .eq("relationship", "Eu");

      const nameMap = new Map<string, string>();
      (members ?? []).forEach((m: any) => nameMap.set(m.user_id, m.name));

      // Batch fetch emails via edge function
      let emailMap = new Map<string, string>();
      try {
        const { data: emailData } = await supabase.functions.invoke("manage-admins", {
          body: { action: "list-emails", userIds },
        });
        if (emailData?.emails) {
          (emailData.emails as { id: string; email: string }[]).forEach((e) =>
            emailMap.set(e.id, e.email)
          );
        }
      } catch {
        // Fallback: no emails
      }

      return subs.map((s: any) => ({
        ...s,
        user_name: nameMap.get(s.user_id) || null,
        user_email: emailMap.get(s.user_id) || null,
      })) as SubscriptionRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return subscriptions;
    const q = search.toLowerCase();
    return subscriptions.filter(
      (s) =>
        s.user_name?.toLowerCase().includes(q) ||
        s.user_email?.toLowerCase().includes(q) ||
        s.user_id.toLowerCase().includes(q)
    );
  }, [subscriptions, search]);

  const handleResetPassword = async (sub: SubscriptionRow) => {
    if (!sub.user_email) {
      toast.error("E-mail do usuário não disponível.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(sub.user_email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(`E-mail de recuperação enviado para ${sub.user_email}.`);
    } catch {
      toast.error("Erro ao enviar e-mail de recuperação.");
    }
  };

  const handleBlockUser = async () => {
    if (!blockTarget) return;
    const newStatus = blockTarget.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", blockTarget.id);

    if (error) {
      toast.error("Erro ao atualizar status do usuário.");
    } else {
      toast.success(newStatus === "suspended" ? "Usuário bloqueado." : "Usuário desbloqueado.");
      // Refresh list
      window.location.reload();
    }
    setBlockTarget(null);
  };

  const tableSkeletons = (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-8 w-32" /></TableCell>
          <TableCell><Skeleton className="h-6 w-16" /></TableCell>
          <TableCell><Skeleton className="h-6 w-16" /></TableCell>
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
              <TableHead className="font-semibold text-[#2A5C82]">Plano</TableHead>
              <TableHead className="font-semibold text-[#2A5C82]">Status</TableHead>
              <TableHead className="font-semibold text-[#2A5C82]">Próxima Cobrança</TableHead>
              <TableHead className="font-semibold text-[#2A5C82] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              tableSkeletons
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
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
                      <p className="text-xs text-muted-foreground">{sub.user_email || sub.user_id.slice(0, 8) + "..."}</p>
                    </div>
                  </TableCell>
                  <TableCell>{planBadge(sub.plan_type)}</TableCell>
                  <TableCell>{statusBadge(sub.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sub.next_billing_date
                      ? format(new Date(sub.next_billing_date.substring(0, 10) + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
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
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(sub)}>
                          <KeyRound className="w-4 h-4 mr-2" />
                          Resetar Senha
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={sub.status === "suspended" ? "text-emerald-600 focus:text-emerald-600" : "text-red-600 focus:text-red-600"}
                          onClick={() => setBlockTarget(sub)}
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          {sub.status === "suspended" ? "Desbloquear" : "Bloquear Acesso"}
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
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm text-foreground">{selectedClient.user_email || "Não disponível"}</p>
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

      {/* Block Confirm Dialog */}
      <AlertDialog open={!!blockTarget} onOpenChange={() => setBlockTarget(null)}>
        <AlertDialogContent className="max-w-[340px] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockTarget?.status === "suspended" ? "Desbloquear Usuário?" : "Bloquear Usuário?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockTarget?.status === "suspended"
                ? `Deseja restaurar o acesso de ${blockTarget?.user_name || blockTarget?.user_email || "este usuário"}?`
                : `Deseja suspender o acesso de ${blockTarget?.user_name || blockTarget?.user_email || "este usuário"}? Ele não poderá usar o app enquanto estiver bloqueado.`}
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
