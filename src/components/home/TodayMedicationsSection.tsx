import * as React from "react";
import { Pill, PawPrint, ChevronRight, Infinity as InfinityIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MedicationDoseActions } from "@/components/agenda/MedicationDoseActions";
import { useNavigate } from "react-router-dom";
import type { MedWithNextDose } from "@/hooks/useHomeData";

const DISPLAY_LIMIT = 4;

type Props = {
  medsLoading: boolean;
  medsWithNextDose: MedWithNextDose[];
  todayPetRoutines: any[];
  showAllActions: boolean;
  setShowAllActions: React.Dispatch<React.SetStateAction<boolean>>;
};

export function TodayMedicationsSection({
  medsLoading,
  medsWithNextDose,
  todayPetRoutines,
  showAllActions,
  setShowAllActions,
}: Props) {
  const navigate = useNavigate();

  return (
    <AccordionItem value="acoes-hoje" id="acoes-hoje" className="border-b-0">
      <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-3">
        <span className="flex items-center gap-2">
          <Pill size={18} style={{ color: "#6A978F" }} />
          Ações Medicamentosas
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {medsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : medsWithNextDose.length === 0 && todayPetRoutines.length === 0 ? (
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma ação para hoje.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col space-y-2">
            {/* Rotinas pet do dia */}
            {todayPetRoutines.map((p: any) => (
              <button
                key={`pet-${p.id}`}
                onClick={() =>
                  navigate(`/familiar/${p.family_member_id}/rotinas-pet`, { state: { from: "/home" } })
                }
                className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm text-left active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full"
              >
                <div className="w-9 h-9 rounded-lg bg-[#A7D3CB] flex items-center justify-center shrink-0">
                  <PawPrint className="text-black" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {p.routine_type}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {p.family_members?.name ?? "Pet"} 🐾
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">Rotina agendada para hoje</p>
                </div>
                <ChevronRight size={16} className="text-black shrink-0" />
              </button>
            ))}

            {/* Medicamentos */}
            {(showAllActions ? medsWithNextDose : medsWithNextDose.slice(0, DISPLAY_LIMIT)).map(
              ({
                med,
                effectiveScheduledFor,
                doseLabel,
                isOverdue,
                doseStatus,
                isContinuous,
                effectiveFreqType,
                startDateISO,
              }) => (
                <div
                  key={med.id}
                  className="flex flex-col p-3 bg-card rounded-xl border border-border/50 shadow-sm text-left w-full"
                >
                  <button
                    onClick={() => navigate(`/familiar/${med.family_member_id}/medicamentos`)}
                    className="flex items-center gap-3 active:bg-accent/50 sm:hover:bg-accent/50 transition-colors w-full rounded-lg"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#A7D3CB] flex items-center justify-center shrink-0">
                      <Pill className="text-black" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {med.name}
                        {(() => {
                          const firstName = med.family_members?.name?.split(" ")[0];
                          return firstName ? (
                            <span className="font-normal text-muted-foreground"> · {firstName}</span>
                          ) : null;
                        })()}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span>{med.dosage ?? ""}</span>
                        {isContinuous && (
                          <InfinityIcon className="inline w-3 h-3 mx-1 text-muted-foreground shrink-0" />
                        )}
                        {doseLabel && (
                          <span>
                            {isContinuous ? "" : " · "}
                            {doseLabel}
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-black shrink-0" />
                  </button>

                  {effectiveScheduledFor && (
                    <div className="flex w-full items-center justify-between mt-4 pt-3 border-t border-border/30">
                      <div className="flex items-center">
                        {!doseStatus && isOverdue && (
                          <Badge className="bg-destructive text-destructive-foreground border-destructive text-[10px] font-bold px-2.5 h-7 m-0 inline-flex items-center justify-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Atrasado
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center">
                        <MedicationDoseActions
                          medicationId={med.id}
                          scheduledFor={effectiveScheduledFor}
                          doseStatus={doseStatus}
                          frequencyHours={med.frequency_hours}
                          frequencyType={effectiveFreqType}
                          specificTimes={med.specific_times as string[] | null}
                          specificDays={med.specific_days as number[] | null}
                          startDateISO={startDateISO}
                          endDate={med.end_date}
                          usoContinuo={med.uso_continuo}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {medsWithNextDose.length > DISPLAY_LIMIT && (
              <button
                onClick={() => setShowAllActions((prev) => !prev)}
                className="w-full py-2.5 text-sm font-medium text-primary hover:text-primary/80 active:text-primary/60 transition-colors rounded-xl border border-border/50 bg-card"
              >
                {showAllActions ? "Ocultar Ações" : "Ver mais Ações"}
              </button>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
