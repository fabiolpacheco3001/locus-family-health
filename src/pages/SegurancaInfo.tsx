import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ShieldCheck, Lock, FileText, Eye, Key, Server, CheckCircle2 } from "lucide-react";

/**
 * Página pública de Segurança — Locus Vita
 * Documenta os controles de segurança implementados.
 * Rota: /seguranca
 * Acessível sem autenticação e via Ajustes.
 */

const controles = [
  {
    icon: Lock,
    titulo: "Row Level Security (RLS)",
    descricao:
      "Todas as tabelas clínicas têm RLS ativado no banco de dados. Cada usuário acessa apenas os dados do seu grupo familiar. Nenhuma query retorna dados de outro usuário, mesmo que a requisição seja manipulada.",
  },
  {
    icon: Key,
    titulo: "Autenticação Biométrica (WebAuthn / Passkeys)",
    descricao:
      "O Locus Vita suporta autenticação com Face ID e Touch ID via padrão FIDO2/WebAuthn. Nenhuma senha é transmitida pela rede — a autenticação usa criptografia de chave pública armazenada no dispositivo.",
  },
  {
    icon: Eye,
    titulo: "Signed URLs para arquivos clínicos",
    descricao:
      "Receitas, laudos e documentos de exames são armazenados em buckets privados. O acesso é sempre feito via URLs temporárias (TTL de 15 minutos) geradas sob demanda. Nenhum arquivo clínico tem URL pública permanente.",
  },
  {
    icon: ShieldCheck,
    titulo: "Criptografia em trânsito e em repouso",
    descricao:
      "Toda comunicação usa TLS 1.3 (HTTPS). Dados em repouso são criptografados pela infraestrutura do Supabase (AES-256) nos servidores PostgreSQL e no Storage.",
  },
  {
    icon: Server,
    titulo: "Edge Functions isoladas",
    descricao:
      "Operações sensíveis (cobrança, webhooks de pagamento, OCR de receitas, envio de e-mails) são executadas em funções serverless isoladas com acesso mínimo ao banco de dados. Erros internos nunca são expostos ao cliente.",
  },
  {
    icon: FileText,
    titulo: "Conformidade com a LGPD",
    descricao:
      "Os dados são tratados com base legal no consentimento explícito (Art. 7, inciso I). Você pode solicitar exportação, correção ou exclusão dos seus dados a qualquer momento. Possuímos Runbook de resposta a incidentes (Art. 48) com prazo de notificação à ANPD de 3 dias úteis.",
  },
];

const SegurancaInfo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) navigate(from);
    else navigate(-1);
  };

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
          <ShieldCheck size={18} className="text-[#78C2AD]" />
          <h1 className="text-base font-bold text-foreground">Segurança e Privacidade</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 max-w-prose mx-auto w-full">

        <div className="text-xs text-muted-foreground">
          Atualizado em junho de 2026
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          A segurança dos seus dados de saúde é uma prioridade central do{" "}
          <strong className="text-foreground">Locus Vita</strong>. Esta página descreve os
          principais controles técnicos e organizacionais implementados para proteger suas
          informações.
        </p>

        {/* Controles */}
        <div className="space-y-4">
          {controles.map(({ icon: Icon, titulo, descricao }) => (
            <div
              key={titulo}
              className="bg-card rounded-xl border border-border/50 p-4 flex gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-[#A7D3CB]/30 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={20} className="text-[#78C2AD]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{titulo}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{descricao}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Documentos relacionados */}
        <div className="border-t border-border/40 pt-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Documentos relacionados</p>
          <div className="space-y-2">
            <button
              onClick={() => navigate("/politica-de-privacidade")}
              className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 text-left hover:bg-muted/40 transition-colors"
            >
              <CheckCircle2 size={16} className="text-[#78C2AD] shrink-0" />
              <span className="text-sm text-foreground">Política de Privacidade</span>
            </button>
            <button
              onClick={() => navigate("/termos-de-uso")}
              className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 text-left hover:bg-muted/40 transition-colors"
            >
              <CheckCircle2 size={16} className="text-[#78C2AD] shrink-0" />
              <span className="text-sm text-foreground">Termos de Uso</span>
            </button>
          </div>
        </div>

        {/* Contato */}
        <div className="bg-[#1C3333]/5 rounded-xl p-4 space-y-1">
          <p className="text-sm font-semibold text-foreground">Contato de Segurança</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Para reportar vulnerabilidades ou dúvidas sobre segurança, entre em contato com
            nossa equipe:{" "}
            <a
              href="mailto:fabio@locustech.com.br"
              className="text-[#78C2AD] underline underline-offset-2"
            >
              fabio@locustech.com.br
            </a>
          </p>
        </div>

        <div className="pb-8" />
      </div>
    </div>
  );
};

export default SegurancaInfo;
