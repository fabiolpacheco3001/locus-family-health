import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useFamilyMembers, FamilyMember } from "@/hooks/useFamilyMembers";
import AddMemberDrawer from "@/components/AddMemberDrawer";
import EditMemberDrawer from "@/components/EditMemberDrawer";
import FixedFAB from "@/components/ui/FixedFAB";

const ordemParentesco: Record<string, number> = {
  "Titular": 1,
  "Cônjuge": 2,
  "Filho(a)": 3,
  "Pai/Mãe": 4,
  "Irmão(ã)": 5,
  "Outro": 6,
};

const GerenciarFamilia = () => {
  const { members, isLoading } = useFamilyMembers();
  const navigate = useNavigate();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [editMember, setEditMember] = useState<FamilyMember | null>(null);

  const sorted = [...members].sort(
    (a, b) => (ordemParentesco[a.relationship] || 99) - (ordemParentesco[b.relationship] || 99)
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMember.mutateAsync(deleteTarget.id);
      toast.success("Familiar removido.");
      setDeleteTarget(null);
    } catch {
      toast.error("Erro ao excluir. Tente novamente.");
    }
  };

  return (
    <>
      {!addDrawerOpen && !editMember && <FixedFAB onClick={() => setAddDrawerOpen(true)} />}
      <AddMemberDrawer open={addDrawerOpen} onOpenChange={setAddDrawerOpen} />
      {editMember && (
        <EditMemberDrawer
          open={!!editMember}
          onOpenChange={(open) => { if (!open) setEditMember(null); }}
          member={editMember}
        />
      )}

      <div className="flex flex-col h-[calc(100dvh-80px)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
          <button onClick={() => navigate("/ajustes")} className="p-1">
            <ArrowLeft size={22} className="text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Gerenciar Família</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain no-scrollbar">
          {members.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-sm">
              Toque no botão <span className="font-semibold text-accent-foreground">+</span> para adicionar um membro.
            </p>
          )}

          {sorted.map((m) => (
            <div
              key={m.id}
              className="flex items-center p-4 bg-card rounded-xl shadow-sm border border-border/50"
            >
              <Avatar className="h-12 w-12 border-2 border-secondary shrink-0">
                <AvatarFallback className="bg-secondary/20 text-secondary font-bold text-lg">
                  {m.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col ml-4 min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.relationship}</p>
              </div>
              <div className="flex items-center gap-3 ml-2 shrink-0">
                <button onClick={() => setEditMember(m)} className="p-2 rounded-full hover:bg-muted/50">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => setDeleteTarget(m)} className="p-2 rounded-full hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita e apagará todo o histórico de saúde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMember.isPending ? <Loader2 className="animate-spin" size={16} /> : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GerenciarFamilia;
