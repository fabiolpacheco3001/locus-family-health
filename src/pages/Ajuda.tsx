import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, HelpCircle, BookOpen, Share2, Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";

const faqItems = [
  {
    icon: BookOpen,
    question: "Como adiciono um Pet à família?",
    answer:
      "Na aba 'Família' no menu inferior, toque no botão de adicionar (+) e preencha os dados do seu animalzinho. Lembre-se: o perfil já deve ser criado como Pet desde o início, não é possível transformar um perfil de pessoa em Pet depois.",
  },
  {
    icon: Stethoscope,
    question: "Onde encontro o histórico de exames?",
    answer:
      "Na aba 'Minha Saúde', selecione o usuário desejado no topo da tela e, em seguida, toque no card 'Exames'.",
  },
  {
    icon: Share2,
    question: "Posso compartilhar o acesso com outra pessoa?",
    answer:
      "Sim. Acesse a aba 'Ajustes' no menu inferior e toque em 'Gestão de Acessos' para convidar outros membros e configurar o que eles podem ver e editar.",
  },
];

const Ajuda = () => {
  const navigate = useNavigate();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggle = (i: number) => setExpandedIndex(expandedIndex === i ? null : i);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 pb-32 space-y-4 min-h-[calc(100%+1px)]">
          {/* Sticky Header */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-1 rounded-full hover:bg-muted/40 transition-colors"
              >
                <ArrowLeft size={22} className="text-foreground" />
              </button>
              <h1 className="text-2xl font-bold text-foreground">Ajuda e Suporte</h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Qual é a sua dúvida?"
              className="pl-10 bg-card border-border/40 rounded-xl h-11"
              readOnly
            />
          </div>

          {/* FAQ Cards */}
          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const Icon = item.icon;
              const isOpen = expandedIndex === index;

              return (
                <button
                  key={index}
                  onClick={() => toggle(index)}
                  className="w-full text-left bg-card rounded-xl shadow-sm border border-border/40 overflow-hidden transition-all"
                >
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-full bg-[#A7D3CB] flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-black" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {item.question}
                    </span>
                    <svg
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div
                    className={cn(
                      "px-4 overflow-hidden transition-all duration-200",
                      isOpen ? "max-h-40 pb-4" : "max-h-0"
                    )}
                  >
                    <p className="text-sm text-muted-foreground pl-[52px]">
                      {item.answer}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ajuda;
