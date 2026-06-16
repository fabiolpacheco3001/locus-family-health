import { useNavigate } from "react-router-dom";
import { ChevronLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Termos de Uso — Locus Vita
 * Versão: 1.0 | Vigência: junho/2026
 *
 * Acessível publicamente (sem autenticação) e via Landing Page.
 */
const TermosUso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#F4F1EB]/90 backdrop-blur-md border-b border-border/30 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-[#78C2AD]" />
          <h1 className="text-base font-bold text-foreground">Termos de Uso</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 max-w-prose mx-auto w-full">

        <div className="text-xs text-muted-foreground">
          Versão 1.0 · Vigência a partir de junho de 2026
        </div>

        {/* 1. Aceitação */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">1. Aceitação dos Termos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ao criar uma conta no <strong className="text-foreground">Locus Vita</strong>, você
            declara que leu, entendeu e concorda com estes Termos de Uso e com a nossa{" "}
            <button
              onClick={() => navigate("/politica-de-privacidade")}
              className="text-[#78C2AD] underline underline-offset-2 font-medium"
            >
              Política de Privacidade
            </button>
            . Caso não concorde com qualquer disposição, não utilize o serviço.
          </p>
        </section>

        {/* 2. Descrição do serviço */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">2. Descrição do Serviço</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Locus Vita é uma plataforma de organização de saúde familiar que permite
            registrar e acompanhar medicamentos, consultas, exames, vacinas, alergias,
            doenças e rotinas de pets. O serviço também oferece funcionalidades de
            inteligência artificial para interpretação de receitas e laudos médicos, de
            forma auxiliar e não substitutiva à orientação de profissionais de saúde.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">O Locus Vita não é um serviço médico.</strong>{" "}
            As informações organizadas no aplicativo têm finalidade pessoal de gerenciamento
            e não constituem diagnóstico, prescrição ou aconselhamento médico. Sempre consulte
            um profissional de saúde habilitado para decisões clínicas.
          </p>
        </section>

        {/* 3. Conta e responsabilidades */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">3. Conta e Responsabilidades do Usuário</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Você é responsável por:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
            <li>Manter a confidencialidade da sua senha e das credenciais de acesso.</li>
            <li>Todas as atividades realizadas em sua conta, inclusive por membros do grupo familiar que você convidar.</li>
            <li>Garantir que as informações inseridas sejam precisas e mantidas atualizadas.</li>
            <li>Não compartilhar sua conta com pessoas fora do seu grupo familiar.</li>
            <li>Notificar imediatamente a Locus Tech (fabio@locustech.com.br) em caso de uso não autorizado da sua conta.</li>
          </ul>
        </section>

        {/* 4. Uso aceitável */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">4. Uso Aceitável</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            É expressamente proibido:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
            <li>Utilizar o serviço para fins ilegais ou não autorizados.</li>
            <li>Inserir informações falsas, enganosas ou de terceiros sem autorização.</li>
            <li>Tentar acessar dados de outros usuários ou contornar mecanismos de segurança.</li>
            <li>Fazer engenharia reversa, descompilar ou modificar qualquer parte da plataforma.</li>
            <li>Utilizar o serviço para enviar spam, malware ou qualquer conteúdo prejudicial.</li>
          </ul>
        </section>

        {/* 5. Assinatura e pagamento */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">5. Assinatura e Pagamento</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Locus Vita oferece planos de assinatura mensais e anuais, processados pelo
            gateway de pagamento Asaas. Ao assinar:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
            <li>A cobrança é recorrente e automática na data de vencimento.</li>
            <li>Você pode cancelar a assinatura a qualquer momento em Ajustes → Meu Plano. O acesso permanece ativo até o fim do período já pago.</li>
            <li>Não realizamos reembolsos proporcionais por cancelamento antecipado dentro do período vigente, salvo disposição legal em contrário.</li>
            <li>Os preços podem ser alterados com aviso prévio de 30 dias.</li>
          </ul>
        </section>

        {/* 6. Propriedade intelectual */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">6. Propriedade Intelectual</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Todo o conteúdo do Locus Vita — incluindo código-fonte, design, logotipos e
            textos — é de propriedade exclusiva da Locus Tech e protegido por leis de
            propriedade intelectual. Os dados inseridos por você permanecem de sua
            propriedade e podem ser exportados ou excluídos a qualquer momento.
          </p>
        </section>

        {/* 7. Disponibilidade */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">7. Disponibilidade do Serviço</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Buscamos manter o serviço disponível 24/7, mas não garantimos disponibilidade
            ininterrupta. Poderemos realizar manutenções programadas com aviso prévio.
            Não nos responsabilizamos por perdas decorrentes de indisponibilidade temporária.
          </p>
        </section>

        {/* 8. Limitação de responsabilidade */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">8. Limitação de Responsabilidade</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Na máxima extensão permitida pela lei, a Locus Tech não será responsável por
            danos indiretos, incidentais ou consequentes decorrentes do uso ou
            impossibilidade de uso do serviço. Nossa responsabilidade total está limitada
            ao valor pago pelo usuário nos 3 meses anteriores ao evento que originou o dano.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O serviço é fornecido "como está". As funcionalidades de inteligência artificial
            são auxiliares e podem conter imprecisões — sempre confirme informações críticas
            de saúde com profissionais habilitados.
          </p>
        </section>

        {/* 9. Encerramento */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">9. Encerramento de Conta</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Você pode excluir sua conta a qualquer momento em Ajustes → Excluir Conta.
            Podemos suspender ou encerrar sua conta em caso de violação destes Termos,
            com aviso prévio sempre que possível.
          </p>
        </section>

        {/* 10. Alterações */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">10. Alterações nos Termos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Podemos atualizar estes Termos periodicamente. Notificaremos você pelo
            aplicativo com antecedência mínima de 15 dias antes de mudanças materiais
            entrarem em vigor. O uso continuado após esse prazo constitui aceite das
            alterações.
          </p>
        </section>

        {/* 11. Lei e foro */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">11. Lei Aplicável e Foro</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estes Termos são regidos pelas leis da República Federativa do Brasil.
            Fica eleito o foro da comarca de domicílio do usuário para resolução de
            quaisquer controvérsias, nos termos do Código de Defesa do Consumidor.
          </p>
        </section>

        {/* 12. Contato */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">12. Contato</h2>
          <div className="bg-card rounded-xl p-4 border border-border/40 space-y-1">
            <p className="text-sm font-semibold text-foreground">Locus Tech</p>
            <a
              href="mailto:fabio@locustech.com.br"
              className="text-sm text-[#78C2AD] underline underline-offset-2"
            >
              fabio@locustech.com.br
            </a>
            <p className="text-xs text-muted-foreground">Resposta em até 5 dias úteis.</p>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-4 pb-8 border-t border-border/30 text-xs text-muted-foreground space-y-1">
          <p>Locus Tech · fabio@locustech.com.br</p>
          <p>Termos de Uso versão 1.0 · Junho/2026</p>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="w-full h-11 rounded-xl font-semibold mb-8"
        >
          Voltar
        </Button>
      </div>
    </div>
  );
};

export default TermosUso;
