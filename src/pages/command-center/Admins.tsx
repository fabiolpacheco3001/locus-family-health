import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, ShieldAlert, UserPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Admin {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const Admins = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<string>("admin");
  const [revokeTarget, setRevokeTarget] = useState<Admin | null>(null);

  const { data: currentRole } = useQuery({
    queryKey: ["current-admin-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", user!.id)
        .maybeSingle();
      return data?.role ?? "customer";
    },
    enabled: !!user,
  });

  const isSuperAdmin = currentRole === "super_admin";

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admin-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-admins", {
        body: { action: "list" },
      });
      if (error) throw error;
      return (data?.admins ?? []) as Admin[];
    },
    // Edge Function has Deno cold start (~400-600ms). 5 min staleTime avoids
    // redundant invocations when navigating back to this tab.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { email: string; password: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-admins", {
        body: { action: "create", ...payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      toast.success("Conta criada com sucesso!");
      setCreateOpen(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("admin");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar administrador.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-admins", {
        body: { action: "revoke", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      toast.success("Acesso administrativo revogado.");
      setRevokeTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao revogar acesso.");
    },
  });

  const canSubmitCreate = createEmail.trim() && createPassword.length >= 6 && createRole;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2A5C82]">Administradores</h1>
          <p className="text-sm text-muted-foreground">Gerencie a equipe de administradores da plataforma.</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus size={16} />
            Adicionar Admin
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="text-[#2A5C82]" size={20} />
            Equipe Administrativa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Desde</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins?.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={admin.role === "super_admin" ? "default" : "secondary"}
                        className={admin.role === "super_admin" ? "bg-[#2A5C82]" : ""}
                      >
                        {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(admin.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        {admin.role !== "super_admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRevokeTarget(admin)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(!admins || admins.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 4 : 3} className="text-center text-muted-foreground py-8">
                      Nenhum administrador encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Admin Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={18} className="text-[#2A5C82]" />
              Criar Novo Administrador
            </DialogTitle>
            <DialogDescription>
              Crie uma conta diretamente. O novo administrador poderá acessar o Command Center com as credenciais abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="admin@empresa.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="text-[16px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha Temporária</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="text-[16px]"
              />
              {createPassword.length > 0 && createPassword.length < 6 && (
                <p className="text-xs text-destructive">A senha deve ter no mínimo 6 caracteres.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="super_admin">Super Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate({ email: createEmail, password: createPassword, role: createRole })}
              disabled={!canSubmitCreate || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Criar Conta"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent className="max-w-[340px] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-destructive" />
              Revogar Acesso
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o acesso administrativo de{" "}
              <strong>{revokeTarget?.email}</strong>? O usuário voltará ao cargo de cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Revogar"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admins;
