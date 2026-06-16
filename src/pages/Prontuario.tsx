import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import useSmartBack from "@/hooks/useSmartBack";
import { ArrowLeft, Lock, Droplet, Weight, Ruler, Calculator, AlertTriangle, HeartPulse, Clock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MemberAvatar from "@/components/MemberAvatar";
import ClinicalTimeline from "@/components/ClinicalTimeline";
import { useClinicalTimeline } from "@/hooks/useClinicalTimeline";
import type { FamilyMember } from "@/hooks/useFamilyMembers";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
// generateProntuarioPdf loaded on-demand (A13: ~250KB jspdf bundle excluded from initial load)
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const calculateAge = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const Prontuario = () => {
  const { id } = useParams();
  const goBack = useSmartBack();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, linkedMemberId, managedProfiles, isLoading: groupLoading } = useFamilyGroup();
  const { data: timeline = [], isLoading: timelineLoading } = useClinicalTimeline(id);
  const [showPrivacyAlert, setShowPrivacyAlert] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);

  // Load logo as base64 for PDF
  useEffect(() => {
    fetch("/logo-locus-vita-pdf.png")
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  // Fetch emitter's display name from family_members (own profile)
  const { data: emitterProfile } = useQuery({
    queryKey: ["emitter_profile", user?.id],
    queryFn: async () => {
      if (linkedMemberId) {
        const { data } = await supabase
          .from("family_members")
          .select("name")
          .eq("id", linkedMemberId)
          .maybeSingle();
        return data?.name || null;
      }
      return null;
    },
    enabled: !!user && !!linkedMemberId,
  });

  useEffect(() => {
    if (groupLoading) return;
    if (!isAdmin && id) {
      const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])].filter(Boolean);
      if (!allowedIds.includes(id)) {
        toast.error("Acesso negado");
        navigate("/home", { replace: true });
      }
    }
  }, [groupLoading, isAdmin, id, linkedMemberId, managedProfiles, navigate]);

  const { data: member, isLoading } = useQuery({
    queryKey: ["family_member", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as FamilyMember & { weight: number | null; height: number | null; physical_activity: string | null };
    },
    enabled: !!id,
  });

  const { data: allergies } = useQuery({
    queryKey: ["allergies", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("allergies")
        .select("*")
        .eq("family_member_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: diseases } = useQuery({
    queryKey: ["diseases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diseases")
        .select("*")
        .eq("family_member_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleExport = async () => {
    setShowPrivacyAlert(false);
    setExporting(true);
    try {
      const { generateProntuarioPdf } = await import("@/lib/generateProntuarioPdf");
      const blob = generateProntuarioPdf({
        member: {
          name: member!.name,
          birth_date: member!.birth_date,
          blood_type: member!.blood_type,
          weight: member!.weight,
          height: member!.height,
        },
        allergies: (allergies || []).map((a) => ({ substance: a.substance, severity: a.severity })),
        diseases: (diseases || []).map((d) => ({ name: d.name, category: d.category })),
        timeline,
        emitterName: emitterProfile || user?.user_metadata?.name || user?.email || "Usuário",
        logoBase64,
      });

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const fileName = `RES_${member!.name.replace(/\s+/g, "_")}_${dd}${mm}${yyyy}_${hh}${min}${ss}.pdf`;

      if (navigator.share) {
        const file = new File([blob], fileName, { type: "application/pdf" });
        try {
          await navigator.share({
            files: [file],
            title: "Prontuário Médico",
            text: "Segue o resumo de saúde exportado do Locus Vita.",
          });
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === "AbortError") return;
          // fallback to download
        }
      }

      // Fallback download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o PDF.");
    } finally {
      setExporting(false);
    }
  };

  if (isLoading || groupLoading) {
    return (
      <div className="px-4 pt-6 space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="px-4 pt-6 text-center py-16">
        <p className="text-foreground font-semibold"><p className="text-foreground font-semibold">Usuário não encontrado</p></p>
        <Button className="mt-4" onClick={() => navigate("/home")}>Voltar</Button>
      </div>
    );
  }

  const age = calculateAge(member.birth_date);
  const w = member.weight;
  const h = member.height;
  const bmi = w && h && h > 0 ? (w / (h * h)).toFixed(1) : null;

  const bioBlocks = [
    { icon: Droplet, label: "Tipo Sanguíneo", value: member.blood_type || "—" },
    { icon: Weight, label: "Peso", value: w ? `${w} kg` : "—" },
    { icon: Ruler, label: "Altura", value: h ? `${(h * 100).toFixed(0)} cm` : "—" },
    { icon: Calculator, label: "IMC", value: bmi || "—" },
  ];

  const severityColor: Record<string, string> = {
    Leve: "bg-amber-100 text-amber-800 border-amber-200",
    Moderada: "bg-orange-100 text-orange-800 border-orange-200",
    Grave: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="sticky top-0 z-40 w-full bg-[#F4F1EB]/80 backdrop-blur-md px-4 pt-6 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={22} />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex-1">Prontuário (RES)</h1>
        <Button
          variant="ghost"
          size="icon"
          disabled={exporting || timelineLoading}
          onClick={() => setShowPrivacyAlert(true)}
        >
          <Share2 size={20} className="text-primary" />
        </Button>
      </div>

      {/* LGPD Privacy Alert */}
      <AlertDialog open={showPrivacyAlert} onOpenChange={setShowPrivacyAlert}>
        <AlertDialogContent className="rounded-xl mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock size={18} className="text-destructive" />
              Atenção: Dados Sensíveis
            </AlertDialogTitle>
            <AlertDialogDescription>
              O documento a seguir contém informações médicas confidenciais. Você é o único responsável pelo compartilhamento seguro destes dados. Deseja prosseguir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport}>Gerar Documento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-4 pb-8 space-y-5">

          {/* Security Banner */}
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
            <Lock className="text-primary shrink-0" size={16} />
            <p className="text-xs text-muted-foreground leading-snug">
              Dados privados e criptografados de ponta a ponta.
            </p>
          </div>

          {/* Patient Identity */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <div className="flex items-center gap-4 mb-5">
              <MemberAvatar avatarUrl={member.avatar_url} name={member.name} size="lg" memberType={member.member_type} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-[#1C3333] truncate">{member.name}</p>
                <p className="text-sm text-muted-foreground">{member.relationship}</p>
                {age !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">{age} anos</p>
                )}
              </div>
            </div>

            {/* Biometric Grid */}
            <div className="grid grid-cols-4 gap-2">
              {bioBlocks.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center text-center p-2.5 rounded-lg bg-muted/40">
                  <Icon className="text-primary mb-1" size={18} />
                  <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Alerts: Allergies */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-destructive" size={18} />
              <h2 className="text-sm font-semibold text-foreground">Alergias e Restrições</h2>
            </div>
            {allergies && allergies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {allergies.map((a) => (
                  <Badge
                    key={a.id}
                    variant="outline"
                    className={severityColor[a.severity] || "bg-red-50 text-red-700 border-red-200"}
                  >
                    {a.substance} ({a.severity})
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma alergia registrada.</p>
            )}
          </div>

          {/* Critical Alerts: Chronic Diseases */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="text-primary" size={18} />
              <h2 className="text-sm font-semibold text-foreground">Doenças Crônicas</h2>
            </div>
            {diseases && diseases.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {diseases.map((d) => (
                  <Badge
                    key={d.id}
                    variant="outline"
                    className="bg-violet-50 text-violet-800 border-violet-200"
                  >
                    {d.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma doença crônica registrada.</p>
            )}
          </div>

          {/* Clinical Timeline */}
          <div>
            <div className="flex items-center gap-2 mb-4 mt-2">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Histórico Clínico</h2>
            </div>
            {timelineLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : (
              <ClinicalTimeline events={timeline} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Prontuario;
