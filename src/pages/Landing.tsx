import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Brain,
  Syringe,
  Package,
  PawPrint,
  X,
  Lock,
  Eye,
  FileDown,
  Check,
  ArrowRight,
  Heart,
  Mail,
} from "lucide-react";
import locusVitaLogo from "@/assets/locus-vita-logo-landing.jpeg";

/* ─── colour tokens (brand-book hex) ─── */
const BG       = "#f2f0eb";
const DARK     = "#1C3333";
const FG       = "#1a3a4d";
const PEACH    = "#F2A97F";
const MINT     = "#A7D3CB";
const CERULEAN = "#A0C4D7";

/* ─── tiny helpers ─── */
const SectionWrapper = ({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <section className={`w-full px-5 md:px-8 lg:px-0 ${className}`} style={style}>
    <div className="mx-auto max-w-5xl">{children}</div>
  </section>
);

/* ================================================================== */
/*  LANDING PAGE                                                       */
/* ================================================================== */
const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full font-sans" style={{ background: BG, color: FG }}>
      {/* ──────────── HEADER (glassmorphism) ──────────── */}
      <header
        className="sticky top-0 z-50 w-full backdrop-blur-md border-b"
        style={{ background: "rgba(244,241,235,0.80)", borderColor: "#e5e1da" }}
      >
        <div className="mx-auto max-w-5xl flex items-center justify-between px-5 md:px-8 lg:px-0 h-14">
          <img src={locusVitaLogo} alt="Locus Vita" className="h-10 w-auto rounded" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button
              size="sm"
              className="rounded-full text-white"
              style={{ background: MINT }}
              onClick={() => navigate("/login")}
            >
              Criar Conta
            </Button>
          </div>
        </div>
      </header>

      {/* ──────────── SEÇÃO 1 — HERO ──────────── */}
      <SectionWrapper className="pt-20 pb-16 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight"
          style={{ color: DARK }}
        >
          A saúde de quem você ama,
          <br className="hidden sm:block" /> organizada em um só lugar.
        </h1>
        <p className="mt-5 text-base sm:text-lg max-w-2xl mx-auto" style={{ color: FG }}>
          O Locus Vita é o único <strong>Family Hub</strong> que usa Inteligência Artificial para
          gerenciar medicamentos, consultas, vacinas e a rotina do seu Pet.
        </p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button
            size="lg"
            className="rounded-full text-lg px-8 py-6 shadow-xl text-white font-semibold"
            style={{ background: PEACH }}
            onClick={() => navigate("/login")}
          >
            Comece seus 30 Dias Grátis <ArrowRight className="ml-2" size={20} />
          </Button>
          <span className="text-xs" style={{ color: "#888" }}>
            Não exigimos cartão de crédito
          </span>
        </div>
      </SectionWrapper>

      {/* ──────────── SEÇÃO 2 — AGITAÇÃO DA DOR ──────────── */}
      <SectionWrapper className="py-16">
        <div className="rounded-2xl p-8 md:p-12" style={{ background: "#fff" }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-center" style={{ color: DARK }}>
            Cuidar da família já dá trabalho.
            <br className="hidden sm:block" /> Organizar a saúde não deveria.
          </h2>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              "Esquecer a hora do remédio ou ficar sem estoque.",
              "Perder a carteira de vacinação de papel.",
              "Digitar receitas médicas à mão.",
              "Perder a data do vermífugo do cachorro.",
            ].map((pain, i) => (
              <Card key={i} className="border-none shadow-sm" style={{ background: "#faf8f5" }}>
                <CardContent className="flex items-start gap-3 p-5">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "#fde8e8" }}
                  >
                    <X size={16} color="#ef4444" />
                  </span>
                  <p className="text-sm leading-relaxed line-through decoration-red-400/60">
                    {pain}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SectionWrapper>

      {/* ──────────── SEÇÃO 3 — FEATURES KILLER ──────────── */}
      <SectionWrapper className="py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12" style={{ color: DARK }}>
          Tudo resolvido com um toque
        </h2>

        {[
          {
            icon: <Brain size={32} />,
            emoji: "🪄",
            title: "IA para Receitas",
            desc: "Tire uma foto. Nossa IA lê a letra do médico e cadastra os alarmes.",
          },
          {
            icon: <Syringe size={32} />,
            emoji: "💉",
            title: "Importação do SUS",
            desc: "Faça upload do PDF e organizamos seu histórico de vacinas em segundos.",
          },
          {
            icon: <Package size={32} />,
            emoji: "📦",
            title: "Estoque Inteligente",
            desc: "Avisamos quando a caixa do seu remédio de uso contínuo está acabando.",
          },
          {
            icon: <PawPrint size={32} />,
            emoji: "🐾",
            title: "Rotina Pet",
            desc: "Banhos e vacinas agendados automaticamente.",
          },
        ].map((f, i) => {
          const reverse = i % 2 !== 0;
          return (
            <div
              key={i}
              className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-8 mb-14`}
            >
              {/* icon block */}
              <div
                className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl"
                style={{ background: i % 2 === 0 ? `${MINT}30` : `${CERULEAN}30` }}
              >
                <span className="text-5xl">{f.emoji}</span>
              </div>
              {/* text */}
              <div className={reverse ? "text-center md:text-right" : "text-center md:text-left"}>
                <h3 className="text-xl font-bold" style={{ color: DARK }}>
                  {f.title}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          );
        })}
      </SectionWrapper>

      {/* ──────────── SEÇÃO 4 — SEGURANÇA & LGPD ──────────── */}
      <SectionWrapper className="py-16" style={{ background: DARK }}>
        <div className="text-center mb-10">
          <ShieldCheck size={40} color={MINT} className="mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Sua família não é o nosso produto.
            <br className="hidden sm:block" /> A privacidade é nossa regra número 1.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: <Lock size={24} />,
              title: "100% Local",
              desc: "A importação da carteira do SUS usa um parser matemático fechado. Seus dados não vão para nenhuma IA externa.",
            },
            {
              icon: <Eye size={24} />,
              title: "IA com Retenção Zero",
              desc: "Ao ler receitas ou exames com IA, a imagem é processada e descartada no mesmo milissegundo. A IA não aprende com seus dados.",
            },
            {
              icon: <FileDown size={24} />,
              title: "O Controle é Seu",
              desc: "Exporte seu Resumo Eletrônico de Saúde (RES) apenas para quem você confia.",
            },
          ].map((c, i) => (
            <Card key={i} className="border-none shadow-none" style={{ background: "#243f3f" }}>
              <CardContent className="p-6 text-center">
                <span
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: `${MINT}25` }}
                >
                  {(() => {
                    const Icon = c.icon;
                    return <span style={{ color: MINT }}>{Icon}</span>;
                  })()}
                </span>
                <h4 className="font-semibold text-white">{c.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{c.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </SectionWrapper>

      {/* ──────────── SEÇÃO 5 — PRECIFICAÇÃO ──────────── */}
      <SectionWrapper className="py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3" style={{ color: DARK }}>
          Invista na tranquilidade da sua família
        </h2>
        <p className="text-center text-sm mb-10" style={{ color: "#888" }}>
          Cancele quando quiser. Sem burocracia.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Básico */}
          <Card className="rounded-2xl border" style={{ borderColor: "#ddd" }}>
            <CardContent className="p-6 text-center flex flex-col items-center">
              <Badge className="mb-4 text-xs" style={{ background: `${MINT}30`, color: DARK }}>
                Básico
              </Badge>
              <p className="text-4xl font-extrabold" style={{ color: DARK }}>
                Grátis
              </p>
              <p className="mt-2 text-sm">Teste todas as funções Premium por 30 dias.</p>
              <Button
                className="mt-6 w-full rounded-full text-white"
                style={{ background: MINT }}
                onClick={() => navigate("/login")}
              >
                Começar Agora
              </Button>
            </CardContent>
          </Card>

          {/* Mensal */}
          <Card className="rounded-2xl border" style={{ borderColor: "#ddd" }}>
            <CardContent className="p-6 text-center flex flex-col items-center">
              <Badge className="mb-4 text-xs" style={{ background: `${CERULEAN}30`, color: DARK }}>
                Mensal
              </Badge>
              <p className="text-4xl font-extrabold" style={{ color: DARK }}>
                R$ 19,90
                <span className="text-base font-normal">/mês</span>
              </p>
              <p className="mt-2 text-sm">Cancele quando quiser.</p>
              <Button
                className="mt-6 w-full rounded-full text-white"
                style={{ background: MINT }}
                onClick={() => navigate("/login")}
              >
                Assinar
              </Button>
            </CardContent>
          </Card>

          {/* Anual (destaque) */}
          <Card
            className="rounded-2xl border-2 relative shadow-lg"
            style={{ borderColor: PEACH }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-0.5 text-xs font-semibold text-white"
              style={{ background: PEACH }}
            >
              Mais Popular
            </div>
            <CardContent className="p-6 text-center flex flex-col items-center pt-8">
              <Badge className="mb-4 text-xs" style={{ background: `${PEACH}30`, color: DARK }}>
                Anual
              </Badge>
              <p className="text-4xl font-extrabold" style={{ color: DARK }}>
                R$ 191,00
                <span className="text-base font-normal">/ano</span>
              </p>
              <p className="mt-1 text-sm font-medium" style={{ color: PEACH }}>
                Apenas R$ 15,90/mês — 20% OFF
              </p>
              <Button
                className="mt-6 w-full rounded-full text-white font-semibold shadow-md"
                style={{ background: PEACH }}
                onClick={() => navigate("/login")}
              >
                Assinar com Desconto
              </Button>
            </CardContent>
          </Card>
        </div>
      </SectionWrapper>

      {/* ──────────── SEÇÃO 6 — FOOTER ──────────── */}
      <footer
        className="w-full border-t py-10 mt-8"
        style={{ background: BG, borderColor: "#e5e1da" }}
      >
        <div className="mx-auto max-w-5xl px-5 md:px-8 lg:px-0 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Heart size={16} style={{ color: PEACH }} />
            <span className="font-semibold" style={{ color: DARK }}>
              Locus Vita
            </span>
            <span style={{ color: "#aaa" }}>· Saúde Familiar Simplificada</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs" style={{ color: "#888" }}>
            <a href="#" className="hover:underline">
              Termos de Uso
            </a>
            <a href="#" className="hover:underline">
              Privacidade (LGPD)
            </a>
            <a href="mailto:suporte.vita@locustech.com.br" className="flex items-center gap-1 hover:underline">
              <Mail size={12} /> suporte.vita@locustech.com.br
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
