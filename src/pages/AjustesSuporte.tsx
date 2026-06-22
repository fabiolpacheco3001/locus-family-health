import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, HelpCircle, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Itens exportados para teste unitário ──────────────────────────────────────
export interface SuporteItem {
  icon: React.ElementType;
  label: string;
  kind: "navigate" | "support";
  path?: string;
}

export const suporteItems: SuporteItem[] = [
  { icon: HelpCircle,     label: "Dúvidas Frequentes",    kind: "navigate", path: "/ajuda" },
  { icon: MessageCircle,  label: "Fale Conosco",          kind: "support" },
  { icon: Sparkles,       label: "Novidade Locus Vita",   kind: "navigate", path: "/changelog" },
];

const AjustesSuporte = () => {
  const navigate = useNavigate();
  const [supportUrl, setSupportUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("suporte@locustech.com.br");

  useEffect(() => {
    supabase
      .from("system_configs")
      .select("key, value")
      .in("key", ["support_url", "support_email"])
      .then(({ data }) => {
        if (data) {
          for (const row of data) {
            if (row.key === "support_url")   setSupportUrl(row.value || "");
            if (row.key === "support_email") setSupportEmail(row.value || "suporte@locustech.com.br");
          }
        }
      });
  }, []);

  const handleItemClick = (item: SuporteItem) => {
    if (item.kind === "navigate" && item.path) {
      navigate(item.path, { state: { from: "/ajustes/suporte" } });
    } else if (item.kind === "support") {
      if (supportUrl) window.open(supportUrl, "_blank");
      else window.location.href = `mailto:${supportEmail}`;
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-6 space-y-4 min-h-[calc(100%+1px)]">

          {/* Header com back */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 rounded-lg active:bg-muted/40"
              aria-label="Voltar"
            >
              <ChevronLeft size={24} className="text-foreground" />
            </button>
            <h1 className="font-bold text-foreground text-lg">Suporte</h1>
          </div>

          {/* Itens */}
          <div className="space-y-2">
            {suporteItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center gap-3 p-4 bg-card rounded-xl shadow-xs border border-border/40 active:bg-muted/40 transition-colors"
                  aria-label={item.label}
                >
                  <div className="w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-black" />
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-foreground">{item.label}</span>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AjustesSuporte;
