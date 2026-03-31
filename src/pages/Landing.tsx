import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Brain,
  Syringe,
  Package,
  PawPrint,
  Lock,
  Eye,
  FileDown,
  Check,
  ArrowRight,
  Heart,
  Mail,
  AlertTriangle,
  Pill,
  FileX2,
  Bug,
} from "lucide-react";
import locusVitaLogo from "@/assets/locus-vita-logo-landing.jpeg";

/* ─── colour tokens (brand-book hex) ─── */
const BG       = "#f2f0eb";
const DARK     = "#1C3333";
const FG       = "#1a3a4d";
const PEACH    = "#F2A97F";
const MINT     = "#A7D3CB";
const CERULEAN = "#A0C4D7";

/* ─── scroll-reveal hook ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

const Reveal = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

/* ─── section wrapper ─── */
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
const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full font-sans" style={{ background: BG, color: FG }}>
      {/* ──────────── HEADER ──────────── */}
      <header
        className="sticky top-0 z-50 w-full backdrop-blur-md border-b"
        style={{ background: "rgba(244,241,235,0.80)", borderColor: "#e5e1da" }}
      >
        <div className="mx-auto max-w-5xl flex items-center justify-between px-5 md:px-8 lg:px-0 h-20">
          <img
            src={locusVitaLogo}
            alt="Locus Vita"
            className="h-14 md:h-16 w-auto rounded-lg shadow-sm"
          />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold"
              style={{ color: DARK }}
              onClick={() => navigate("/login")}
            >
              Entrar
            </Button>
            <Button
              size="sm"
              className="rounded-full text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
              style={{ background: MINT }}
              onClick={() => navigate("/cadastro")}
            >
              Criar Conta
            </Button>
          </div>
        </div>
      </header>

      {/* ──────────── SEÇÃO 1 — HERO ──────────── */}
      <SectionWrapper className="pt-24 pb-20 text-center">
        <Reveal>
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] tracking-tight"
            style={{ color: DARK }}
          >
            A saúde de quem você ama,
            <br className="hidden sm:block" />{" "}
            <span style={{ color: PEACH }}>organizada</span> em um só lugar.
          </h1>
        </Reveal>
        <Reveal delay={150}>
          <p className="mt-6 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: FG }}>
            O Locus Vita é o único <strong>Family Hub</strong> que usa Inteligência Artificial para
            gerenciar medicamentos, consultas, vacinas e a rotina do seu Pet.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="rounded-full text-lg px-10 py-7 shadow-xl text-white font-bold animate-[pulse_3s_ease-in-out_infinite] hover:scale-105 transition-transform"
              style={{ background: PEACH }}
              onClick={() => navigate("/cadastro")}
            >
              Comece seus 30 Dias Grátis <ArrowRight className="ml-2" size={22} />
            </Button>
            <span className="text-xs tracking-wide" style={{ color: "#999" }}>
              Não exigimos cartão de crédito
            </span>
          </div>
        </Reveal>
      </SectionWrapper>

      {/* ──────────── SEÇÃO 2 — AGITAÇÃO DA DOR (Editorial) ──────────── */}
      <SectionWrapper className="py-20">
        <Reveal>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4"
            style={{ color: DARK }}
          >
            Cuidar da família já dá trabalho.
            <br className="hidden sm:block" /> Organizar a saúde{" "}
            <span className="underline decoration-[#F87171]/40 decoration-wavy underline-offset-4">
              não deveria
            </span>.
          </h2>
          <p className="text-center text-sm mb-12" style={{ color: "#999" }}>
            Reconhece algum desses problemas?
          </p>
        </Reveal>

        <div className="flex flex-col gap-5 max-w-2xl mx-auto">
          {[
            {
              icon: <Pill size={22} />,
              title: "Remédio esquecido",
              desc: "Esquecer a hora do remédio ou ficar sem estoque quando mais precisa.",
            },
            {
              icon: <FileX2 size={22} />,
              title: "Carteira perdida",
              desc: "Perder a carteira de vacinação de papel e não lembrar o histórico.",
            },
            {
              icon: <AlertTriangle size={22} />,
              title: "Receitas ilegíveis",
              desc: "Digitar receitas médicas à mão tentando decifrar a letra do doutor.",
            },
            {
              icon: <Bug size={22} />,
              title: "Vermífugo atrasado",
              desc: "Perder a data do vermífugo, banho ou vacina do seu pet.",
            },
          ].map((pain, i) => (
            <Reveal key={i} delay={i * 100}>
              <div
                className="group flex items-start gap-5 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-default"
                style={{ background: `${DARK}F0`, border: `1px solid ${DARK}` }}
              >
                <span
                  className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-500 group-hover:rotate-12"
                  style={{ background: "rgba(248,113,113,0.15)" }}
                >
                  <span style={{ color: "#F87171" }}>{pain.icon}</span>
                </span>
                <div>
                  <h4 className="font-bold text-white text-base">{pain.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">{pain.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </SectionWrapper>

      {/* ──────────── SEÇÃO 3 — FEATURES KILLER ──────────── */}
      <SectionWrapper className="py-20">
        <Reveal>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4"
            style={{ color: DARK }}
          >
            Tudo resolvido com um toque
          </h2>
          <p className="text-center text-sm mb-14" style={{ color: "#999" }}>
            Funcionalidades que fazem a diferença no dia a dia
          </p>
        </Reveal>

        {[
          {
            icon: <Brain size={36} />,
            emoji: "🪄",
            title: "IA para Receitas",
            desc: "Tire uma foto. Nossa IA lê a letra do médico e cadastra os alarmes automaticamente.",
            bg: MINT,
          },
          {
            icon: <Syringe size={36} />,
            emoji: "💉",
            title: "Importação do SUS",
            desc: "Faça upload do PDF e organizamos seu histórico de vacinas em segundos.",
            bg: CERULEAN,
          },
          {
            icon: <Package size={36} />,
            emoji: "📦",
            title: "Estoque Inteligente",
            desc: "Avisamos quando a caixa do seu remédio de uso contínuo está acabando.",
            bg: MINT,
          },
          {
            icon: <PawPrint size={36} />,
            emoji: "🐾",
            title: "Rotina Pet",
            desc: "Banhos, vacinas e vermífugos agendados automaticamente com recorrência.",
            bg: CERULEAN,
          },
        ].map((f, i) => {
          const reverse = i % 2 !== 0;
          return (
            <Reveal key={i} delay={i * 80}>
              <div
                className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-10 mb-16`}
              >
                {/* icon block */}
                <div
                  className="flex h-32 w-32 shrink-0 items-center justify-center rounded-3xl shadow-lg transition-transform duration-300 hover:scale-105"
                  style={{ background: `${f.bg}30` }}
                >
                  <span className="text-6xl drop-shadow-sm">{f.emoji}</span>
                </div>
                {/* text */}
                <div className={reverse ? "text-center md:text-right" : "text-center md:text-left"}>
                  <h3 className="text-xl md:text-2xl font-bold" style={{ color: DARK }}>
                    {f.title}
                  </h3>
                  <p className="mt-3 max-w-md text-sm md:text-base leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </SectionWrapper>

      {/* ──────────── SEÇÃO 4 — SEGURANÇA & LGPD ──────────── */}
      <SectionWrapper className="py-20" style={{ background: DARK }}>
        <Reveal>
          <div className="text-center mb-12">
            <ShieldCheck size={48} color={MINT} className="mx-auto mb-5" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
              Sua família não é o nosso produto.
              <br className="hidden sm:block" /> A privacidade é nossa{" "}
              <span style={{ color: MINT }}>regra número 1</span>.
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Lock size={26} />,
              title: "100% Local",
              desc: "A importação da carteira do SUS usa um parser matemático fechado. Seus dados não vão para nenhuma IA externa.",
            },
            {
              icon: <Eye size={26} />,
              title: "IA com Retenção Zero",
              desc: "Ao ler receitas ou exames com IA, a imagem é processada e descartada no mesmo milissegundo. A IA não aprende com seus dados.",
            },
            {
              icon: <FileDown size={26} />,
              title: "O Controle é Seu",
              desc: "Exporte seu Resumo Eletrônico de Saúde (RES) apenas para quem você confia.",
            },
          ].map((c, i) => (
            <Reveal key={i} delay={i * 120}>
              <Card
                className="border-none shadow-none h-full transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
                style={{ background: "#243f3f" }}
              >
                <CardContent className="p-7 text-center">
                  <span
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: `${MINT}20` }}
                  >
                    <span style={{ color: MINT }}>{c.icon}</span>
                  </span>
                  <h4 className="font-bold text-white text-lg">{c.title}</h4>
                  <p className="mt-3 text-sm leading-relaxed text-white/65">{c.desc}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </SectionWrapper>

      {/* ──────────── SEÇÃO 5 — PRECIFICAÇÃO ──────────── */}
      <SectionWrapper className="py-20">
        <Reveal>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3" style={{ color: DARK }}>
            Invista na tranquilidade da sua família
          </h2>
          <p className="text-center text-sm mb-12" style={{ color: "#999" }}>
            Cancele quando quiser. Sem burocracia.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Básico */}
          <Reveal delay={0}>
            <Card className="rounded-2xl border h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg" style={{ borderColor: "#ddd" }}>
              <CardContent className="p-7 text-center flex flex-col items-center">
                <Badge className="mb-5 text-xs px-4 py-1" style={{ background: `${MINT}30`, color: DARK }}>
                  Básico
                </Badge>
                <p className="text-5xl font-extrabold" style={{ color: DARK }}>
                  Grátis
                </p>
                <p className="mt-3 text-sm leading-relaxed">Teste todas as funções Premium por 30 dias.</p>
                <Button
                  className="mt-8 w-full rounded-full text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
                  style={{ background: MINT }}
                  onClick={() => navigate("/login")}
                >
                  Começar Agora
                </Button>
              </CardContent>
            </Card>
          </Reveal>

          {/* Mensal */}
          <Reveal delay={120}>
            <Card className="rounded-2xl border h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg" style={{ borderColor: "#ddd" }}>
              <CardContent className="p-7 text-center flex flex-col items-center">
                <Badge className="mb-5 text-xs px-4 py-1" style={{ background: `${CERULEAN}30`, color: DARK }}>
                  Mensal
                </Badge>
                <p className="text-5xl font-extrabold" style={{ color: DARK }}>
                  R$ 19,90
                  <span className="text-base font-normal">/mês</span>
                </p>
                <p className="mt-3 text-sm">Cancele quando quiser.</p>
                <Button
                  className="mt-8 w-full rounded-full text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
                  style={{ background: MINT }}
                  onClick={() => navigate("/login")}
                >
                  Assinar
                </Button>
              </CardContent>
            </Card>
          </Reveal>

          {/* Anual (destaque) */}
          <Reveal delay={240}>
            <Card
              className="rounded-2xl border-2 relative shadow-xl h-full transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
              style={{ borderColor: PEACH }}
            >
              <div
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-5 py-1 text-xs font-bold text-white tracking-wide shadow-md"
                style={{ background: PEACH }}
              >
                Mais Popular
              </div>
              <CardContent className="p-7 text-center flex flex-col items-center pt-10">
                <Badge className="mb-5 text-xs px-4 py-1" style={{ background: `${PEACH}30`, color: DARK }}>
                  Anual
                </Badge>
                <p className="text-5xl font-extrabold" style={{ color: DARK }}>
                  R$ 191,00
                  <span className="text-base font-normal">/ano</span>
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: PEACH }}>
                  Apenas R$ 15,90/mês — 20% OFF
                </p>
                <Button
                  className="mt-8 w-full rounded-full text-white font-bold shadow-lg hover:shadow-xl transition-shadow"
                  style={{ background: PEACH }}
                  onClick={() => navigate("/login")}
                >
                  Assinar com Desconto
                </Button>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </SectionWrapper>

      {/* ──────────── SEÇÃO 6 — FOOTER ──────────── */}
      <footer
        className="w-full border-t py-12 mt-8"
        style={{ background: BG, borderColor: "#e5e1da" }}
      >
        <div className="mx-auto max-w-5xl px-5 md:px-8 lg:px-0 flex flex-col items-center gap-6 text-sm">
          <img
            src={locusVitaLogo}
            alt="Locus Vita"
            className="h-10 w-auto rounded-lg opacity-70"
          />
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs" style={{ color: "#888" }}>
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
          <span className="text-xs" style={{ color: "#bbb" }}>
            Saúde Familiar Simplificada
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
