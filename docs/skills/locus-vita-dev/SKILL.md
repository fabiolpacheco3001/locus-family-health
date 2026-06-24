---
name: locus-vita-dev
description: Executa desenvolvimento fullstack de ponta a ponta no Locus Vita — implementa código, faz commit/push ou envia via MCP Lovable. Use SEMPRE que houver qualquer tarefa de desenvolvimento: implementar feature, corrigir bug, refatorar, criar hook/componente/edge function, aplicar migration, ou quando Fábio disser "implementa X", "cria Y", "corrige Z", "adiciona W". Esta skill age — não gera prompts para o usuário copiar.
---

# Locus Vita — Executor de Desenvolvimento Fullstack

## Princípio fundamental

Esta skill **executa**, não descreve. Para cada tarefa de desenvolvimento:

1. Analisa o escopo → lê o SPEC relevante em `docs/prds/` → escolhe o canal de execução
2. Lê o código existente antes de qualquer modificação
3. Implementa seguindo os padrões do projeto e do Design System
4. Aplica os gates de qualidade
5. Entrega — via git push ou MCP Lovable
6. **Atualiza a documentação** — SPEC, BACKLOG, TECH_DEBT

**Nunca** produzir um bloco de texto para o usuário copiar e colar em lugar nenhum.

---

## Etapa 0 — Antes de qualquer coisa

### 0.1 Ler as instruções do projeto

**Obrigatório ao iniciar qualquer atividade de desenvolvimento.** Ler o arquivo de instruções para garantir que todas as regras, padrões e estrutura de salvamento estão atualizados em contexto:

```
/Users/fabio/locus-family-health/docs/LOCUS_VITA_PROJECT_INSTRUCTIONS_v3.3.md
```

Prestar atenção especial a:
- Seção 3 — Arquitetura de Dados (tabelas, constraints, RLS)
- Seção 4 — Regras de Design (paleta, layout, componentes)
- Seção 6 — Segurança (secrets, storage, error handling)
- Seção 11 — Estrutura de Documentação (onde salvar cada tipo de arquivo)

### 0.2 Sincronizar o repositório

```bash
cd /Users/fabio/locus-family-health
git pull
git status
```

Se houver conflito ou divergência, resolver antes de prosseguir.

**Verificar se há SPEC para a tarefa:**
```bash
ls docs/prds/SPEC_*.docx
```
Se existir uma SPEC para a feature sendo implementada, **lê-la antes de começar** — ela é o contrato de entrega. Extrair: arquivos a criar/modificar, modelo de dados, padrão visual (seção 7.4) e critérios de aceite das User Stories.

---

## Estrutura de documentação do projeto

A pasta `docs/` do repositório é a **memória escrita do projeto**. É tão parte do codebase quanto `src/`.

```
/Users/fabio/locus-family-health/docs/
├── BACKLOG.md            ← controle ativo (atualizado a cada sessão)
├── TECH_DEBT.md          ← controle ativo (atualizado a cada sessão)
├── INFRASTRUCTURE.md     ← referência técnica (atualizado quando infra muda)
├── compliance/
│   └── runbook-lgpd-art48.md   ← orientação estática LGPD Art. 48
└── prds/
    ├── Template_PRD_v2.docx
    ├── PRD_*.docx              ← documentação de funcionalidades existentes
    └── SPEC_*.docx             ← SPEC de próximas features (fonte de verdade)
```

**Regras de manutenção:**
- `BACKLOG.md` e `TECH_DEBT.md` — **atualizar via LOCAL git push após cada implementação**
- `INFRASTRUCTURE.md` — atualizar apenas quando há mudança de infra (nova edge function, novo bucket, nova tabela principal)
- `docs/prds/SPEC_*.docx` — **atualizar via script generate_spec.py** após a implementação, incrementando a versão e marcando o que foi entregue

---

## Etapa 1 — Escolher o canal de execução

### Regra de ouro

> Qualquer coisa que toca `supabase/` **vai obrigatoriamente pelo Lovable MCP**,
> porque é o Lovable quem aplica migrations e faz deploy de Edge Functions no cloud.
> Git push nessas pastas só sincroniza arquivos — não executa nada no backend.

| O que a tarefa envolve | Canal |
|------------------------|-------|
| `supabase/migrations/` — nova migration ou alteração | **Lovable MCP** |
| `supabase/functions/` — nova edge function ou alteração | **Lovable MCP** |
| Nova página inteira (`src/pages/`) | **Lovable MCP** |
| Feature complexa que cruza frontend + backend | **Lovable MCP** |
| `src/lib/` — utilitário, helper, lógica pura | **LOCAL** |
| `src/hooks/` — novo hook ou modificação (sem nova tabela) | **LOCAL** |
| `src/components/` — modificação em componente existente | **LOCAL** |
| Bug fix cirúrgico (1–3 arquivos, sem mudança de banco) | **LOCAL** |
| Constantes, config, assets, tipos TypeScript | **LOCAL** |
| Documentação (`docs/`) | **LOCAL** |
| Misto (ex: novo hook + nova migration) | **Lovable MCP** para o backend; avaliar se o frontend vai junto ou separado |

**Critério de desempate**: se a tarefa exige que o Lovable entenda o contexto do codebase para gerar código correto, use MCP. Se Claude consegue implementar com precisão total lendo os arquivos existentes, use LOCAL.

---

## Canal A — LOCAL (Edit + git push)

Use quando o escopo é `src/` sem mudanças de banco ou edge functions.

### Workflow obrigatório

```
1. git pull          → garantir base atualizada
2. Ler SPEC          → docs/prds/SPEC_*.docx se existir para a feature
3. Read arquivos     → ler todos os arquivos que serão tocados ANTES de editar
4. Implementar       → usar Edit/Write com os padrões do projeto
5. Aplicar gates     → checar lista abaixo antes do commit
6. git add + commit  → mensagem de commit semântica
7. git push          → Lovable pega automaticamente do GitHub
8. Pós-entrega       → atualizar docs/ (ver seção Pós-entrega)
```

### Como ler os arquivos primeiro

Antes de modificar qualquer arquivo, lê o arquivo atual completo. Nunca implementar de memória — o codebase muda constantemente e o Lovable pode ter alterado arquivos desde a última sessão.

```bash
ls src/hooks/
ls src/components/
```

### Formato de commit

```
tipo(escopo): descrição concisa em português

Exemplos:
feat(cirurgias): adicionar módulo de gerenciamento de cirurgias
fix(medicamentos): corrigir cálculo de próxima dose para specific_days
refactor(hooks): extrair lógica de signed URLs para useSignedUrl
docs(prds): atualizar SPEC_Cirurgias para v2.2 pós-implementação
```

### Quando usar `plan_mode` local

Para tarefas locais complexas (> 3 arquivos): antes de implementar, apresentar a Fábio um resumo de "o que será criado/modificado e por quê" em no máximo 5 linhas. Aguardar confirmação antes de editar.

---

## Canal B — Lovable MCP (send_message)

Use quando a tarefa envolve `supabase/`, nova página, ou feature de alta complexidade.

### Encontrar o projeto Lovable

Se o project_id não estiver em memória, chamar:
```
mcp__a0660f40-9d2f-4d98-bc69-46078e07820b__list_projects
```
O projeto é **Locus Vita** / `locus-family-health`.

### Workflow obrigatório

```
1. git pull                      → base local atualizada
2. Ler SPEC                      → docs/prds/SPEC_*.docx se existir
3. Ler arquivos relevantes        → entender o estado atual do código
4. Avaliar complexidade           → usar plan_mode se > 2 subsistemas envolvidos
5. send_message (plan_mode=true)  → apenas para features complexas; aguardar Fábio aprovar
6. send_message (execução)        → enviar implementação completa e precisa
7. get_diff                       → validar o que o Lovable gerou
8. Checar gates de qualidade      → aplicar checklist no diff recebido
9. git pull                       → sincronizar base local com o que o Lovable commitou
10. Pós-entrega                   → atualizar docs/ (ver seção Pós-entrega)
```

### Como escrever o `send_message`

A mensagem para o Lovable deve ser **específica e completa** — o Lovable age sobre o que recebe, não sobre o que está implícito.

Estrutura eficaz:
```
[Contexto]      O que existe hoje e o que precisa mudar
[Escopo]        Arquivos a criar | Arquivos a modificar | Arquivos a NÃO tocar
[Design System] Padrão de layout (A ou B) + tokens de cor + componentes exatos
[Regras]        Padrões obrigatórios do projeto que se aplicam a esta tarefa
[Entrega]       O critério de "pronto" — o que a implementação deve fazer
```

Incluir sempre na mensagem:
- Nomes exatos de arquivos e funções existentes
- Padrão de layout (A ou B) e tokens corretos do Design System (ver referência abaixo)
- Padrões críticos: inner join + deleted_at, text-base em inputs, sem SELECT * em subscriptions
- O que está fora de escopo

### Leitura do diff pós-execução

Após o Lovable concluir, chamar `get_diff` e checar contra os gates abaixo. Se encontrar violação, enviar `send_message` de correção — não silenciar.

---

## Design System — Referência para implementação

> Fonte canônica: `/Users/fabio/Downloads/Locus Vita Design System/`
> Para features novas ou mensagens Lovable, **ler `readme.md`** daquela pasta para detalhes completos.
> Esta seção cobre os padrões de uso mais frequente.

### Paleta de cores (Brand Palette)

| Nome | Hex | Uso no código |
|------|-----|---------------|
| Brand BG | `#f2f0eb` | `bg-[#f2f0eb]` — fundo de página Padrão B |
| Brand Dark | `#1C3333` | Home header, dark sections, splash |
| Mint | `#A7D3CB` | `bg-[#A7D3CB]` — container de ícone, empty state |
| Peach | `#F2A97F` | Badge "Realizada/Concluído" |
| Cerulean | `#A0C4D7` | Badge "Retorno", consulta na timeline |
| Lavender | `#DCC5F1` | Badge "Consulta" (tipo), exame na timeline |
| FAB Padrão A | `#FFB085` | `<FixedFAB>` — componente existente |
| FAB Padrão B | `#E8916C` | FAB inline (hover: `#d4805d`) |
| Export icon | `#78C2AD` | `text-[#78C2AD]` — ícone Share2/Export |

**Status colors (Agenda):** scheduled=`#AEE2D4`, done=`#F2A97F`, emergency=`#F87171`, return=`#A0C4D7`, exam=`#FFF4A3`, surgery=`oklch(0.88 0.06 250)`, consultation=`#DCC5F1`

### Dois padrões de layout de página

**Padrão A — Scroll simples** (Consultas, Exames, Alergias, Cirurgias)
```tsx
<div className="px-4 pt-6 pb-28 animate-fade-in">
  <div className="flex items-center gap-3 mb-6">
    <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft size={22} /></Button>
    <h1 className="text-lg font-bold text-foreground flex-1">Título</h1>
  </div>
  {/* conteúdo */}
</div>
{!drawerOpen && <FixedFAB onClick={handleAdd} />}
```
- Tabs pill: `div.flex.p-1.bg-slate-100.rounded-xl` com botões `bg-white text-slate-900 shadow-xs` quando ativa
- FAB: `<FixedFAB>` (oculto quando drawer aberto: `!drawerOpen`)

**Padrão B — Container fixo com scroll interno** (FamiliarProfile, Surgeries v1)
```tsx
<div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
  <div className="flex-none bg-background border-b border-border px-4 py-3 flex items-center gap-3">
    <button onClick={goBack}><ArrowLeft size={22} className="text-foreground" /></button>
    <h1 className="text-lg font-semibold text-foreground">Título</h1>
  </div>
  {/* tabs underline aqui se houver */}
  <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
    {/* itens */}
    <div className="h-20" />
  </div>
  <button className="absolute bottom-6 right-4 w-14 h-14 bg-[#E8916C] hover:bg-[#d4805d] text-white rounded-full shadow-lg flex items-center justify-center z-10">
    <Plus size={28} />
  </button>
</div>
```
- Tabs underline: `border-b-2 border-primary text-primary` quando ativa; `border-transparent text-muted-foreground` quando inativa
- Sempre `text-base` nos botões de tab

**Regra**: sem tabs → Padrão A. Com tabs fixas → Padrão B.

### Componentes-chave

| Componente | Import | Quando usar |
|-----------|--------|-------------|
| `<FixedFAB>` | `@/components/ui/FixedFAB` | FAB em Padrão A — cor `#FFB085`, safe-area automática |
| `<SwipeableActionCard>` | `@/components/SwipeableActionCard` | Listas clínicas com delete/ação contextual |
| `<CustomDateTimePicker>` | `@/components/ui/custom-date-time-picker` | **Único** componente de data — nunca `<input type="date">` |
| `<Badge>` | shadcn | Status — usar variantes ou classes da paleta |

### Container de ícone (padrão universal)
```tsx
// Ícone quadrado (cards, listas)
<div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center">
  <Scissors className="text-black" size={20} />
</div>

// Ícone circular (empty states)
<div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
  <Scissors className="text-black" size={28} />
</div>
```

### Empty state (padrão obrigatório)
```tsx
{!isLoading && lista.length === 0 && (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center mb-4">
      <IconeDoModulo className="text-black" size={28} />
    </div>
    <p className="text-foreground font-semibold mb-1">Nenhum(a) [item] encontrado(a)</p>
    <p className="text-muted-foreground text-sm">Toque no botão abaixo para adicionar.</p>
  </div>
)}
```

### Ícones por domínio (Lucide React exclusivo)

| Domínio | Ícone | Cor na timeline |
|---------|-------|----------------|
| Consultas | `<Stethoscope>` | `bg-[#A0C4D7]` |
| Medicamentos | `<Pill>` | Mint / `--primary` |
| Exames | `<FileText>` | `bg-[#DCC5F1]` |
| Cirurgias | `<Scissors>` | `bg-[#F2A97F]` |
| Vacinas | `<Syringe>` (lista) / `<Shield>` (timeline) | `bg-[#AEE2D4]` |
| Pet | `<PawPrint>` | — |
| Alarmes | `<Bell>` | — |
| Export | `<Share2>` | `text-[#78C2AD]` |
| Sort | `<ArrowUpDown>` | padrão |

### Tipografia

- **Fonte única**: Inter (400, 500, 600, 700)
- **Mínimo em inputs**: `text-base` (16px) — anti-zoom iOS. **Nunca `text-xs` ou `text-sm` em inputs/selects/textareas**
- Título de página: `text-lg font-bold text-foreground` ou `text-xl font-semibold`
- Rótulos de formulário: `text-sm font-medium` (shadcn FormLabel)

### Patterns do SPEC de Cirurgias (referência de implementação)

Extraídos do `SPEC_Cirurgias_v2.2.docx` — implementação completa em produção:

```typescript
// Drawer com 3 abas pill (AddSurgeryDrawer pattern)
// Aba 'Agendamento' | 'Pré-Op' | 'Pós-Op'

// Busca de tipo com Command search + drawer aninhado
// surgeryTypes de lib/surgeryTypes.ts (60+ tipos, 14 categorias)
// Tipo 'outro' → exibe campo customType (mín. 3 chars)

// Placeholder phase-aware
placeholder={phase === 'pre' ? "Ex: Realizar jejum de 12 horas" : "Ex: Trocar curativo 2x ao dia"}

// UNIQUE constraint para upsert idempotente de instruções
UNIQUE(surgery_id, phase) em surgery_instructions

// ClinicalTimeline — filtro de cirurgias
.eq('status', 'completed').is('deleted_at', null)
// Status 'completed' no DB = exibido como 'Realizada' na UI

// Badge de aviso IA
<Badge variant="outline">Verificar com médico</Badge>

// Campo de local — label canônico
<FormLabel>Local (Hospital / Clínica / Laboratório)</FormLabel>
<Input placeholder="Ex: Hospital das Clínicas" className="text-base" />
```

---

## Gates de qualidade — obrigatórios em ambos os canais

Aplicar antes do commit (LOCAL) ou sobre o diff (MCP). Em ordem de severidade:

```
🔴 CRÍTICO — bloquear entrega se encontrado
[ ] SELECT * em subscriptions? → trocar por colunas explícitas
[ ] Outer join com family_members? → !inner + .is('deleted_at', null)
[ ] err.message exposto ao cliente em edge function? → mensagem genérica
[ ] Secret com prefixo VITE_? → mover para Lovable Cloud Secrets
[ ] group_id ausente em query de escopo familiar? → adicionar
[ ] next_billing_date sendo nullado? → remover do update
[ ] window.open() depois de await? → inverter a ordem

🟠 IMPORTANTE — corrigir antes de entregar
[ ] staleTime ausente no useQuery? → adicionar (mín. 5 min)
[ ] onSuccess invalida menos queryKeys do que deveria? → completar
[ ] IDOR: recurso acessado sem verificar ownership? → adicionar check
[ ] Hex de cor fora da paleta oficial do Design System? → corrigir

🟡 DETALHE — corrigir se tocar o arquivo
[ ] Input/select/textarea sem text-base? → adicionar
[ ] <input type="date">? → CustomDateTimePicker
[ ] Button submit sem disabled={isPending} + Loader2? → adicionar
[ ] Cor hardcoded fora da paleta (bg-white, text-gray-900)? → token semântico
[ ] new Date() sem parseISO + isValid? → corrigir
[ ] payload: any? → tipar explicitamente (noImplicitAny)
[ ] Empty state sem ícone em bg-[#A7D3CB] + dois textos? → corrigir
```

Para padrões de implementação corretos (hook, edge function, motor financeiro, posologia, datas), consultar `references/patterns.md`.

---

## Regras de execução

**Ler antes de escrever** — sempre. Nunca sobrescrever um arquivo sem ter lido o estado atual.

**Arquivos proibidos de editar** — nunca tocar:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`

**Após migrations via Lovable MCP** — sempre lembrar que `types.ts` precisa ser regenerado. Avisar Fábio:
```bash
# Fábio executa no terminal:
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

**Conflito LOCAL × MCP na mesma tarefa** — executar o MCP primeiro, esperar o diff, depois complementar local. Nunca bifurcar em paralelo.

**Escopo creep** — se identificado algo fora do escopo que precisa ser corrigido, apontar para Fábio e aguardar decisão. Não corrigir silenciosamente.

---

## Pós-entrega — atualização obrigatória de documentação

Ao concluir qualquer implementação, **atualizar a documentação via LOCAL git push**:

### 1. Atualizar o SPEC da feature (se existir)

```bash
# O SPEC fica em:
ls /Users/fabio/locus-family-health/docs/prds/SPEC_*.docx
```

Usar o script `generate_spec.py` da skill `locus-vita-spec` para regenerar o SPEC com:
- Versão incrementada (ex: v1.0 → v1.1 ou v2.2 → v2.3)
- Status "Implementado ✅" nas User Stories e itens de escopo entregues
- Seção 8.2 Tech Debt atualizada com débitos identificados na implementação
- Seção 7 Arquitetura refletindo o que foi realmente criado (pode divergir da spec original)

Salvar na mesma pasta: `docs/prds/SPEC_[NomeFeature]_v[versao].docx`

### 2. Atualizar BACKLOG.md

```bash
# Ler estado atual
cat /Users/fabio/locus-family-health/docs/BACKLOG.md
```
- Marcar como `[x]` os itens entregues
- Adicionar novos itens descobertos durante a implementação
- Commit: `docs(backlog): marcar [feature] como entregue`

### 3. Atualizar TECH_DEBT.md

```bash
cat /Users/fabio/locus-family-health/docs/TECH_DEBT.md
```
- Adicionar novos débitos identificados durante a implementação (com ID, descrição, severidade)
- Marcar como resolvidos os débitos que foram cobertos
- Commit: `docs(tech-debt): registrar débitos de [feature]`

### 4. Atualizar INFRASTRUCTURE.md (apenas se mudou a infra)

Atualizar quando: nova tabela, novo bucket, nova edge function, nova migration, novo secret.

### Resumo de entrega (uma linha por arquivo alterado)

Após tudo, reportar a Fábio:
```
✅ Entregue: [lista de arquivos criados/modificados]
📄 Docs atualizados: SPEC v[x.x], BACKLOG.md, TECH_DEBT.md
⚠️  Débito técnico: [lista se houver]
🔄  Próximo passo: [se relevante, ex: "regenerar types.ts"]
```
