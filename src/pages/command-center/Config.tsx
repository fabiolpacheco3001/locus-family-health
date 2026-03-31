import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Zap, ZapOff, Activity, Settings2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type SystemConfig = {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_at: string;
};

const Config = () => {
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<"enable" | "disable" | null>(null);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, string>>({});

  // Fetch AI status
  const { data: aiStatus, isLoading: aiLoading } = useQuery({
    queryKey: ["admin-ai-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "ai_status")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as any)?.is_active ?? true;
    },
  });

  // Fetch AI usage stats (last 30 days)
  const { data: usageStats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-ai-usage-stats"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("feature, tokens_used, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());
      if (error) throw error;
      const totalRequests = data?.length ?? 0;
      const totalTokens = data?.reduce((sum, r) => sum + (r.tokens_used || 0), 0) ?? 0;
      const byFeature: Record<string, number> = {};
      data?.forEach((r) => { byFeature[r.feature] = (byFeature[r.feature] || 0) + 1; });
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const last7 = data?.filter((r) => new Date(r.created_at) >= sevenDaysAgo).length ?? 0;
      return { totalRequests, totalTokens, byFeature, last7Days: last7 };
    },
  });

  // Fetch system_configs
  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ["system-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configs" as any)
        .select("*")
        .order("key");
      if (error) throw error;
      return (data as unknown as SystemConfig[]) ?? [];
    },
  });

  // Save config mutation
  const saveMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from("system_configs" as any)
        .update({ value, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-configs"] });
      toast.success("Configuração salva com sucesso.");
    },
    onError: () => toast.error("Erro ao salvar configuração."),
  });

  // Toggle AI mutation
  const toggleMutation = useMutation({
    mutationFn: async (newStatus: boolean) => {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: { is_active: newStatus }, updated_at: new Date().toISOString() })
        .eq("key", "ai_status");
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-status"] });
      toast.success(newStatus ? "IA reativada com sucesso." : "IA desativada para todos os usuários.");
    },
    onError: () => toast.error("Erro ao alterar status da IA."),
  });

  const handleToggle = () => setConfirmDialog(aiStatus ? "disable" : "enable");

  const confirmToggle = () => {
    toggleMutation.mutate(confirmDialog === "enable");
    setConfirmDialog(null);
  };

  const handleConfigChange = (key: string, value: string) => {
    setEditedConfigs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveConfig = (config: SystemConfig) => {
    const newValue = editedConfigs[config.key] ?? config.value;
    saveMutation.mutate({ id: config.id, value: newValue });
    setEditedConfigs((prev) => { const n = { ...prev }; delete n[config.key]; return n; });
  };

  const configLabels: Record<string, string> = {
    support_url: "URL do Portal de Suporte",
    support_email: "E-mail de Atendimento",
  };

  const featureLabels: Record<string, string> = {
    exame: "Leitura de Exames",
    receita: "Leitura de Receitas",
    vacina: "Importação SUS",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#2A5C82]">Configurações</h1>
      <p className="text-sm text-muted-foreground">Parâmetros do sistema, IA e integrações.</p>

      {/* Global Configs Card */}
      <Card className="border border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="text-[#2A5C82]" size={20} />
            Configurações Globais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {configsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : (
            configs?.map((config) => {
              const currentValue = editedConfigs[config.key] ?? config.value;
              const isDirty = config.key in editedConfigs && editedConfigs[config.key] !== config.value;
              return (
                <div key={config.id} className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {configLabels[config.key] ?? config.key}
                  </label>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                  <div className="flex gap-2">
                    <Input
                      value={currentValue}
                      onChange={(e) => handleConfigChange(config.key, e.target.value)}
                      placeholder={config.key === "support_url" ? "https://suporte.zoho.com/..." : "email@exemplo.com"}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveConfig(config)}
                      disabled={!isDirty || saveMutation.isPending}
                      className="bg-[#2A5C82] hover:bg-[#2A5C82]/90 shrink-0"
                    >
                      {saveMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Kill Switch Card */}
      <Card className={`border-2 transition-colors ${aiStatus === false ? "border-destructive bg-destructive/5" : "border-[#78C2AD]/40"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {aiStatus ? <Zap className="text-[#78C2AD]" size={20} /> : <ZapOff className="text-destructive" size={20} />}
              Motor de Inteligência Artificial
            </CardTitle>
            {aiLoading ? (
              <Skeleton className="h-6 w-11 rounded-full" />
            ) : (
              <Switch checked={aiStatus ?? true} onCheckedChange={handleToggle} disabled={toggleMutation.isPending} className="scale-125" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={aiStatus ? "default" : "destructive"} className={aiStatus ? "bg-[#78C2AD] hover:bg-[#78C2AD]/80" : ""}>
              {aiStatus ? "ATIVO" : "DESATIVADO"}
            </Badge>
            {!aiStatus && (
              <span className="text-xs text-destructive font-medium">Nenhum usuário pode usar funcionalidades de IA</span>
            )}
          </div>
          {aiStatus === false && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-destructive leading-relaxed">
                <strong>ATENÇÃO:</strong> Desligar a IA afeta todos os usuários ativos. As funcionalidades de leitura de receitas, exames e importação do SUS serão bloqueadas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="text-[#2A5C82]" size={20} />
            Uso de IA — Últimos 30 dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-xl text-center">
                <p className="text-3xl font-bold text-[#2A5C82]">{usageStats?.totalRequests ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Requisições totais</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl text-center">
                <p className="text-3xl font-bold text-[#2A5C82]">{usageStats?.last7Days ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Últimos 7 dias</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl text-center">
                <p className="text-3xl font-bold text-[#2A5C82]">{(usageStats?.totalTokens ?? 0).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground mt-1">Tokens consumidos</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl text-center">
                <div className="space-y-1">
                  {Object.entries(usageStats?.byFeature ?? {}).map(([key, count]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{featureLabels[key] ?? key}</span>
                      <span className="font-semibold text-[#2A5C82]">{count}</span>
                    </div>
                  ))}
                  {Object.keys(usageStats?.byFeature ?? {}).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem dados</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Por funcionalidade</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent className="max-w-[340px] rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog === "disable" ? "Desativar IA?" : "Reativar IA?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog === "disable"
                ? "Isso impedirá TODOS os usuários de usar funcionalidades de IA. Dados manuais continuarão funcionando."
                : "A IA será reativada para todos os usuários imediatamente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant={confirmDialog === "disable" ? "destructive" : "default"} onClick={confirmToggle} disabled={toggleMutation.isPending}>
              {confirmDialog === "disable" ? "Desativar" : "Reativar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Config;
