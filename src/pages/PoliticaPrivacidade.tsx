import { useNavigate } from "react-router-dom";
import { ChevronLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Política de Privacidade — Locus Vita
 * LGPD Art. 7, 11, 18, 46, 48 compliant.
 * Versão: 1.0 | Vigência: junho/2026
 *
 * Acessível publicamente (sem autenticação) e via Ajustes → Política de Privacidade.
 */
const PoliticaPrivacidade = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => navigate(-1);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f2f0eb]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#F4F1EB]/90 backdrop-blur-md border-b border-border/30 px-4 py-4 flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-[#78C2AD]" />
          <h1 className="text-base font-bold text-foreground">Política de Privacidade</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 max-w-prose mx-auto w-full">

        <div className="text-xs text-muted-foreground">
          Versão 1.0 · Vigência a partir de junho de 2026
        </div>

        {/* 1. Controlador */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">1. Quem é o Controlador dos seus dados</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">Locus Vita</strong> é um serviço operado pela{" "}
            <strong className="text-foreground">Locus Tech</strong>. Para fins desta política,
            o <em>controlador</em> dos dados pessoais é a Locus Tech, representada por Fábio
            (fabio@locustech.com.br), responsável pelas decisões sobre o tratamento.
          </p>
        </section>

        {/* 2. Dados coletados */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">2. Quais dados coletamos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Coletamos apenas os dados necessários para a prestação do serviço:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
            <li><strong className="text-foreground">Dados de cadastro:</strong> nome completo e endereço de e-mail.</li>
            <li><strong className="text-foreground">Dados de saúde:</strong> medicamentos, posologia, consultas médicas, exames laboratoriais, vacinas, alergias, doenças, medidas corporais e ciclos menstruais dos membros do grupo familiar, inseridos voluntariamente por você.</li>
            <li><strong className="text-foreground">Arquivos:</strong> fotos de receitas, laudos e carteirinha de vacinação, enviados para análise por IA (OCR) ou armazenamento pessoal.</li>
            <li><strong className="text-foreground">Dados de uso:</strong> logs de interação com funcionalidades de inteligência artificial, para controle de limites e segurança.</li>
            <li><strong className="text-foreground">Dados financeiros:</strong> histórico de assinatura processado pelo gateway Asaas (cartão de crédito nunca é armazenado no Locus Vita).</li>
          </ul>
        </section>

        {/* 3. Finalidade e base legal */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">3. Para que usamos seus dados e com qual base legal</h2>
          <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>
              Os dados de saúde são considerados dados <em>sensíveis</em> pela LGPD (Art. 11).
              O tratamento é realizado com base no{" "}
              <strong className="text-foreground">consentimento do titular</strong> (Art. 11, I),
              fornecido no momento do cadastro, para as seguintes finalidades:
            </p>
            <ul className="pl-4 list-disc space-y-1">
              <li>Organização e exibição das informações de saúde do grupo familiar no aplicativo.</li>
              <li>Envio de lembretes e alertas de medicamentos, consultas e vacinas.</li>
              <li>Análise de receitas e laudos por inteligência artificial (Gemini) para preenchimento automático de dados.</li>
              <li>Geração de exportações em PDF para uso pessoal e compartilhamento com profissionais de saúde.</li>
            </ul>
            <p>
              Dados de cadastro e financeiros são tratados com base na{" "}
              <strong className="text-foreground">execução do contrato</strong> (Art. 7, V)
              para prestação do serviço de assinatura.
            </p>
          </div>
        </section>

        {/* 4. Compartilhamento */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">4. Com quem compartilhamos seus dados</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Seus dados são compartilhados apenas com operadores essenciais ao serviço, com
            os quais mantemos contratos de proteção de dados:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
            <li><strong className="text-foreground">Supabase:</strong> banco de dados, autenticação e armazenamento de arquivos (servidores no Brasil ou EUA com SCCs LGPD/GDPR).</li>
            <li><strong className="text-foreground">Google Gemini (via Lovable AI Gateway):</strong> processamento de imagens de receitas e laudos para OCR. Imagens são transmitidas em tempo real e não retidas.</li>
            <li><strong className="text-foreground">Asaas:</strong> processamento de pagamentos e gestão de assinaturas.</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Não vendemos, alugamos nem cedemos seus dados a terceiros para fins de marketing ou qualquer finalidade não descrita nesta política.
          </p>
        </section>

        {/* 5. Retenção */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">5. Por quanto tempo guardamos seus dados</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Seus dados são mantidos enquanto sua conta estiver ativa. Ao excluir a conta,
            todos os dados pessoais e de saúde são apagados permanentemente de nossos
            sistemas em até 72 horas. Logs de auditoria financeira podem ser mantidos
            por até 5 anos para cumprimento de obrigações legais fiscais (Art. 7, II da LGPD).
          </p>
        </section>

        {/* 6. Direitos do titular */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">6. Seus direitos como titular (Art. 18 LGPD)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Você tem direito a, a qualquer momento:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
            <li><strong className="text-foreground">Confirmação e acesso:</strong> saber quais dados temos sobre você.</li>
            <li><strong className="text-foreground">Correção:</strong> atualizar dados incompletos, inexatos ou desatualizados diretamente no aplicativo (Meus Dados).</li>
            <li><strong className="text-foreground">Anonimização ou eliminação:</strong> solicitar a exclusão de dados desnecessários ou excessivos.</li>
            <li><strong className="text-foreground">Portabilidade:</strong> receber seus dados em formato estruturado (em breve disponível no aplicativo).</li>
            <li><strong className="text-foreground">Revogação do consentimento:</strong> você pode excluir sua conta a qualquer momento em Ajustes → Excluir Conta, o que remove todos os seus dados.</li>
            <li><strong className="text-foreground">Oposição:</strong> se discordar de algum tratamento, entre em contato conosco.</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para exercer qualquer um desses direitos, entre em contato pelo e-mail abaixo.
          </p>
        </section>

        {/* 7. Segurança */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">7. Como protegemos seus dados</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Adotamos medidas técnicas e organizacionais adequadas (Art. 46 LGPD):
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
            <li>Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256).</li>
            <li>Autenticação segura com proteção contra senhas vazadas (Have I Been Pwned).</li>
            <li>Controle de acesso por perfil (administrador / membro) com políticas de segurança no banco de dados (Row Level Security).</li>
            <li>Arquivos de exames e receitas armazenados em buckets privados, acessíveis apenas pelo titular.</li>
          </ul>
        </section>

        {/* 8. Incidentes */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">8. Incidentes de segurança</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Em caso de incidente que possa acarretar risco ou dano relevante aos titulares,
            notificaremos a ANPD e os titulares afetados dentro do prazo legal de 72 horas
            (Art. 48 LGPD), com informações sobre a natureza dos dados, as medidas tomadas
            e o canal de contato.
          </p>
        </section>

        {/* 9. Contato */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">9. Canal de contato e Encarregado (DPO)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para dúvidas, solicitações de direitos ou reclamações relacionadas à privacidade:
          </p>
          <div className="bg-card rounded-xl p-4 border border-border/40 space-y-1">
            <p className="text-sm font-semibold text-foreground">Locus Tech — Encarregado de Dados</p>
            <a
              href="mailto:fabio@locustech.com.br"
              className="text-sm text-[#78C2AD] underline underline-offset-2"
            >
              fabio@locustech.com.br
            </a>
            <p className="text-xs text-muted-foreground">Resposta em até 15 dias úteis.</p>
          </div>
        </section>

        {/* 10. Alterações */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">10. Alterações nesta política</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Podemos atualizar esta política periodicamente. Quando houver mudanças materiais,
            notificaremos você pelo aplicativo com antecedência mínima de 15 dias e, se
            necessário, solicitaremos novo consentimento.
          </p>
        </section>

        {/* Footer */}
        <div className="pt-4 pb-8 border-t border-border/30 text-xs text-muted-foreground space-y-1">
          <p>Locus Tech · fabio@locustech.com.br</p>
          <p>Política de Privacidade versão 1.0 · Junho/2026</p>
        </div>

        <Button
          variant="outline"
          onClick={handleBack}
          className="w-full h-11 rounded-xl font-semibold mb-8"
        >
          Voltar
        </Button>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
