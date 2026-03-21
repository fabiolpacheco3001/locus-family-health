import { useConsultations } from "@/hooks/useConsultations";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  familyMemberId: string;
  value: string;
  onValueChange: (value: string) => void;
}

const ConsultationSelect = ({ familyMemberId, value, onValueChange }: Props) => {
  const { consultations } = useConsultations(familyMemberId);

  if (consultations.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label>Vincular a uma Consulta (Opcional)</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="text-[16px]">
          <SelectValue placeholder="Nenhuma consulta selecionada" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhuma</SelectItem>
          {consultations.map((c) => {
            const dateLabel = c.consultation_date
              ? format(new Date(c.consultation_date), "dd/MM/yyyy", { locale: ptBR })
              : "Sem data";
            const profLabel = c.professional_name || c.specialty;
            return (
              <SelectItem key={c.id} value={c.id}>
                {dateLabel} - {profLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ConsultationSelect;
