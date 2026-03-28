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
    question: "Como configurar um familiar como Pet?",
    answer:
      'Vá em Mais > Família, edite o perfil do familiar e ative a opção "Este perfil é um Pet?".',
  },
  {
    question: "Onde encontro o histórico de exames?",
    answer:
      'Na tela principal (Minha Saúde), selecione o familiar e clique no Card "Exames".',
  },
  {
    question: "Posso compartilhar o acesso com outra pessoa?",
    answer:
      'Sim. Vá em Mais > Ajustes e use a opção "Gestão de Acessos" para enviar um convite.',
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
