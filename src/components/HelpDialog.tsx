import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const faqItems = [
  {
    question: "Como adiciono um Pet à família?",
    answer:
      "Na aba 'Família' no menu inferior, toque no botão de adicionar (+) e preencha os dados do seu animalzinho. Lembre-se: o perfil já deve ser criado como Pet desde o início, não é possível transformar um perfil de pessoa em Pet depois.",
  },
  {
    question: "Onde encontro o histórico de exames?",
    answer:
      "Na aba 'Minha Saúde', "Na aba 'Minha Saúde', selecione o usuário desejado no topo da tela e, em seguida, toque no card 'Exames'.", no topo da tela e, em seguida, toque no card 'Exames'.",
  },
  {
    question: "Posso compartilhar o acesso com outra pessoa?",
    answer:
      "Sim. Acesse a aba 'Ajustes' no menu inferior e toque em 'Gestão de Acessos' para convidar outros membros e configurar o que eles podem ver e editar.",
  },
];

const HelpDialog = ({ open, onOpenChange }: HelpDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] rounded-[24px] p-0 overflow-hidden border-none">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-foreground">
              Playbook Locus Vita
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Perguntas Frequentes
          </p>
        </DialogHeader>
        <div className="px-6 pb-6">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`} className="border-b border-border/50">
                <AccordionTrigger className="text-sm font-medium text-left py-3 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-3">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpDialog;
