---
name: locus-vita-spec
description: Gera documentação SPEC estruturada para novas funcionalidades do Locus Vita. Use SEMPRE que Fábio mencionar "spec", "PRD", "documentar feature", "especificação de produto", "quero construir X no Locus", "nova funcionalidade", "preciso documentar", ou quando descrever uma ideia de feature a ser implementada. Conduz uma entrevista guiada com visão de Sênior PM de Saúde e gera um arquivo .docx completo e enxuto, pronto para o workflow Claude Cowork → Lovable → GitHub.
---

# Locus Vita — Gerador de SPEC de Funcionalidade

## O que esta skill faz

Conduz uma entrevista estruturada com Fábio para coletar os requisitos de uma nova feature, depois gera um documento `.docx` seguindo o template padrão do projeto. O documento opera em **duas camadas simultâneas**:

- **Camada técnica**: o que construir, como, arquitetura — para a IA (Lovable) executar
- **Camada SPM de saúde**: por que construir, para quem exatamente, que comportamento de saúde endereça, quais riscos clínicos e regulatórios — para o produto ser relevante e seguro

O resultado é um SPEC que uma IA consegue implementar E que um investidor de saúde digital consegue ler.

---

## Perspectiva do Sênior Product Manager de Saúde

Esta é a lente que diferencia o Locus Vita de um app de to-do list com cores de saúde. Antes de qualquer pergunta técnica, um SPM de saúde sabe que:

### 1. Saúde não é SaaS comum — as apostas são maiores

Uma notificação enviada na hora errada pode levar à dose dupla de um medicamento. Um resultado de exame exibido sem contexto pode gerar pânico desnecessário. Um fluxo confuso pode fazer um cuidador desistir do tratamento de quem depende dele. **Cada feature tem potencial de causar dano ou bem à saúde de alguém** — e isso precisa estar no SPEC.

### 2. Comportamento de saúde é complexo — use o modelo COM-B

Para qualquer feature que busca mudar ou apoiar um comportamento de saúde (aderir a medicamentos, comparecer a consultas, vacinar, monitorar pressão), identificar qual perna do triângulo está quebrada:

```
Capability (Capacidade)   — O usuário sabe como fazer? Consegue fisicamente?
Opportunity (Oportunidade) — O ambiente (app, família, rotina) facilita?
Motivation (Motivação)    — O usuário quer fazer? Acredita que vale a pena?
          ↓
       Behavior (Comportamento)
```

- **Gap de capacidade** → solução: educação, simplificação, redução de fricção
- **Gap de oportunidade** → solução: lembretes, notificações, suporte social (grupo familiar)
- **Gap de motivação** → solução: framing de perda, feedback positivo, social proof

### 3. O usuário Locus Vita tem dois papéis — paciente e cuidador

No contexto brasileiro, o titular frequentemente é **simultaneamente**:
- Paciente gerenciando a própria saúde
- Cuidador de pais idosos ou filhos com condição crônica

Features devem considerar o **cuidador distante**, a **mãe como gerenciadora central da saúde familiar**, e o **idoso com baixa fluência digital** que será gerenciado por outro.

### 4. Letramento em saúde no Brasil é baixo — design para o menor denominador

Apenas 18% dos brasileiros obtêm informação de saúde por base educacional formal. Features de saúde devem ser compreensíveis para quem tem escolaridade fundamental — sem jargão clínico não explicado.

### 5. LGPD — dados de saúde são "dados sensíveis" (Art. 11)

- Requerem **consentimento específico, destacado e para finalidade específica**
- Princípio da **minimização**: coletar só o necessário
- Direito ao esquecimento: deleção deve ser possível e cascata (soft-delete já implementado)

### 6. Frameworks-chave para o SPEC de saúde

| Framework | Quando usar | Aplicação no Locus Vita |
|-----------|------------|-------------------------|
| **COM-B** | Problema envolve mudança de comportamento | Identifica por que o usuário não adere ao tratamento hoje |
| **Jobs-to-Be-Done** | Definir o "trabalho" real da feature | O job não é "tomar remédio" — é "não deixar minha mãe ter uma crise" |
| **Carga do cuidador** | Features para grupo familiar | Cuidador secundário (remoto) tem limitações de tempo e visibilidade |
| **Segurança clínica** | Qualquer feature que exibe ou age sobre dados clínicos | O que acontece se o dado exibido for interpretado errado? |

---

## Etapa 0 — Antes de iniciar

**Obrigatório ao iniciar qualquer atividade de especificação.** Ler o arquivo de instruções do projeto para garantir que padrões arquiteturais, Design System e estrutura de salvamento estão atualizados em contexto:

```
/Users/fabio/locus-family-health/docs/LOCUS_VITA_PROJECT_INSTRUCTIONS_v3.3.md
```

Prestar atenção especial a:
- Seção 1 — Módulos existentes (evitar duplicar o que já existe)
- Seção 3 — Arquitetura de Dados (tabelas, FK, soft-delete)
- Seção 10 — Design System (paleta, layout A/B, componentes, ClinicalTimeline)
- Seção 11 — Estrutura de Documentação (salvar SPEC em `docs/prds/SPEC_[NomeFeature]_v1.0.docx`)

---

## Processo — 3 etapas

### Etapa 1 — Entrevista SPM de Saúde

Faça as perguntas **em sequência, uma de cada vez**. Se Fábio já deu muito contexto, extraia as respostas e confirme rapidamente.

#### Bloco A — Produto e problema (técnico + saúde)

| # | O que coletar | Lente SPM de Saúde |
|---|---------------|--------------------|
| 1 | **Nome da feature** e módulo | — |
| 2 | **Problema** — quem é impactado, qual a dor, custo de não ter | Temos evidência real? (relatos de usuários, dados de uso?) |
| 3 | **Comportamento de saúde endereçado** | Aplicar COM-B: qual perna está quebrada? |
| 4 | **Personas** envolvidas | Paciente, cuidador primário ou cuidador secundário (remoto)? |

#### Bloco B — Solução e regras (técnico)

| # | O que coletar | Dica |
|---|---------------|------|
| 5 | **User Stories** (3-5 máx.) com critério de aceite | "Como X, quero Y para Z" + "Dado/Quando/Então" |
| 6 | **Regras de negócio** críticas | Só as determinísticas — fórmulas, validações, restrições |
| 7 | **Arquitetura de alto nível** — arquivos tocados, criados, mudança de banco | Usar contexto do projeto |
| 8 | **Padrão de layout de página** — qual dos dois padrões (A ou B)? Tem tabs? Sort? Swipe? | Ver seção "Design System" abaixo |
| 9 | **Requisitos não-funcionais específicos** — além dos defaults | Performance, storage, integrações |

#### Bloco C — Saúde, regulação e risco

| # | O que coletar | Por que importa |
|---|---------------|-----------------|
| 10 | **Segurança clínica**: o que acontece à saúde do usuário se a feature falhar ou for mal interpretada? | Dose dupla? Pânico com dado clínico? Abandono de tratamento? |
| 11 | **LGPD / dados sensíveis**: esta feature abre um novo tipo de processamento de dado de saúde? | Se sim, precisa de nova entrada em `consent_log` + base legal explícita |
| 12 | **Riscos e dependências** | Blockers, débito técnico relacionado, integrações externas |

---

### Etapa 2 — Confirmar e complementar

Antes de gerar, apresente um resumo de uma linha por seção e pergunte:
- "Há algum risco de saúde ou regulatório não óbvio que precisamos documentar?"
- "Algo a ajustar antes de gerar?"

---

### Etapa 3 — Gerar o documento

Use o script `scripts/generate_spec.py` passando o contexto JSON. Salve **obrigatoriamente** em `docs/prds/SPEC_[NomeFeature]_v1.0.docx` dentro do repositório do projeto (`/Users/fabio/locus-family-health/`) e apresente via `present_files`.

**Destino canônico:** `/Users/fabio/locus-family-health/docs/prds/SPEC_[NomeFeature]_v[versao].docx`

---

## Estrutura do documento gerado

```
[Cabeçalho] — Tabela de metadados
1. VISÃO GERAL — Resumo executivo + KPIs (negócio + saúde) + Impacto em Saúde Esperado + Escopo
2. PROBLEMA — Problema, personas com contexto de cuidado, evidências + Contexto Comportamental (COM-B)
3. USER STORIES — Tabela ID | Story | Critério de Aceite | Prioridade
4. FLUXO PRINCIPAL — Passos + fluxos alt. + casos de borda
5. REGRAS DE NEGÓCIO — Tabela ID | Regra | Lógica/Fórmula | Exemplo
6. REQUISITOS NÃO-FUNCIONAIS — Tabela com defaults pré-preenchidos
7. ARQUITETURA — Componentes (Criar/Modificar) + Modelo de dados + Migration + Padrão Visual
8. SAÚDE, REGULAÇÃO E RISCOS — Segurança clínica + LGPD + Roadmap + Riscos + Prompt Lovable
```

### Seção 1.2 — Impacto em Saúde Esperado
Além dos KPIs de negócio, qual comportamento de saúde muda e como medir?

### Seção 2.1 — Contexto Comportamental (COM-B)
Qual perna está quebrada, qual é a barreira real, e como a feature a endereça.

### Seção 8.1 — Considerações de Saúde e Regulatórias

| Dimensão | Avaliação | Ação necessária |
|----------|-----------|-----------------|
| Segurança clínica | Risco de dano se falhar ou mal interpretada | Salvaguardas no design |
| LGPD dados sensíveis | Novo processamento de dado de saúde? | Registro em consent_log |
| Letramento em saúde | Conteúdo acessível para escolaridade fundamental? | Revisão de linguagem |
| Regulação setorial | Toca CFM / ANVISA / ANS? | Flag para avaliação jurídica |

---

## Defaults pré-preenchidos na seção 6 (Requisitos Não-Funcionais)

| Categoria | Requisito | Critério de Aceite |
|-----------|-----------|-------------------|
| Mobile/PWA | Inputs e selects com font-size ≥ 16px | Sem auto-zoom no iOS |
| Segurança | RLS aplicado em todas as queries | Nenhuma row acessível fora do grupo familiar |
| Performance | Queries com staleTime ≥ 5 min no React Query | Sem refetch desnecessário |
| Privacidade/LGPD | Arquivos clínicos em buckets privados com Signed URLs | TTL 15 min, auto-renova |
| Soft-delete | Entidades clínicas respeitam cascade_soft_delete | Inner join + filtro deleted_at |
| Letramento | Textos de interface sem jargão clínico não explicado | Testável por usuário com ensino fundamental |

---

## Gates de qualidade do SPEC

### Gates técnicos
- **Sem over-documentation**: seções sem conteúdo são removidas
- **User Stories**: máximo 5; mais do que isso → duas features distintas
- **Arquitetura**: só arquivos criados ou substantivamente modificados
- **Tamanho alvo**: 3-5 páginas A4

### Gates SPM de saúde
```
[ ] O problema está ancorado em evidência real, não só intuição?
[ ] Ao menos um KPI mede comportamento ou resultado em saúde?
[ ] A análise COM-B identifica claramente a barreira?
[ ] As personas consideram o papel de cuidador onde relevante?
[ ] O estado emocional do usuário no momento de uso foi considerado?
[ ] A feature tem risco de dano clínico se falhar? Está documentado com mitigação?
[ ] A feature abre novo processamento de dado de saúde? Consentimento mapeado?
[ ] O conteúdo de interface é acessível para letramento em saúde básico?
[ ] O design considera conectividade limitada (3G) e devices básicos?
```

---

## Como usar o script

```bash
python3 scripts/generate_spec.py --context context.json --output "SPEC_[NomeFeature]_v1.0.docx"
```

**Passos:**
1. Montar o dicionário de contexto com respostas da entrevista
2. Salvar como `context.json` em `/tmp/`
3. Executar o script com `--output` apontando para `docs/prds/`
4. Salvar em `/Users/fabio/locus-family-health/docs/prds/SPEC_[NomeFeature]_v1.0.docx`
5. Apresentar via `present_files`

```bash
python3 scripts/generate_spec.py \
  --context /tmp/context.json \
  --output "/Users/fabio/locus-family-health/docs/prds/SPEC_NomeFeature_v1.0.docx"
```

---

## Contexto do projeto disponível

Esta skill roda dentro do projeto Locus Vita. As instruções do projeto já contêm:
- Estrutura de pastas completa (`src/`, `supabase/functions/`, etc.)
- Padrões de código obrigatórios (hooks, edge functions, datas, queries)
- Arquitetura de dados (tabelas, RLS, RBAC)
- Motor financeiro (Asaas, Grace Period, subscriptions)

Use esse contexto para preencher automaticamente a seção 7 (Arquitetura) e os defaults de requisitos não-funcionais, sem precisar perguntar o que já está definido.

---

## Design System do App — Referência Completa para Seção 7.4

> Esta seção é o mapa real do codebase, extraído das páginas existentes.
> Use-a para especificar layouts e componentes novos com precisão cirúrgica.
> O Lovable deve receber os nomes exatos — não descrições genéricas.

---

### 7.4.1 — Dois padrões de layout de página

**Padrão A — Scroll simples** (Consultas, Exames, Alergias, **Cirurgias** — padrão preferencial para módulos de histórico clínico)
```tsx
<>
  <AddConsultationDrawer ... />
  <div className="px-4 pt-6 pb-28 animate-fade-in">
    <div className="flex items-center gap-3 mb-6">
      <Button variant="ghost" size="icon" onClick={goBack}>
        <ArrowLeft size={22} />
      </Button>
      <h1 className="text-lg font-bold text-foreground flex-1">Título</h1>
      {/* ícone de export Share2 aqui se necessário */}
    </div>
    {/* conteúdo */}
  </div>
  {!drawerOpen && <FixedFAB onClick={handleAdd} />}
</>
```
- Usar quando a página não precisa de header fixo com tabs
- `pb-28` garante que o FAB não sobreponha o último item
- `animate-fade-in` é obrigatório em todas as páginas

**Padrão B — Container fixo com scroll interno** (FamiliarProfile; Surgeries original — mas módulo de Cirurgias foi **refatorado para Padrão A** durante implementação)
```tsx
<div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
  {/* Header fixo */}
  <div className="flex-none bg-background border-b border-border px-4 py-3 flex items-center gap-3">
    <button onClick={goBack} className="p-1 -ml-1" aria-label="Voltar">
      <ArrowLeft size={22} className="text-foreground" />
    </button>
    <h1 className="text-lg font-semibold text-foreground">Título</h1>
  </div>
  {/* Área de tabs (se houver) */}
  {/* Conteúdo com scroll interno */}
  <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
    {/* itens */}
    <div className="h-20" /> {/* espaço para FAB */}
  </div>
  {/* FAB inline — NÃO usar FixedFAB no Padrão B */}
  <button
    className="absolute bottom-6 right-4 w-14 h-14 bg-[#E8916C] hover:bg-[#d4805d] active:bg-[#bf7052] text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
    aria-label="Adicionar item"
  >
    <Plus size={28} />
  </button>
</div>
```
- Usar quando a página tem tabs fixas abaixo do header
- `bottom-[72px]` = altura da BottomNav
- O FAB **inline** substitui o componente `<FixedFAB>` no Padrão B

**Regra de escolha**: se a página tem tabs, use Padrão B. Se não tem tabs, use Padrão A.

---

### 7.4.2 — Dois padrões de tabs

**Pill (padrão preferido para maioria dos módulos)** — extraído de Consultas, Exames
```tsx
<div className="mb-4 flex items-center gap-2">
  <div className="flex p-1 bg-slate-100 rounded-xl flex-1">
    <button
      onClick={() => setAbaAtiva('proximas')}
      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
        abaAtiva === 'proximas'
          ? 'bg-white text-slate-900 shadow-xs'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      Ativas
    </button>
    <button
      onClick={() => setAbaAtiva('historico')}
      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
        abaAtiva === 'historico'
          ? 'bg-white text-slate-900 shadow-xs'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      Concluídas
    </button>
  </div>
  {/* Sort button ao lado, se necessário */}
</div>
```
Usar no **Padrão A** (página sem header fixo).

**Underline (usar quando header é fixo / Padrão B)** — extraído de Surgeries
```tsx
<div className="flex-none bg-background border-b border-border/40">
  <div className="flex">
    <button
      onClick={() => setActiveTab("scheduled")}
      className={`flex-1 py-3 text-base font-medium border-b-2 transition-colors ${
        activeTab === "scheduled"
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground"
      }`}
    >
      Agendadas ({scheduled.length})
    </button>
    <button
      onClick={() => setActiveTab("done")}
      className={`flex-1 py-3 text-base font-medium border-b-2 transition-colors ${
        activeTab === "done"
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground"
      }`}
    >
      Concluídas ({done.length})
    </button>
  </div>
</div>
```
- Sempre `text-base` (16px) nos botões de tab — nunca `text-sm` aqui
- Incluir contagem `({lista.length})` quando relevante

**Regra de escolha**: Padrão A → tabs pill. Padrão B → tabs underline (border-b-2).

---

### 7.4.3 — FAB (Floating Action Button)

**Componente `<FixedFAB>` — usar no Padrão A**
```tsx
import FixedFAB from "@/components/ui/FixedFAB";
// ...
{!drawerOpen && <FixedFAB onClick={() => setDrawerOpen(true)} />}
```
- Cor: `bg-[#FFB085]` (laranja claro) — definida no componente
- Safe-area automática: `bottom: calc(4rem + env(safe-area-inset-bottom, 0px) + 1rem)`
- **Nunca usar no Padrão B** (o FAB inline já está posicionado corretamente)

**FAB inline — usar no Padrão B**
```tsx
<button
  onClick={() => setDrawerOpen(true)}
  className="absolute bottom-6 right-4 w-14 h-14 bg-[#E8916C] hover:bg-[#d4805d] active:bg-[#bf7052] text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
  aria-label="Adicionar [entidade]"
>
  <Plus size={28} />
</button>
```
- Cor: `bg-[#E8916C]` (laranja escuro) — diferente do FixedFAB

---

### 7.4.4 — SwipeableActionCard

Componente padrão para listas de itens clínicos (Consultas, Exames, PetRotinas). Fornece swipe-left para deletar e swipe-right para ação contextual.

```tsx
import SwipeableActionCard from "@/components/SwipeableActionCard";

<SwipeableActionCard
  onDelete={handleDelete}
  disableDelete={!isAdmin}   // não-admins não podem deletar
  leadingAction={{           // swipe direita = ação contextual (ex: Concluir)
    icon: <CheckCircle size={20} />,
    label: "Concluir",
    bgColor: "bg-[#AEE2D4]",
    textColor: "text-slate-800",
    onAction: handleComplete,
  }}
  isOpen={openCardId === item.id}
  onOpenChange={(open) => setOpenCardId(open ? item.id : null)}
>
  {/* conteúdo do card */}
</SwipeableActionCard>
```

**Quando usar**: toda listagem de entidades clínicas com ações de editar/deletar/concluir. Substitui botões dentro do card que poluem o layout.

**Quando NÃO usar**: cards informativos sem ações (ex: cards de vacina apenas leitura), ou quando a tela usa Padrão B com cards simples (ex: SurgeryCard).

---

### 7.4.5 — Padrão de badge de status

Usar `<Badge>` do shadcn. O Design System define variantes com nome — usar sempre o nome da variante quando disponível.

**Variantes de status (Agenda / eventos clínicos):**

| Variant | Hex de fundo | Uso |
|---------|-------------|-----|
| `scheduled` | `#AEE2D4` | Agendada/o, Ativo, Vacina confirmada |
| `done` | `#F2A97F` | Realizada/o, Concluído |
| `emergency` | `#F87171` | Cancelada/o, Atrasado, Emergência |
| `return` | `#A0C4D7` | Tipo "Retorno" (consulta) |
| `exam` | `#FFF4A3` | Tipo "Exame" (na Agenda) |
| `surgery` | `oklch(0.88 0.06 250)` | Tipo "Cirurgia" (na Agenda) |
| `consultation` | `#DCC5F1` | Tipo "Consulta" — Lavender |

**Quando não houver variante disponível, usar classes explícitas:**

```tsx
const statusColors: Record<string, string> = {
  Agendada:  "bg-[#AEE2D4] text-slate-800 border-none",
  Realizada: "bg-[#F2A97F] text-slate-900 border-none",
  Cancelada: "bg-[#F87171] text-white border-none",
  Retorno:   "bg-[#A0C4D7] text-slate-800 border-none",
  Exame:     "bg-[#FFF4A3] text-slate-800 border-none",
  Consulta:  "bg-[#DCC5F1] text-slate-800 border-none",
};
<Badge className={statusColors[item.status] ?? "bg-muted text-muted-foreground"}>
  {item.status}
</Badge>
```

**Medicamentos:**
- Ativo: `bg-[#F2A97F] text-black`
- Inativo: `bg-[#A7D3CB] text-black`

**Regra**: nunca inventar cores fora das tabelas acima. Fallback obrigatório (`bg-muted`) para status não mapeados.

---

### 7.4.6 — Loading state e Empty state

**Loading** — dois padrões dependendo do contexto:
```tsx
// Lista: Skeleton placeholders (preferido em Padrão A)
{isLoading && (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-24 w-full rounded-xl" />
    ))}
  </div>
)}

// Spinner centralizado (preferido em Padrão B)
{isLoading && (
  <div className="flex justify-center py-8">
    <Loader2 className="animate-spin text-primary" size={32} />
  </div>
)}
```

**Empty state** — padrão único obrigatório:
```tsx
{!isLoading && lista.length === 0 && (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
      <IconeDoModulo className="text-black" size={28} />
    </div>
    <p className="text-foreground font-semibold mb-1">
      Nenhum [item] encontrado
    </p>
    <p className="text-muted-foreground text-sm">
      Toque no botão abaixo para adicionar.
    </p>
  </div>
)}
```
- O ícone centralizado usa sempre `bg-[#A7D3CB]` (Verde Menta claro)
- `py-20` no Padrão A; `py-16` no Padrão B

---

### 7.4.7 — Sort button + Export button

**Sort** — DropdownMenu com ícone ArrowUpDown:
```tsx
import { ArrowUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="shrink-0">
      <ArrowUpDown className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => setSortOrder('asc')}>
      Mais antigos primeiro
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setSortOrder('desc')}>
      Mais recentes primeiro
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
Posicionar ao lado das tabs, não dentro do header.

**Export PDF** — Share2 com DropdownMenu (quando há opções membro/família):
```tsx
import { Share2 } from "lucide-react";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="shrink-0 text-[#78C2AD]" disabled={generatingPdf}>
      <Share2 className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleExportPdf("member")}>
      Este membro
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleExportPdf("family")}>
      Toda a família
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
- Cor: `text-[#78C2AD]` (Verde Menta) — obrigatório
- Posicionar no header, à direita do título

---

### 7.4.8 — Cores e tokens do Design System

> Fonte canônica: `tokens/colors.css` do Design System oficial do Locus Vita.
> As cores têm nomes de marca — usar esses nomes ao especificar no SPEC.

#### Paleta de marca (Brand Palette)

| Nome oficial | Hex | Token CSS | Uso no app |
|-------------|-----|-----------|------------|
| **Brand BG** | `#f2f0eb` | `--brand-bg` | Fundo de página — `bg-[#f2f0eb]` |
| **Brand Dark** | `#1C3333` | `--brand-dark` | Home header, dark sections, prontuário card, splash |
| **Brand FG** | `#1a3a4d` | `--brand-fg` | Cor de texto primário (navy-teal) |
| **Mint** | `#A7D3CB` | `--brand-mint` | Container de ícone, CTAs, backgrounds accent |
| **Peach** | `#F2A97F` | `--brand-peach` | Badge "Realizada/Concluído", plano anual |
| **Cerulean** | `#A0C4D7` | `--brand-cerulean` | Badge retorno, timeline de consulta |
| **Lavender** | `#DCC5F1` | `--brand-lavender` | Badge consulta (tipo), timeline de exame |

#### Tokens semânticos (shadcn/ui)

| Token | Uso |
|-------|-----|
| `bg-background` | Cards, headers, drawers (branco / off-white) |
| `text-foreground` | Texto principal — nunca hardcode |
| `text-muted-foreground` | Subtítulos, labels secundários |
| `--primary` | Botões primários, tab ativa (underline) — Mint HSL |
| `--accent` | Peach HSL — CTA destaque |
| `--destructive` | Vermelho — erros, cancelamentos |
| `border-border/50` | Bordas de cards (50% opacidade) |

#### Status colors (Agenda — badges de tipo/estado)

| Nome | Hex | Token CSS | Uso |
|------|-----|-----------|-----|
| scheduled | `#AEE2D4` | `--status-scheduled` | Agendado, Ativo, Vacina confirmada |
| done | `#F2A97F` | `--status-done` | Realizado, Concluído |
| emergency | `#F87171` | `--status-emergency` | Cancelado, Atrasado, Emergência |
| return | `#A0C4D7` | `--status-return` | Retorno (tipo de consulta) |
| exam | `#FFF4A3` | `--status-exam` | Badge tipo "Exame" na Agenda |
| surgery | `oklch(0.88 0.06 250)` | `--status-surgery` | Badge tipo "Cirurgia" na Agenda |
| consultation | `#DCC5F1` | — | Badge tipo "Consulta" na Agenda |

#### Cores de uso específico

| Hex | Uso |
|-----|-----|
| `#FFB085` | FAB via `<FixedFAB>` (Padrão A) — laranja claro |
| `#E8916C` | FAB inline (Padrão B) — laranja escuro |
| `#78C2AD` | Ícones Share2/Export (`text-[#78C2AD]`) |
| `#AEE2D4` (30% opacity) | `bg-[#AEE2D4]30` — tint leve de ícone |

**Regras inegociáveis de cor:**
- ❌ `text-white`, `text-gray-900`, `bg-white` hardcoded → tokens semânticos
- ❌ Qualquer hex fora das tabelas acima → consultar antes de usar
- ✅ Container de ícone em card = sempre `bg-[#A7D3CB]` (Mint) com `text-black`
- ✅ Gradientes de subscription: `from-[#2A5C82] to-[#78C2AD]` ou `from-[#2A5C82] to-[#A0C4D7]` — apenas em cards de plano

---

### 7.4.9 — Regras de formulário e interação

```tsx
// ✅ Anti-zoom iOS — TODOS os inputs, selects e textareas
<Input className="text-base" />
<SelectTrigger className="text-base" />
<SelectContent className="text-base" />
<SelectItem className="text-base" />
<textarea className="text-base" />

// ✅ Botão de submit com loading
<Button disabled={mutation.isPending}>
  {mutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
  Salvar
</Button>

// ✅ Datas — único componente permitido
<CustomDateTimePicker /> // de @/components/ui/custom-date-time-picker

// ❌ Proibido
<input type="date" />

// ✅ Parse de datas do banco
import { parseISO, isValid } from 'date-fns';
import { format } from 'date-fns-tz';
const date = parseISO(rawValue);
if (!isValid(date)) return null; // nunca renderizar "Invalid Date"
const formatted = format(date, 'dd/MM/yyyy HH:mm', { timeZone: 'America/Sao_Paulo' });

// ✅ Formulários complexos — sempre Drawer, nunca page full-form
import { Drawer } from 'vaul'; // ou componente Drawer do shadcn/ui
// Estrutura interna do drawer:
// overflow-hidden flex flex-col (outer) + overflow-y-auto no-scrollbar (inner scroll)
```

---

### 7.4.10 — Semântica visual dos ícones

| Ação / Estado | Ícone | Cor |
|---------------|-------|-----|
| Sucesso / Confirmado | `<CheckCircle2>` | `text-green-500` |
| Cancelamento / Erro | `<XCircle>` | `text-red-500` |
| Pulado / Ignorado | `<SkipForward>` | `text-gray-500` |
| Export / Compartilhar | `<Share2>` | `text-[#78C2AD]` |
| Ordenar | `<ArrowUpDown>` | padrão |
| Voltar | `<ArrowLeft>` | `text-foreground` |
| Adicionar (FAB) | `<Plus>` | `text-white` ou `text-slate-900` |

---

### 7.4.11 — Animação de entrada obrigatória

Toda página nova que usa **Padrão A** deve ter `animate-fade-in` no wrapper principal:
```tsx
<div className="px-4 pt-6 pb-28 animate-fade-in">
```
No **Padrão B**, a animação não é necessária (o container é fixo).

---

### 7.4.12 — Checklist de layout para o SPEC (seção 7.4)

Ao especificar a UI de uma nova feature, confirmar:

```
LAYOUT
[ ] Padrão de layout escolhido: A (scroll simples) ou B (container fixo)?
[ ] Se tem tabs: pill (Padrão A) ou underline (Padrão B)?
[ ] Se tem lista com ações: usar SwipeableActionCard?
[ ] FAB: FixedFAB (Padrão A) ou inline bg-[#E8916C] (Padrão B)?
[ ] animate-fade-in no wrapper (Padrão A)?

DADOS E ESTADOS
[ ] Badges de status: variantes da tabela 7.4.5 (com fallback bg-muted)?
[ ] Loading: Skeleton (Padrão A) ou Loader2 (Padrão B)?
[ ] Empty state: ícone em bg-[#A7D3CB] rounded-full + título + subtítulo?

CORES E TOKENS
[ ] Cor de ícones de container: bg-[#A7D3CB] text-black?
[ ] Cor usada é da paleta oficial (7.4.8)? Nenhum hex inventado?
[ ] Gradiente? → apenas subscription cards (7.4.17)
[ ] Sort/Export: ArrowUpDown + Share2 text-[#78C2AD] no header?

FORMULÁRIOS
[ ] Todos inputs/selects/textareas: className="text-base"?
[ ] Datas: CustomDateTimePicker (nunca input type=date)?
[ ] Formulário tem campo de local? → label canônico 7.4.13

COPY E ÍCONES
[ ] Casing de títulos e botões correto (7.4.18)?
[ ] Empty state tem título + subtítulo (7.4.18 copy padrão)?
[ ] Ícone do domínio está na tabela 7.4.19?
[ ] Tamanho do ícone correto para o contexto?

SAÚDE E ARQUITETURA
[ ] Feature toca o Prontuário/Timeline? → filtros da tabela 7.4.14
```

---

### 7.4.13 — Campo de local em eventos clínicos (padrão canônico)

Qualquer formulário de evento clínico (consulta, exame, cirurgia, vacina) que exiba um campo de local **deve usar exatamente**:

```tsx
// ✅ Label e placeholder canônicos — padronizados em 2026-06-23
<FormField
  control={form.control}
  name="location"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Local (Hospital / Clínica / Laboratório)</FormLabel>
      <FormControl>
        <Input
          {...field}
          className="text-base"
          placeholder="Ex: Hospital das Clínicas"
        />
      </FormControl>
    </FormItem>
  )}
/>
```

**Histórico de padronização (2026-06-23):**

| Componente | Antes | Depois |
|------------|-------|--------|
| `AddConsultationDrawer` | *(campo inexistente — adicionado)* | "Local (Hospital / Clínica / Laboratório)" |
| `AddSurgeryDrawer` | "Local (Hospital / Clínica)" | "Local (Hospital / Clínica / Laboratório)" |
| `AddExamDrawer` | "Clínica / Laboratório" | "Local (Hospital / Clínica / Laboratório)" |

**Regra**: ao especificar qualquer nova tela com campo de local de evento clínico, usar sempre este label e placeholder. Não inventar variações.

**Banco de dados**: coluna `location TEXT` na tabela `consultations` (migration `20260623035806`). Outras entidades já tinham a coluna.

---

### 7.4.14 — ClinicalTimeline / Prontuário (5 tipos de evento)

O componente `ClinicalTimeline` (hook `useClinicalTimeline`) exibe o histórico clínico do membro familiar. Atualizado em 2026-06-23 para suportar 5 tipos, cada um com ícone, cor e filtro de inclusão específico.

**Tabela de tipos de evento:**

| Tipo | Ícone Lucide | Cor de fundo | Filtro de inclusão | Observação |
|------|-------------|--------------|-------------------|------------|
| `consulta` | `<Stethoscope>` | `bg-[#A0C4D7]` (Azul) | `.eq("status", "Realizada")` | Fonte de verdade: status, não data |
| `medicamento` | `<Pill>` | Esmeralda (token `--primary`) | todos (sem filtro de status) | Sempre incluído |
| `exame` | `<FileText>` | `bg-[#DCC5F1]` (Violeta) | `.neq("status", "Cancelado")` | Exclui apenas cancelados |
| `cirurgia` | `<Scissors>` | `bg-[#F2A97F]` (Laranja) | `.eq("status", "completed")` | Status em inglês no banco |
| `vacina` | `<Shield>` | `bg-[#AEE2D4]` (Teal) | `.not("applied_date", "is", null)` | Apenas vacinas aplicadas |

**Regra crítica — filtro de consultas:**
```typescript
// ✅ Correto — fonte de verdade é o status
.eq("status", "Realizada")

// ❌ Proibido — excluia consultas com data futura já marcadas como realizadas
.lte("consultation_date", now)
```

**Regra de soft-delete:** todos os 5 queries devem ter `.is("deleted_at", null)`.

**Para o SPEC**: ao especificar qualquer feature que adicione um novo tipo de evento clínico ou altere o Prontuário, documentar na seção 7 qual tipo de evento será adicionado à timeline, com ícone, cor e filtro de inclusão seguindo o padrão desta tabela.

---

### 7.4.16 — Tipografia (Design System oficial)

Fonte única: **Inter** (400, 500, 600, 700) — carregada via Google Fonts / fontsource.

| Tamanho | px | Token | Uso no app |
|---------|----|-------|-----------|
| `text-xs` | 11px | `--text-xs` | Micro labels, timestamps |
| `text-sm` | 14px | `--text-sm` | Captions, body small, subtítulos |
| `text-base` | 16px | `--text-base` | **Body padrão — mínimo obrigatório em inputs** |
| `text-lg` | 18px | `--text-lg` | Títulos de seção no app |
| `text-xl` | 20px | `--text-xl` | Títulos de página no app |
| `text-2xl` | 24px | `--text-2xl` | Headings |
| `text-3xl–5xl` | 30–48px | — | Landing page apenas |

**Pesos em uso:**
- `font-normal` (400) — corpo de texto
- `font-medium` (500) — labels, botões secundários
- `font-semibold` (600) — títulos de seção, itens de lista
- `font-bold` (700) — headings, preços, CTAs

**Regras:**
- ❌ Nunca `text-xs` ou `text-sm` em inputs, selects ou textareas — mínimo `text-base` (anti-zoom iOS)
- ✅ Títulos de página: `text-lg font-bold text-foreground` ou `text-xl font-semibold`
- ✅ Labels de formulário: `text-sm font-medium` (FormLabel do shadcn)
- ✅ Placeholders: `text-muted-foreground` (token semântico)

---

### 7.4.17 — Padrões especiais de layout

#### Dark Header (Home e seções escuras)
```tsx
// Header escuro com cards sobrepostos
<div className="bg-[#1C3333] rounded-b-[2.5rem] px-4 pt-6 pb-16">
  {/* conteúdo do header — texto branco */}
  <h1 className="text-white font-bold text-xl">Olá, {name}!</h1>
</div>
{/* Cards sobrepostos com margem negativa */}
<div className="-mt-[3.5rem] px-4 space-y-4">
  {/* cards brancos sobre fundo escuro */}
</div>
```
Usar apenas na **Home**. Outras páginas não usam este padrão.

#### Glassmorphism (sticky page headers)
```tsx
// Header "colado" que aparece ao rolar — efeito vidro fosco
<div className="sticky top-0 z-10 bg-[#F4F1EB]/80 backdrop-blur-md border-b border-border/30 px-4 py-3">
  <h1 className="text-lg font-semibold text-foreground">Título da Página</h1>
</div>
```
Usar quando a página tem conteúdo longo e o título precisa ficar visível ao rolar.

#### Gradientes (apenas cards de subscription)
```tsx
// Plano mensal
className="bg-gradient-to-br from-[#2A5C82] to-[#78C2AD]"
// Plano anual
className="bg-gradient-to-br from-[#2A5C82] to-[#A0C4D7]"
```
**Proibido** em qualquer outro contexto — gradientes aparecem apenas em cards de plano em `MeuPlano.tsx`.

---

### 7.4.18 — Tom, voz e copy (Design System oficial)

O Locus Vita fala com **warmth familiar** — como um assistente de confiança da família.

**Registro:**
- 2ª pessoa informal: "você", "seu", "sua" — nunca "Senhor/a" ou formal
- Frases curtas e diretas
- Ação-oriented: botões com verbos ("Salvar", "Adicionar", "Ver Tudo")

**Casing:**
- Títulos de página: Sentence case — "Minha Saúde", "Gerenciar Família"
- CTAs: Title case — "Começar Agora", "Assinar com Desconto"
- Ações secundárias: sentence case — "Voltar ao login", "Ver histórico"
- Badges/tags: Capitalizado — "Ativo", "Agendado", "Realizado"

**Copy padrão por contexto:**
```
Saudação: "Bom dia, {nome}!" / "Boa tarde" / "Boa noite"
Empty state título: "Nenhum(a) [item] encontrado(a)"
Empty state sub: "Toque no botão abaixo para adicionar."
Toast erro: "[Ação] falhou. Tente novamente." (curto, acionável)
Erro de recurso: "Este perfil pode ter sido removido ou você não tem acesso."
Tagline: "Saúde Familiar Simplificada"
```

**Emoji:** apenas `🐾` para membros pet. Nunca em botões, navigation, headings ou UI formal.

**Para o SPEC — ao especificar copy:**
- Incluir a string exata do texto visível ao usuário (não "título dinâmico")
- Especificar o empty state de cada lista (título + subtítulo)
- Especificar os toasts de sucesso e erro das principais ações

---

### 7.4.19 — Iconografia (Design System oficial)

**Biblioteca exclusiva**: Lucide React (`lucide-react@0.462.0`) — nenhuma outra.

**Tamanhos por contexto:**
- Navigation (bottom nav): `size={24}`, stroke 2.5 quando ativo
- Inline (header, cards): `size={20}` a `size={22}`
- Badges: `size={16}`
- FAB: `size={28}`
- Empty state / icon container: `size={28}`

**Ícones por domínio (referência para o SPEC):**

| Domínio | Ícone |
|---------|-------|
| Consultas | `<Stethoscope>` |
| Medicamentos | `<Pill>` |
| Exames | `<FileText>` |
| Vacinas | `<Syringe>` (lista) / `<Shield>` (timeline) |
| Cirurgias | `<Scissors>` |
| Pet | `<PawPrint>` |
| Notificações | `<Bell>` |
| Segurança/Privacidade | `<Shield>`, `<Lock>`, `<Eye>` |
| Health / Favoritos | `<Heart>`, `<HeartPulse>` |
| OCR / Foto | `<Camera>` |
| Navegação | `<ChevronRight>`, `<ArrowLeft>` |
| Premium | `<Crown>` |
| Atividade / Timeline | `<Activity>` |

**Container de ícone (padrão app):**
```tsx
// Ícone em container quadrado — padrão universal
<div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center">
  <Stethoscope className="text-black" size={20} />
</div>

// Ícone em container circular (empty states, splash)
<div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center">
  <Pill className="text-black" size={28} />
</div>
```

---

### 7.4.15 — Placeholder contextual (phase-aware)

Campos de texto com placeholder variável por fase ou estado devem usar o padrão `phase-aware`:

```tsx
// ✅ Exemplo: SurgeryInstructionImporter (fase pré/pós operatória)
<textarea
  className="text-base ..."
  placeholder={
    phase === 'pre'
      ? "Ex: Realizar jejum de 12 horas"
      : "Ex: Trocar curativo 2x ao dia"
  }
/>
```

**Quando usar**: qualquer campo de texto livre onde o conteúdo esperado muda dependendo de um estado/fase selecionado pelo usuário. Documentar no SPEC a tabela de placeholders por fase.

**Regra**: o placeholder `phase-aware` **não** substitui labels — é complementar. O label permanece fixo; só o placeholder varia.
