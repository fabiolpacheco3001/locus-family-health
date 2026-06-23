import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ArrowUpDown, Share2, Scissors } from "lucide-react";
import { toast } from "sonner";
import { isFuture, parseISO, isValid } from "date-fns";
import useSmartBack from "@/hooks/useSmartBack";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useFamilyAccessGuard } from "@/hooks/useFamilyAccessGuard";
import { useFamilyGroup } from "@/hooks/useFamilyGroup";
import { useSurgeries } from "@/hooks/useSurgeries";
import { useAuth } from "@/hooks/useAuth";
import { SurgeryCard } from "@/components/SurgeryCard";
import { AddSurgeryDrawer } from "@/components/AddSurgeryDrawer";
import { compareAsc, compareDesc } from "date-fns";
import type { Surgery } from "@/hooks/useSurgeries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import FixedFAB from "@/components/ui/FixedFAB";

const Surgeries = () => {
  const { id } = useParams<{ id: string }>();
  const goBack = useSmartBack();
  const { members } = useFamilyMembers();
  const { isAdmin } = useFamilyGroup();
  const { user } = useAuth();
  const { surgeries, isLoading, softDeleteMutation, updateMutation } = useSurgeries(id);
  const logoBase64Ref = useRef<string | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSurgery, setEditingSurgery] = useState<Surgery | null>(null);
  const [activeTab, setActiveTab] = useState<"scheduled" | "done">("scheduled");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  useFamilyAccessGuard(id);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  useEffect(() => {
    fetch("/logo-locus-vita-pdf.png")
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = () => { logoBase64Ref.current = reader.result as string; };
        reader.readAsDataURL(blob);
      })
      .catch(() => { /* logo opcional */ });
  }, []);

  const member = members.find((m) => m.id === id);

  const scheduled = surgeries.filter((s) => s.status === "scheduled");
  const done = surgeries.filter((s) => s.status !== "scheduled");

  const sortSurgeries = (list: Surgery[]) =>
    [...list].sort((a, b) => {
      const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(0);
      const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(0);
      return sortOrder === "asc" ? compareAsc(dateA, dateB) : compareDesc(dateA, dateB);
    });

  const displayed = sortSurgeries(activeTab === "scheduled" ? scheduled : done);

  const handleOpenEdit = (surgery: Surgery) => {
    setEditingSurgery(surgery);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingSurgery(null);
  };

  const handleAdd = () => {
    setEditingSurgery(null);
    setDrawerOpen(true);
  };

  const handleExportAllPdf = async () => {
    const { generateSurgeriesPdf } = await import("@/lib/generateSurgeriesPdf");
    const emitterName = user?.user_metadata?.full_name ?? user?.email ?? "Usuário";
    const blob = generateSurgeriesPdf({
      memberName: member?.name ?? "—",
      surgeries: surgeries.map((s) => ({
        surgery_type: s.surgery_type,
        custom_type: s.custom_type,
        scheduled_date: s.scheduled_date,
        surgeon_name: s.surgeon_name,
        hospital_clinic: s.hospital_clinic,
        status: s.status,
        notes: s.notes,
        surgery_instructions: s.surgery_instructions,
      })),
      emitterName,
      logoBase64: logoBase64Ref.current,
    });
    const memberSlug = member?.name?.toLowerCase().replace(/\s+/g, "-") ?? "membro";
    const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cirurgias-${memberSlug}-${dateSuffix}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {!drawerOpen && <FixedFAB onClick={handleAdd} />}

      <AddSurgeryDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
        familyMemberId={id!}
        editingSurgery={editingSurgery}
      />

      <div className="px-4 pt-6 pb-28 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Cirurgias</h1>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-[#78C2AD]"
            onClick={handleExportAllPdf}
            disabled={surgeries.length === 0}
            aria-label="Exportar PDF"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs pill + sort */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-xl flex-1">
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "scheduled"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Agendadas ({scheduled.length})
            </button>
            <button
              onClick={() => setActiveTab("done")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "done"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Concluídas ({done.length})
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setSortOrder("asc")}
                className={sortOrder === "asc" ? "font-semibold" : ""}
              >
                Mais antigos primeiro
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("desc")}
                className={sortOrder === "desc" ? "font-semibold" : ""}
              >
                Mais recentes primeiro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Conteúdo */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}

        {!isLoading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
              <Scissors className="text-black" size={28} />
            </div>
            <p className="text-foreground font-semibold mb-1">
              {activeTab === "scheduled"
                ? "Nenhuma cirurgia agendada"
                : "Nenhuma cirurgia concluída"}
            </p>
            <p className="text-muted-foreground text-sm">
              {activeTab === "scheduled"
                ? "Toque no botão abaixo para adicionar."
                : "Cirurgias realizadas ou canceladas aparecerão aqui."}
            </p>
          </div>
        )}

        {!isLoading && (
          <div className="flex flex-col space-y-3">
            {displayed.map((surgery) => (
              <SurgeryCard
                key={surgery.id}
                surgery={surgery}
                onEdit={() => handleOpenEdit(surgery)}
                onDelete={() => softDeleteMutation.mutate(surgery.id)}
                onComplete={() => {
                  const d = surgery.scheduled_date ? parseISO(surgery.scheduled_date) : null;
                  if (d && isValid(d) && isFuture(d)) {
                    toast.error("A cirurgia ainda não ocorreu. Só é possível concluir após a data agendada.");
                    return;
                  }
                  updateMutation.mutate({ id: surgery.id, status: "completed" });
                }}
                isAdmin={isAdmin}
                isOpen={openCardId === surgery.id}
                onOpenChange={(open) => setOpenCardId(open ? surgery.id : null)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Surgeries;
