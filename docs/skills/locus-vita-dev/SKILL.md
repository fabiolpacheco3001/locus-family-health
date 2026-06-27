---
name: locus-vita-dev
description: Executa desenvolvimento fullstack de ponta a ponta no Locus Vita — implementa código, faz commit/push ou envia via MCP Lovable. Use SEMPRE que houver qualquer tarefa de desenvolvimento: implementar feature, corrigir bug, refatorar, criar hook/componente/edge function, aplicar migration, ou quando Fábio disser "implementa X", "cria Y", "corrige Z", "adiciona W". Esta skill age — não gera prompts para o usuário copiar.
---

# Locus Vita — Executor de Desenvolvimento Fullstack

## Princípio fundamental

Esta skill **executa**, não descreve. Para cada tarefa de desenvolvimento:

1. Lê as instruções do projeto → analisa o escopo → lê o SPEC → escolhe o canal
2. Lê o código existente antes de qualquer modificação
3. Implementa seguindo os padrões do projeto, do Design System e os princípios de saúde
4. Aplica os gates de qualidade
5. Entrega — via git push ou MCP Lovable
6. **Atualiza a documentação** — SPEC, BACKLOG, TECH_DEBT

**Nunca** produzir um bloco de texto para o usuário copiar e colar em lugar nenhum.

---

## Etapa 0 — Antes de qualquer coisa

### 0.1 Ler as instruções do projeto

**Obrigatório ao iniciar qualquer atividade de desenvolvimento.** Ler o arquivo de instruções para garantir que todas as regras, padrões e estrutura de salvamento estão em contexto:

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

A pasta `docs/` do repositório é a **memória escrita do projeto**. É tão parte do codebase quanto `src/`. **Todo arquivo gerado deve ser salvo aqui — nunca em pastas temporárias do Cowork.**

```
/Users/fabio/locus-family-health/docs/
├── LOCUS_VITA_PROJECT_INSTRUCTIONS_v*.md  ← instruções arquiteturais
├── BACKLOG.md            ← controle ativo (atualizado a cada sessão)
├── TECH_DEBT.md          ← controle ativo (atualizado a cada sessão)
├── INFRASTRUCTURE.md     ← referência técnica (atualizado quando infra muda)
├── compliance/
│   └── runbook-lgpd-art48.md
├── prds/
│   ├── PRD_*.docx              ← documentação de funcionalidades existentes
│   └── SPEC_*.docx             ← SPEC de próximas features (fonte de verdade)
└── skills/
    ├── locus-vita-dev.skill    ← este skill (pacote instalável)
    └── locus-vita-spec.skill   ← skill de especificação
```

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
| Misto (ex: novo hook + nova migration) | **Lovable MCP** para o backend; LOCAL para complemento frontend |

**Critério de desempate**: se Claude consegue implementar com precisão total lendo os arquivos existentes → LOCAL. Se o Lovable precisa entender o contexto do codebase → MCP.

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

### Formato de commit

```
tipo(escopo): descrição concisa em português

feat(cirurgias): adicionar módulo de gerenciamento de cirurgias
fix(medicamentos): corrigir cálculo de próxima dose para specific_days
fix(rls): corrigir política de acesso de dependente por admin de família
security(storage): restringir upload de arquivos ao path do próprio usuário
refactor(hooks): extrair lógica de signed URLs para useSignedUrl
chore(migrations): adicionar índices de performance em medication_doses
docs(prds): atualizar SPEC_Cirurgias para v2.2 pós-implementação
```

### Quando usar `plan_mode` local

Para tarefas locais complexas (> 3 arquivos): antes de implementar, apresentar a Fábio um resumo de "o que será criado/modificado e por quê" em no máximo 5 linhas. Aguardar confirmação antes de editar.

---

## Canal B — Lovable MCP (send_message)

Use quando a tarefa envolve `supabase/`, nova página, ou feature de alta complexidade.

### Encontrar o projeto Lovable

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

```
[Contexto]      O que existe hoje e o que precisa mudar
[Escopo]        Arquivos a criar | Arquivos a modificar | Arquivos a NÃO tocar
[Design System] Padrão de layout (A ou B) + tokens de cor + componentes exatos
[Princípios]    staleTime correto, Result<T> se operação crítica, Zod se PHI
[Regras]        inner join + deleted_at, text-base, sem SELECT * em subscriptions
[Entrega]       O critério de "pronto"
```

---

## Princípios de Código de Saúde

> O Locus Vita lida com PHI (Protected Health Information). Cada linha de código tem potencial de causar dano ou bem à saúde de alguém — ou expô-la ilegalmente. Estes princípios são inegociáveis.

### 1. TypeScript — nunca `any`, sempre `unknown` com narrowing

```typescript
// ❌ PROIBIDO
function processar(dado: any) { ... }

// ✅ CORRETO
function processar(dado: unknown) {
  if (typeof dado !== 'object' || dado === null) throw new Error('Dado inválido')
  const tipado = dado as MedicamentoInput  // narrowing explícito após validação
  ...
}
```

`noImplicitAny: true` já está em `tsconfig.json`. Nunca contornar com `as any`.

### 2. Result<T> para operações clínicas que podem falhar

```typescript
// Usar este padrão em operações sobre dados de saúde
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

async function registrarTomada(medicamentoId: string, previstoPara: Date): Promise<Result<void>> {
  try {
    const { error } = await supabase.from('medication_doses').insert({ ... })
    if (error) return { ok: false, error: 'Erro ao registrar tomada', code: error.code }
    return { ok: true, data: undefined }
  } catch (err) {
    captureException(err)  // lib/sentry.ts
    return { ok: false, error: 'Erro inesperado' }
  }
}

// No componente:
const result = await registrarTomada(id, data)
if (!result.ok) {
  toast.error(result.error)
  return
}
```

### 3. staleTime por tipo de dado

```typescript
// ✅ Dados clínicos (PHI) — SEMPRE frescos: staleTime: 0
// LGPD art. 11: dado de saúde é sensível — staleTime: 0 garante que nunca
// servimos dados em cache de uma sessão anterior.
useQuery({
  queryKey: ['medications', familyMemberId],
  queryFn: fetchMedications,
  staleTime: 0,
  gcTime: 5 * 60_000,  // 5 min máximo em memória
})

// ✅ Dados não-PHI (config, plano, grupo familiar) — 5 min
useQuery({
  queryKey: ['subscription', userId],
  queryFn: fetchSubscription,
  staleTime: 5 * 60 * 1000,
})
```

### 4. PHI nunca em localStorage/sessionStorage

```typescript
// ❌ PROIBIDO — PHI em armazenamento persistente do browser
localStorage.setItem('ultima_receita', JSON.stringify(receita))
sessionStorage.setItem('meds', JSON.stringify(meds))

// ✅ CORRETO — estado em memória via React Query (gcTime limitado)
const { data: receita } = useQuery({ queryKey: ['receita', id], staleTime: 0, gcTime: 300_000 })
```

### 5. Zod para validação de formulários com PHI

```typescript
// src/schemas/medication.ts
import { z } from 'zod'

export const medicationSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório').max(200),
  dosage: z.string().min(1, 'Dosagem obrigatória').max(50),
  frequency_type: z.enum(['fixed_interval', 'specific_times', 'specific_days']),
  start_date: z.string().refine(val => !isNaN(Date.parse(val)), 'Data inválida'),
  // ... demais campos
})

export type MedicationInput = z.infer<typeof medicationSchema>
```

### 6. console.log banido em produção

```typescript
// ❌ PROIBIDO
console.log('debug:', data)
console.log('payload recebido:', payload)  // pode vazar PHI nos logs de produção

// ✅ CORRETO — apenas Sentry para erros de runtime
import { captureException } from '@/lib/sentry'
captureException(err)  // invisível para o usuário, capturado no Sentry dashboard
```

### 7. ANVISA — O app faz REGISTRO, nunca DIAGNÓSTICO

```tsx
// ❌ PROIBIDO — linguagem diagnóstica (ANVISA SaMD alto risco)
<p>Seu nível de glicose sugere pré-diabetes.</p>
<p>Você pode estar com pressão alta.</p>
<p>Este medicamento pode estar causando interação.</p>

// ✅ CORRETO — registro neutro
<p>Glicose registrada: 115 mg/dL em {data}.</p>
<p>Pressão registrada: 140/90 mmHg.</p>
<Badge variant="outline">Verificar com médico</Badge>  // OCR/IA sempre com este aviso
```

Esta regra se aplica a: copy de UI, toast messages, push notifications, descrições de Badge, resumos de OCR. Em dúvida: "descrevo o fato registrado" → OK. "sugiro o que pode significar" → NÃO.

### 8. Comentários explicam o PORQUÊ, nunca o óbvio

```typescript
// ❌ INÚTIL
// Busca os medicamentos
const meds = await supabase.from('medications').select(...)

// ✅ VALIOSO — raciocínio regulatório ou de segurança
// LGPD art. 11: staleTime: 0 garante que não servimos dados clínicos
// de sessão anterior — cada render busca do banco.

// RLS garante isolamento no banco, mas verificamos family_member_id no hook
// também (defense in depth) — evita confusão de contexto em componentes reutilizados.

// UNIQUE(medication_id, scheduled_for) previne duplicatas de dose mesmo sob
// retry de rede — idempotência garantida no banco, não só no app.
```

---

## Design System — Referência para implementação

> Fonte canônica: `/Users/fabio/Downloads/Locus Vita Design System/`
> Para features novas ou mensagens Lovable, **ler `readme.md`** daquela pasta para detalhes completos.

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

**Padrão B — Container fixo com scroll interno** (FamiliarProfile)
```tsx
<div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
  <div className="flex-none bg-background border-b border-border px-4 py-3 flex items-center gap-3">
    <button onClick={goBack}><ArrowLeft size={22} className="text-foreground" /></button>
    <h1 className="text-lg font-semibold text-foreground">Título</h1>
  </div>
  <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
    {/* itens */}
    <div className="h-20" />
  </div>
  <button className="absolute bottom-6 right-4 w-14 h-14 bg-[#E8916C] hover:bg-[#d4805d] text-white rounded-full shadow-lg flex items-center justify-center z-10">
    <Plus size={28} />
  </button>
</div>
```

**Regra**: sem tabs fixas → Padrão A. Com tabs que fixam o layout → Padrão B.

### Componentes-chave

| Componente | Import | Quando usar |
|-----------|--------|-------------|
| `<FixedFAB>` | `@/components/ui/FixedFAB` | FAB em Padrão A — cor `#FFB085`, safe-area automática |
| `<SwipeableActionCard>` | `@/components/SwipeableActionCard` | Listas clínicas com delete/ação contextual |
| `<CustomDateTimePicker>` | `@/components/ui/custom-date-time-picker` | **Único** componente de data — nunca `<input type="date">` |

### Container de ícone (padrão universal)
```tsx
// Ícone quadrado (cards, listas)
<div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center"
     aria-label="Ícone de [domínio]">   {/* aria-label obrigatório em cards de saúde */}
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

### Patterns do SPEC de Cirurgias (referência de implementação)
```typescript
// Drawer com 3 abas pill: 'Agendamento' | 'Pré-Op' | 'Pós-Op'
// Placeholder phase-aware
placeholder={phase === 'pre' ? "Ex: Realizar jejum de 12 horas" : "Ex: Trocar curativo 2x ao dia"}
// UNIQUE(surgery_id, phase) — upsert idempotente
// Status 'completed' no DB = exibido como 'Realizada' na UI
// Campo de local: <FormLabel>Local (Hospital / Clínica / Laboratório)</FormLabel>
```

---

## Gates de qualidade — obrigatórios em ambos os canais

Aplicar antes do commit (LOCAL) ou sobre o diff (MCP). Em ordem de severidade:

```
🔴 CRÍTICO — bloquear entrega se encontrado

  [ ] SELECT * em subscriptions? → colunas explícitas (migration 20260619212318)
  [ ] Outer join com family_members? → !inner + .is('deleted_at', null)
  [ ] err.message exposto ao cliente em edge function? → mensagem genérica
  [ ] Secret com prefixo VITE_ em Lovable Secrets? → mover para .env
  [ ] group_id ausente em query de escopo familiar? → adicionar
  [ ] next_billing_date sendo nullado? → remover do update
  [ ] window.open() depois de await? → inverter a ordem
  [ ] `any` sem narrowing explícito de `unknown`? → tipar corretamente
  [ ] console.log em código de produção? → remover (usar captureException para erros)
  [ ] PHI em localStorage ou sessionStorage? → usar React Query em memória
  [ ] Linguagem diagnóstica na UI ("você pode ter...")? → registro neutro + "Verificar com médico"
  [ ] Secrets reais em comentários, JSDoc ou SQL? → usar apenas placeholders

🟠 IMPORTANTE — corrigir antes de entregar

  [ ] Dado clínico (PHI) com staleTime > 0? → ajustar para staleTime: 0
  [ ] Dado não-PHI sem staleTime? → adicionar (mín. 5 min)
  [ ] onSuccess invalida menos queryKeys do que deveria? → completar
  [ ] IDOR: recurso acessado sem verificar ownership? → adicionar check
  [ ] Hex de cor fora da paleta oficial do Design System? → corrigir
  [ ] aria-label ausente em card ou widget de saúde? → adicionar
  [ ] N+1 query em Edge Function de cron? → usar função SQL agregada (RPC)
  [ ] PHI em evento de analytics (PostHog, Sentry metadata)? → remover
  [ ] Formulário com PHI sem validação Zod? → adicionar schema

🟡 DETALHE — corrigir se tocar o arquivo

  [ ] Input/select/textarea sem text-base? → adicionar
  [ ] <input type="date">? → CustomDateTimePicker
  [ ] Button submit sem disabled={isPending} + Loader2? → adicionar
  [ ] Cor hardcoded fora da paleta (bg-white, text-gray-900)? → token semântico
  [ ] new Date() sem parseISO + isValid? → corrigir
  [ ] Empty state sem ícone em bg-[#A7D3CB] + dois textos? → corrigir
  [ ] Comentário óbvio ("// busca medicamentos")? → comentar o porquê, não o quê
```

---

## Checklist de code review — 17 pontos

Ao revisar qualquer diff antes de concluir a entrega:

**Segurança e LGPD:**
1. Nova tabela clínica: RLS habilitado? Política criada para SELECT/INSERT/UPDATE/DELETE?
2. `service_role` key aparece em algum arquivo frontend? → bloqueador imediato
3. PHI sendo salvo em localStorage/sessionStorage?
4. Resultado de OCR/IA apresentado sem badge "Verificar com médico"?
5. Dados de saúde em eventos de analytics (Sentry metadata, PostHog properties)?
6. Arquivo em bucket sem signed URL (acesso público indevido)?

**TypeScript e Qualidade:**
7. `any` sem narrowing? Tipos duplicados manualmente em vez de importar de `types.ts`?
8. Zod schema ausente em formulário com PHI?
9. `staleTime: 0` em queries de dados clínicos?
10. `console.log` presente em código que vai para produção?

**Domínio e Produto:**
11. Copy de UI contém linguagem diagnóstica? ("você pode ter...", "isso indica...")
12. Notificação/toast contém PHI literal? (deve ser genérico: "Hora do medicamento")
13. Signed URL com TTL adequado (máximo 15 min para documentos clínicos)?

**Performance:**
14. `SELECT *` em tabela com PHI — limitar colunas retornadas?
15. FK de alta frequência sem índice na nova migration?
16. Edge Function de cron faz N+1 queries? → usar `.rpc()` com função SQL agregada
17. Edge Function com timeout explícito configurado?

---

## Regras de execução

**Ler antes de escrever** — sempre. Nunca sobrescrever um arquivo sem ter lido o estado atual.

**Arquivos proibidos de editar** — nunca tocar:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`

**Após migrations via Lovable MCP** — sempre lembrar que `types.ts` precisa ser regenerado. Avisar Fábio:
```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

**Conflito LOCAL × MCP na mesma tarefa** — executar o MCP primeiro, esperar o diff, depois complementar local. Nunca bifurcar em paralelo.

**Escopo creep** — se identificado algo fora do escopo que precisa ser corrigido, apontar para Fábio e aguardar decisão. Não corrigir silenciosamente.

Para padrões de implementação (hook, edge function, motor financeiro, posologia, datas, Sentry), consultar `references/patterns.md`.

---

## Pós-entrega — atualização obrigatória de documentação

Ao concluir qualquer implementação, **atualizar a documentação via LOCAL git push**:

### 1. Atualizar o SPEC da feature (se existir)

Usar o script `generate_spec.py` da skill `locus-vita-spec` para regenerar o SPEC com:
- Versão incrementada (ex: v1.0 → v1.1)
- Status "Implementado ✅" nas User Stories entregues
- Seção Tech Debt atualizada com débitos identificados
- Seção Arquitetura refletindo o que foi realmente criado

Salvar em: `docs/prds/SPEC_[NomeFeature]_v[versao].docx`

### 2. Atualizar BACKLOG.md e TECH_DEBT.md

```bash
cat /Users/fabio/locus-family-health/docs/BACKLOG.md
cat /Users/fabio/locus-family-health/docs/TECH_DEBT.md
```
- Marcar itens entregues, adicionar novos descobertos
- Registrar débitos com ID, descrição e severidade

### 3. Atualizar INFRASTRUCTURE.md (apenas se mudou a infra)

Atualizar quando: nova tabela, novo bucket, nova edge function, nova migration, novo secret.

### Resumo de entrega

```
✅ Entregue: [lista de arquivos criados/modificados]
📄 Docs: SPEC v[x.x], BACKLOG.md, TECH_DEBT.md
⚠️  Débito técnico: [lista se houver]
🔄  Próximo passo: [ex: "regenerar types.ts"]
```
