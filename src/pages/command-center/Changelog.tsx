import { parseDateInSP, toSPTime } from "@/lib/dateUtils";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Plus, Loader2, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

const typeBadge = (type: string) => {
  switch (type) {
    case "feature":
      return <Badge className="bg-emerald-500 text-white border-none">Feature</Badge>;
    case "bugfix":
      return <Badge className="bg-orange-500 text-white border-none">Bugfix</Badge>;
    case "improvement":
      return <Badge className="bg-blue-500 text-white border-none">Improvement</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
};

const CCChangelog = () => {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("feature");

  const { data: changelogs = [], isLoading } = useQuery({
    queryKey: ["admin-changelogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("changelogs")
        .select("*")
        .order("release_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const resetForm = () => {
    setVersion("");
    setTitle("");
    setDescription("");
    setType("feature");
  };

  const handlePublish = async () => {
    if (!version.trim() || !title.trim() || !description.trim()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const { data, error } = await supabase.functions.invoke("publish-changelog", {
        body: { version, title, description, type },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      toast.success(`Changelog v${version} publicado! ${data?.notified ?? 0} usuários notificados.`);
      resetForm();
      setSheetOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-changelogs"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao publicar changelog.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2A5C82]">Changelog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publique novas versões e notifique os usuários
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Versão
        </Button>
      </div>

      {/* History */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : changelogs.length === 0 ? (
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum changelog publicado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {changelogs.map((cl: any) => (
            <Card key={cl.id} className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-semibold">v{cl.version}</CardTitle>
                    {typeBadge(cl.type)}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(toSPTime(parseDateInSP(cl.release_date) ?? new Date()), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-sm mb-1">{cl.title}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{cl.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Publish Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2A5C82]" />
              Publicar Nova Versão
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Versão *</label>
                <Input placeholder="1.4.0" value={version} onChange={(e) => setVersion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo *</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="bugfix">Bugfix</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título *</label>
              <Input placeholder="Ex: Novo módulo de Vacinas" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descrição *</label>
              <Textarea
                placeholder="Descreva as mudanças desta versão..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handlePublish} disabled={publishing}>
                {publishing ? <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Publicando...</> : "Publicar e Notificar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CCChangelog;
