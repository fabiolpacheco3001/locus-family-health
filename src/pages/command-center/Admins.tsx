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
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<Admin | null>(null);

  // Check if current user is super_admin
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

  // List admins
  const { data: admins, isLoading } = useQuery({
    queryKey: ["admin-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-admins", {
        body: { action: "list" },
      });
      if (error) throw error;
      return (data?.admins ?? []) as Admin[];
    },
  });

  // Promote mutation
  const promoteMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("manage-admins", {
        body: { action: "promote", email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      toast.success("Administrador adicionado com sucesso!");
      setPromoteOpen(false);
      setPromoteEmail("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao promover usuário.");
    },
  });

  // Revoke mutation
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2A5C82]">Administradores</h1>
          <p className="text-sm text-muted-foreground">Gerencie a equipe de administradores da plataforma.</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setPromoteOpen(true)} className="gap-2">
            <UserPlus size={16} />
            Promover Admin
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

      {/* Promote Dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={18} className="text-[#2A5C82]" />
              Promover Administrador
            </DialogTitle>
            <DialogDescription>
              Informe o e-mail de um usuário já cadastrado para conceder acesso administrativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>E-mail do usuário</Label>
              <Input
                type="email"
                placeholder="usuario@exemplo.com"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                className="text-[16px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPromoteOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => promoteMutation.mutate(promoteEmail)}
              disabled={!promoteEmail.trim() || promoteMutation.isPending}
            >
              {promoteMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Promover"
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
