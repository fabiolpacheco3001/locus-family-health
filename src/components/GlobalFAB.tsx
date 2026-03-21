import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import AddMemberDrawer from "./AddMemberDrawer";
import AddConsultationDrawer from "./AddConsultationDrawer";
import AddMedicationDrawer from "./AddMedicationDrawer";

const GlobalFAB = () => {
  const location = useLocation();
  const params = useParams();
  const [memberDrawer, setMemberDrawer] = useState(false);
  const [consultationDrawer, setConsultationDrawer] = useState(false);
  const [medicationDrawer, setMedicationDrawer] = useState(false);

  const path = location.pathname;
  const familyId = params.id ?? "";

  const isMemberRoute = path === "/home" || path === "/familia";
  const isConsultaRoute = /^\/familiar\/[^/]+\/consultas$/.test(path);
  const isMedicamentoRoute = /^\/familiar\/[^/]+\/medicamentos$/.test(path);

  const showFab = isMemberRoute || isConsultaRoute || isMedicamentoRoute;
  const anyDrawerOpen = memberDrawer || consultationDrawer || medicationDrawer;

  if (!showFab || anyDrawerOpen) return null;

  const handleClick = () => {
    if (isMemberRoute) setMemberDrawer(true);
    else if (isConsultaRoute) setConsultationDrawer(true);
    else if (isMedicamentoRoute) setMedicationDrawer(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="!fixed !right-6 !bottom-24 !z-[100] w-14 h-14 rounded-full bg-[#FFB085] hover:bg-[#ff9b66] text-slate-900 shadow-md flex items-center justify-center transition-all"
      >
        <Plus size={24} />
      </button>

      <AddMemberDrawer open={memberDrawer} onOpenChange={setMemberDrawer} />
      <AddConsultationDrawer
        open={consultationDrawer}
        onOpenChange={setConsultationDrawer}
        familyMemberId={familyId}
      />
      <AddMedicationDrawer
        open={medicationDrawer}
        onOpenChange={setMedicationDrawer}
        familyMemberId={familyId}
      />
    </>
  );
};

export default GlobalFAB;
