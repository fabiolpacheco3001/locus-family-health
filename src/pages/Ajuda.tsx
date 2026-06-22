import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, BookOpen, Share2, Stethoscope, SearchX, Mail, FileUp, CalendarPlus, Syringe, Pencil, Users, Heart, FileText, BrainCircuit, Package, Lock, PawPrint } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";

const faqItems = [
  {
    icon: FileUp,
    question: "Como importo minha carteira de vacinação do SUS?",
    answer:
      "Para poupar tempo, o Locus Vita permite importar seu histórico do SUS automaticamente:\n\n1. Baixe a sua Carteira Nacional de Vacinação em formato PDF através do aplicativo ou site oficial Meu SUS Digital.\n2. No Locus Vita, acesse a aba Minha Saúde e clique em Vacinas.\n3. Toque no botão (+) e escolha a opção Importar Carteira do SUS (PDF).\n4. Selecione o arquivo PDF baixado e aguarde nossa Inteligência Artificial ler o documento.\n5. Revise as vacinas encontradas e clique em Confirmar Importação.\n\n⚠️ Nota de Segurança: Por regras de privacidade (LGPD), o sistema só permitirá a importação se o CPF do documento for exatamente igual ao CPF cadastrado no perfil do familiar selecionado.",
  },
  {
    icon: CalendarPlus,
    question: "Como adiciono uma nova Consulta ou Exame?",
    answer:
      "1. Acesse a aba Agenda (para ver seus compromissos) ou Minha Saúde (para visão geral).\n2. Toque no botão flutuante (+) no canto inferior direito.\n3. Selecione Nova Consulta ou Novo Exame.\n4. Preencha os detalhes como nome do médico, data e local, e clique em Salvar.",
  },
  {
    icon: Syringe,
    question: "Como registro uma vacina manualmente (sem o PDF)?",
    answer:
      "1. Acesse a aba Minha Saúde e clique em Vacinas.\n2. Toque no botão flutuante (+) e escolha Adicionar Manualmente.\n3. Selecione a vacina na lista, informe a data de aplicação, o número da dose e clique em Salvar.",
  },
  {
    icon: Pencil,
    question: "Como edito ou excluo um registro salvo?",
    answer:
      "Caso tenha inserido uma informação errada, não se preocupe:\n\n1. Navegue até a lista onde o registro está (Agenda, Exames ou Vacinas).\n2. Para editar, toque sobre o card do item, altere as informações e clique em Salvar.\n3. Para excluir, basta deslizar o card do registro para a esquerda e tocar no ícone de lixeira.",
  },
  {
    icon: Users,
    question: "Como acesso os dados de saúde dos meus familiares ou pets?",
    answer:
      "1. Acesse a aba Família no menu inferior.\n2. Toque no card do familiar ou pet desejado.\n3. O aplicativo alternará para o perfil selecionado, permitindo que você visualize e adicione consultas, exames e vacinas exclusivas para aquele membro da família.",
  },
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
  {
    icon: Heart,
    question: "Como ativar e acessar o controle de Ciclo Menstrual?",
    answer:
      "1. Acesse a aba Ajustes e entre em Meu Perfil.\n2. Ative a chave correspondente ao Controle de Ciclo Menstrual.\n3. Uma vez ativado, um novo card de monitoramento ficará fixado permanentemente na aba Minha Saúde, onde você poderá registrar o início, fim e sintomas do seu ciclo.",
  },
  {
    icon: FileText,
    question: "O que é o RES e como exportá-lo?",
    answer:
      "O RES (Resumo Eletrônico de Saúde) é um documento que compila de forma inteligente todo o seu histórico clínico (consultas, vacinas, exames e condições). Para exportá-lo, acesse a aba Minha Saúde e clique no botão Exportar RES no topo da tela.\n\n⚠️ Atenção à Privacidade (LGPD): O arquivo PDF gerado contém dados extremamente sensíveis sobre sua saúde. Guarde-o em local seguro e compartilhe-o estritamente com profissionais de saúde de sua confiança.",
  },
  {
    icon: BrainCircuit,
    question: "Como usar a Inteligência Artificial para importar receitas médicas?",
    answer:
      "1. Na aba Minha Saúde, vá até a seção de Medicamentos e clique em adicionar (+).\n2. Selecione a opção Ler Receita com IA.\n3. Tire uma foto nítida da prescrição médica ou faça upload de um PDF.\n4. Nossa Inteligência Artificial lerá o documento e preencherá automaticamente o nome do remédio, dosagem e horários de tomada. Revise e salve!",
  },
  {
    icon: Package,
    question: "Como funciona o controle de estoque para medicamentos de uso contínuo?",
    answer:
      "Ao cadastrar um medicamento que você toma todos os dias, marque a opção Uso Contínuo. O sistema abrirá campos de controle de estoque. Insira quantas pílulas você tem na caixa atualmente e defina um limite de alerta (ex: avisar quando restarem 5). Sempre que você marcar o remédio como 'Tomado', o sistema descontará do estoque e enviará uma notificação automática quando for a hora de comprar uma nova caixa.",
  },
  {
    icon: Lock,
    question: "Como realizo a troca da minha senha?",
    answer:
      "Acesse a aba Ajustes no menu inferior, toque em Segurança (ou Configurações de Conta) e selecione Trocar Senha. Você precisará digitar a sua senha atual e, em seguida, definir a nova.",
  },
  {
    icon: PawPrint,
    question: "Como funciona a recorrência de Rotina e Higiene para Pets?",
    answer:
      "Pensando no bem-estar do seu animal, o sistema automatiza tarefas repetitivas.\n\n1. Acesse o perfil do seu Pet e vá em Rotina e Higiene.\n2. Ao adicionar um evento (como Banho, Tosa ou Remédio de Verme), defina o intervalo de recorrência (ex: a cada 30 dias).\n3. Quando você marcar a tarefa atual como 'Concluída', o Locus Vita agendará automaticamente a próxima data no calendário!",
  },
];

const Ajuda = () => {
  const navigate = useNavigate();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggle = (i: number) => setExpandedIndex(expandedIndex === i ? null : i);

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredItems = normalizedQuery
    ? faqItems.filter(
        (item) =>
          item.question.toLowerCase().includes(normalizedQuery) ||
          item.answer.toLowerCase().includes(normalizedQuery)
      )
    : faqItems;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 space-y-4">
          {/* Sticky Header */}
          <div className="sticky top-0 z-30 bg-[#F4F1EB]/80 backdrop-blur-md pt-6 pb-4 -mx-4 px-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-1 rounded-full hover:bg-muted/40 transition-colors"
              >
                <ArrowLeft size={22} className="text-foreground" />
              </button>
              <h1 className="font-bold text-foreground text-lg">Dúvidas Frequentes</h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Qual é a sua dúvida?"
              className="pl-10 bg-card border-border/40 rounded-xl h-11"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setExpandedIndex(null);
              }}
            />
          </div>

          {/* FAQ Cards */}
          <div className="flex flex-col gap-3 justify-start h-fit pb-8">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <SearchX size={40} className="mb-3 opacity-50" />
                <p className="text-sm">Nenhuma dúvida encontrada para esta busca.</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const Icon = item.icon;
                const originalIndex = faqItems.indexOf(item);
                const isOpen = expandedIndex === originalIndex;

                return (
                  <button
                    key={originalIndex}
                    onClick={() => toggle(originalIndex)}
                    className="w-full text-left bg-card rounded-xl shadow-xs border border-border/40 overflow-hidden"
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
                    {isOpen && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-muted-foreground pl-[52px] whitespace-pre-line text-justify hyphens-auto">
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Support Contact */}
          <div className="flex flex-col items-center gap-3 pt-4 pb-24">
            <div className="w-16 h-px bg-border/60" />
            <p className="text-sm text-muted-foreground">Ainda não encontrou o que precisava?</p>
            <a
              href="mailto:suporte.locustech@locustech.com.br?subject=Suporte Locus Vita"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
            >
              <Mail size={16} />
              Falar com o Suporte
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ajuda;
