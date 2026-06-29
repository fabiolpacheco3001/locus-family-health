  # LOCUS VITA — Instrução de Projeto para Cowork (Claude)

> **Versão:** 3.4 | **Atualizado em:** 2026-06-28
>
> Este documento é a **referência arquitetural do projeto** — padrões, regras, estrutura de dados e workflow.
> Ele **não** controla bugs, backlog ou débito técnico.
>
> Arquivos de controle separados (atualizados a cada sprint):
> - Débito técnico → `docs/TECH_DEBT.md`
> - Backlog de features → `docs/BACKLOG.md`
> - Infraestrutura → `docs/INFRASTRUCTURE.md`
> - SPECs de features → `docs/prds/SPEC_*.docx`

---

## 0. IDENTIDADE DO PROJETO

**Locus Vita** é um SaaS de saúde familiar (B2C) e Multi-Tenant Family Health Hub. Centraliza medicamentos, consultas, exames, vacinas, cirurgias e rotinas veterinárias de pets em um ambiente seguro e compartilhado entre cuidadores e familiares.

- **Titular:** Fábio (fabio@locustech.com.br)
- **Repositório:** https://github.com/fabiolpacheco3001/locus-family-health.git
- **Stack:** React 19 (Vite 6) + TypeScript (`noImplicitAny: true`) + TailwindCSS v4 + shadcn/ui + **Lovable Cloud** (backend)
- **Deploy:** PWA, mobile-first (iOS/Android), sem SSR (SPA puro)
- **Backend:** **Lovable Cloud** (plataforma que usa Supabase open-source por baixo) — DB + Auth + Storage + Edge Functions
- **Pagamento:** Asaas — modelo Cobrança Avulsa + tokenização de cartão para auto-renovação
- **IA:** Gemini (via Lovable AI Gateway) — OCR de receitas, laudos e instruções cirúrgicas
- **Sync:** GitHub ↔ Lovable bidirecional
- **Observabilidade:** Sentry (frontend: `VITE_SENTRY_DSN` em `.env`; Edge Functions: `SENTRY_DSN` em Lovable Cloud Secrets) + GitHub Actions CI (lint + typecheck + vitest)

---

## 1. MÓDULOS EXISTENTES

| Módulo | Arquivo principal | Observação |
|--------|------------------|------------|
| Dashboard (Home) | `pages/Home.tsx` (~138 LOC) + `components/home/` | `useHomeData.ts` agrega todos os dados |
| Posologia Avançada | `AddMedicationDrawer.tsx` | 3 frequency_types: fixed_interval, specific_times, specific_days |
| OCR de Receitas/Laudos | `supabase/functions/analyze-prescription/` | Gemini → JSON estruturado |
| Agenda Integrada | `pages/Agenda.tsx` | Consultas, Exames, Vacinas, Rotinas Pet |
| Cirurgias | `pages/Surgeries.tsx` + `components/AddSurgeryDrawer.tsx` | Padrão A; 3 abas pill (Agendamento/Pré-Op/Pós-Op); edge fn `analyze-surgery-instructions` |
| Perfil Familiar | `pages/FamiliarProfile.tsx` | Medicamentos, Prontuário, Saúde, Histórico |
| Motor Financeiro SaaS | `pages/MeuPlano.tsx` + `services/asaasService.ts` + edge functions | Cobrança Avulsa + Grace Period |
| RBAC Multi-Camada | `hooks/useFamilyGroup.tsx` + RLS | Admin/User + managed_profiles |
| Command Center | `pages/command-center/` | Dashboard admin, clientes, admins, changelog |
| Soft-Delete Cascata | Trigger Postgres `cascade_soft_delete_family_member()` | Cascata em todas as entidades clínicas |
| Export PDF | jsPDF + jspdf-autotable | Logo Locus Vita + paleta corporativa |
| WebAuthn / Passkeys | `supabase/functions/webauthn-{challenge,verify}/` | FIDO2 discoverable credentials (Face ID / Touch ID) |
| Adesão Medicamentosa | `AdherenceHistoryDrawer.tsx` + `useAdherenceDashboard` | Dashboard visual + export PDF |
| Signed URLs (arquivos clínicos) | `lib/storage.ts` + `hooks/useSignedUrl.ts` | TTL 15 min, auto-renova, LGPD compliant |
| Web Push Notifications | `src/hooks/usePushSubscription.ts` + `supabase/functions/send-push-notification/` | APNs (iOS PWA) + FCM; alarmes de dose (±3 min BRT) + consultas (D-0 e D-1, 8h BRT) |
| Segurança (trust page) | `pages/SegurancaInfo.tsx` | Rota pública `/seguranca` |
| WebAuthn settings | `pages/Seguranca.tsx` | Rota autenticada `/seguranca-conta` |

---

## 2. ARQUITETURA DO CÓDIGO

### 2.1 Estrutura de Pastas

```
src/
├── App.tsx                    # Roteamento + providers + lazy/prefetch + prefetchByRoute
├── components/
│   ├── ui/                    # ~50 primitives shadcn (NÃO editar estrutura)
│   ├── home/                  # Sub-componentes da Home (HomeHeader, OverviewCarousel, etc.)
│   ├── AddMedicationDrawer.tsx
│   ├── AddSurgeryDrawer.tsx   # Drawer de cirurgia (3 abas pill)
│   ├── SurgeryCard.tsx        # Card com SwipeableActionCard
│   ├── SurgeryInstructionImporter.tsx  # OCR cirúrgico com fase pré/pós
│   ├── agenda/MedicationDoseActions.tsx
│   └── [outros drawers e cards]
├── hooks/                     # 20+ hooks (regra: sempre retornar {data, mutation, isLoading})
│   ├── useAuth.tsx            # Context de sessão
│   ├── useFamilyGroup.tsx     # RBAC — fonte de verdade do grupo familiar
│   ├── useMedications.tsx     # Template de hook de dados
│   ├── useHomeData.ts         # Agrega todos os dados da Home
│   ├── useMedicationAlarms.ts # Motor de alarmes de doses
│   ├── useSurgeries.ts        # Hook de cirurgias
│   ├── usePushSubscription.ts # Web Push — subscribe + upsert
│   └── useSignedUrl.ts        # Signed URLs com auto-renovação React Query
├── lib/                       # Utilitários puros (sem side effects)
│   ├── calculateNextDose.ts   # Motor de próxima dose (3 frequency_types)
│   ├── advancePastTakenDoses.ts
│   ├── storage.ts             # getSignedUrl genérico + constantes de bucket
│   ├── tz.ts                  # Helper centralizado de timezone (TZ_SAO_PAULO, parseDateInSP, etc.)
│   ├── sentry.ts              # captureException wrapper
│   ├── planConfig.ts          # Constantes de preço (SSOT frontend)
│   ├── pushConfig.ts          # VAPID public key (build-time)
│   └── parseSusVaccinePdf.ts
├── pages/                     # 27+ páginas + command-center/
│   ├── Surgeries.tsx          # Módulo cirurgias — Padrão A
│   └── [demais páginas]
├── services/
│   └── asaasService.ts        # createSubscription() → invoca create-asaas-checkout
└── integrations/supabase/
    ├── client.ts              # ⚠️ AUTO-GERADO — NUNCA editar
    └── types.ts               # ⚠️ AUTO-GERADO — regenerar após migrations

supabase/
├── functions/                 # 14+ Edge Functions (Deno TypeScript)
│   ├── _shared/
│   │   ├── cors.ts            # SSOT de CORS (APP_ORIGIN env var)
│   │   ├── logger.ts          # log(level, event, data) → JSON estruturado
│   │   ├── rate-limit.ts      # checkAiRateLimit + logAiUsage
│   │   ├── sentry-edge.ts     # captureEdgeException via HTTP Store API
│   │   └── asaas-env.ts       # resolveAsaasEnv(testMode) → credenciais
│   ├── analyze-prescription/  # Template de referência para novas functions
│   ├── analyze-surgery-instructions/   # OCR instruções cirúrgicas (Gemini)
│   ├── send-push-notification/         # Web Push APNs/FCM (npm:web-push)
│   ├── send-medication-reminders/      # Cron push — doses ±3 min BRT
│   ├── send-appointment-reminders/     # Cron push — consultas D-0/D-1 8h BRT
│   ├── asaas-webhook/         # verify_jwt=false — valida ASAAS_WEBHOOK_TOKEN manualmente
│   ├── create-asaas-checkout/ # Gera invoiceUrl via POST /payments (Cobrança Avulsa)
│   ├── generate-renewal-charge/ # Cron diário — auto-renovação via creditCardToken
│   ├── cancel-asaas-subscription/
│   ├── webauthn-challenge/
│   ├── webauthn-verify/
│   └── [demais funções]
├── import_map.json            # Versões centralizadas de deps Deno
└── migrations/                # 40+ migrations — não alterar manualmente
```

### 2.2 Padrão Obrigatório de Hooks de Dados

```typescript
// Todo hook de dados DEVE seguir este molde (ver useMedications.tsx)
const useMedications = (familyMemberId: string) => {
  const queryClient = useQueryClient()

  // ⚠️ ATENÇÃO — staleTime depende do tipo de dado:
  // PHI (medicamentos, consultas, exames, cirurgias, vacinas, alergias,
  //      doenças, medições corporais, timeline clínica):
  //   staleTime: 0, gcTime: 5 * 60_000
  //   LGPD art. 11 — dado de saúde sensível nunca deve ser servido de cache
  //   de sessão anterior no mesmo dispositivo.
  // Não-PHI (subscription, group config, plano):
  //   staleTime: 5 * 60 * 1000
  const { data, isLoading } = useQuery({
    queryKey: ['medications', familyMemberId],
    queryFn: async () => { /* supabase query */ },
    // PHI — LGPD art. 11: medicamentos são dados de saúde sensíveis
    staleTime: 0,
    gcTime: 5 * 60_000,
  })

  const mutation = useMutation({
    mutationFn: async (payload) => { /* supabase mutation */ },
    onSuccess: () => {
      // Invalidar TODAS as chaves dependentes explicitamente
      queryClient.invalidateQueries({ queryKey: ['medications'] })
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    }
  })

  return { data, mutation, isLoading }
}
```

### 2.3 Padrão de Edge Functions (template: analyze-prescription)

1. CORS preflight com `corsHeaders` de `_shared/cors.ts`
2. Auth via header `Authorization` repassado ao supabase client
3. RBAC via `user_roles`
4. `try/catch` global → mensagem genérica ao cliente + `log("error", ...)` server-side
5. **NUNCA** expor `.message`, stack trace ou PostgrestError ao cliente

---

## 3. ARQUITETURA DE DADOS

### 3.1 Eixo Central: `family_members`

Toda entidade clínica carrega `user_id` (criador) + `group_id` (escopo familiar) + `family_member_id` (eixo do soft-delete).

```
auth.users ──* family_group_members *── family_groups
                                              │
                                         family_members ──┬── consultations
                                                          ├── exams
                                                          ├── medications ── medication_doses
                                                          ├── vaccines
                                                          ├── surgeries ── surgery_instructions
                                                          ├── allergies
                                                          ├── diseases
                                                          ├── blood_pressure_history
                                                          ├── health_measurements
                                                          ├── menstrual_cycles
                                                          └── pet_routines
auth.users ──1── subscriptions
auth.users ──1── user_roles
auth.users ──* passkeys
auth.users ──* consent_log
auth.users ──* push_subscriptions
```

### 3.2 Tabela `medications` — Posologia (3 modelos)

```sql
frequency_type  TEXT    -- 'fixed_interval' | 'specific_times' | 'specific_days'
                        -- ⚠️ legado: 'interval' no banco → normalizar para 'fixed_interval' no código
                        -- (rawType === 'interval' ? 'fixed_interval' : rawType) em calculateNextDose.ts
frequency_hours INT     -- usado quando frequency_type = 'fixed_interval'
specific_times  TEXT[]  -- ['12:00', '19:00'] (array)
specific_days   INT[]   -- [3, 6] = quarta e sábado (0=dom..6=sab)
```

Ao modificar posologia: sempre validar os 3 frequency_types e testar cenário nulo (array vazio, sem doses históricas). **Sempre normalizar** `'interval'` → `'fixed_interval'`.

### 3.3 Tabela `medication_doses` — Idempotência

```sql
CONSTRAINT UNIQUE(medication_id, scheduled_for)  -- previne duplicatas
status TEXT  -- 'taken' | 'skipped'
```

### 3.4 Tabela `subscriptions` — Motor SaaS

⚠️ **NUNCA usar `select("*")` nesta tabela** — migration `20260619212318` revogou SELECT table-level. Sempre listar colunas explicitamente.

```sql
user_id              UUID    -- FK auth.users (UNIQUE)
status               TEXT    -- 'active' | 'canceled' | 'suspended' | 'past_due' | 'trialing'
plan_type            TEXT    -- 'monthly' | 'annual' | 'free'
next_billing_date    DATE    -- NUNCA nullar (regra de imutabilidade)
test_mode            BOOL    -- true = sandbox Asaas; false = prod
asaas_customer_id    TEXT    -- ID do customer no Asaas (ambiente correto)
asaas_payment_id     TEXT    -- ID da última cobrança avulsa
credit_card_token    TEXT    -- Token do cartão para auto-renovação (vem via webhook)
asaas_subscription_id TEXT   -- Legado (modelo antigo de subscription Asaas)
```

⚠️ **Não existe coluna `current_period_end`** — usar apenas `next_billing_date`.

### 3.5 Tabela `surgeries` + `surgery_instructions`

```sql
-- surgeries
family_member_id  UUID    -- FK family_members
surgery_type      TEXT    -- tipo canônico (ex: 'Apendicectomia') ou 'other'
custom_type       TEXT    -- preenchido apenas quando surgery_type = 'other'
status            TEXT    -- 'scheduled' | 'completed' | 'canceled'
scheduled_date    TIMESTAMPTZ
local             TEXT    -- "Local (Hospital / Clínica / Laboratório)"
deleted_at        TIMESTAMPTZ  -- soft-delete

-- surgery_instructions
surgery_id  UUID
phase       TEXT    -- 'pre' | 'post'
items       JSONB   -- array de { text: string, checked: boolean }
CONSTRAINT UNIQUE(surgery_id, phase)  -- upsert idempotente
```

### 3.6 RBAC — Dois Níveis Independentes

| Nível | Tabela | Valores |
|-------|--------|---------|
| Plataforma | `user_roles.role` | `customer` / `admin` / `super_admin` |
| Grupo Familiar | `family_group_members.role` | `admin` / `user` |

`family_group_members.managed_profiles UUID[]` — lista de family_member_ids que um `user` pode gerenciar.

---

## 4. REGRAS DE DESIGN — INEGOCIÁVEIS

### 4.1 Anti Auto-Zoom iOS (CRÍTICO)

```typescript
// ✅ SEMPRE text-base (16px) em inputs e Radix portals
<Input className="text-base" />
<SelectTrigger className="text-base" />
<SelectContent className="text-base" />
<SelectItem className="text-base" />
// ❌ PROIBIDO — qualquer fonte < 16px em inputs/selects
```

### 4.2 UI Otimista e Feedback de Loading

```typescript
// ✅ Toda mutação tem estado de loading
<Button disabled={mutation.isPending}>
  {mutation.isPending ? <Loader2 className="animate-spin" /> : 'Salvar'}
</Button>
```

### 4.3 Abertura de URLs de Checkout (Asaas)

```typescript
// ✅ PADRÃO CORRETO — abre janela ANTES do await (evita popup blocker em mobile/PWA)
const checkoutWindow = window.open("about:blank", "_blank");
try {
  const url = await createSubscription(planType);
  if (checkoutWindow) checkoutWindow.location.href = url;
  else window.location.href = url;
} catch (err) {
  if (checkoutWindow) checkoutWindow.close();
  toast.error(err instanceof Error ? err.message : "Erro ao gerar link.");
}
// ❌ PROIBIDO — window.open(url, '_blank') depois de await é bloqueado como popup
```

### 4.4 Datas — Regras Absolutas

```typescript
// ✅ Único componente de data permitido
<CustomDateTimePicker />
// ❌ PROIBIDO
<input type="date" />

// ✅ Parse seguro de datas do banco
import { parseISO, isValid } from 'date-fns'
const date = parseISO(rawValue)
if (!isValid(date)) return null  // nunca renderizar "Invalid Date"

// ✅ Format com timezone correto — sempre usar lib/tz.ts
import { parseDateInSP, formatDate } from '@/lib/tz'
// TZ_SAO_PAULO = 'America/Sao_Paulo'
```

### 4.5 Queries — Proteção Contra Órfãos

```typescript
// ✅ SEMPRE inner join + filtro soft-delete em listagens
supabase
  .from('consultations')
  .select('*, family_members!inner(id, name)')
  .is('family_members.deleted_at', null)
// ❌ PROIBIDO — outer join deixa órfãos aparecerem
.select('*, family_members(id, name)')
```

### 4.6 Semântica Visual

```typescript
<CheckCircle2 className="text-green-500" />  // Sucesso / Confirmação
<XCircle className="text-red-500" />         // Cancelamento / Erro
<SkipForward className="text-gray-500" />    // Pulo
<Share2 className="text-[#78C2AD]" />        // Export / Compartilhar
```

### 4.7 Progressive Disclosure

- **PROIBIDO** formulários longos em página única ("Formzillas")
- Use `Drawer` (vaul) para bifurcações de fluxo e formulários complexos
- Máx 4 itens em widgets da Home com botão expansor

### 4.8 Export PDF

```typescript
// Sempre usar jsPDF + jspdf-autotable
// Cabeçalho: logo Locus Vita SVG estática
// Paleta: Azul Profundo + Verde Menta (#78C2AD)
// Botão de acesso: <Share2 className="text-[#78C2AD]" /> (IconButton ghost)
```

### 4.9 Padrões de Layout de Página — Dois Modelos

**Padrão A — Scroll simples** ← padrão preferencial para módulos de histórico clínico
(Consultas, Exames, Alergias, Cirurgias, Vacinas)
```tsx
<>
  <AddXDrawer ... />
  <div className="px-4 pt-6 pb-28 animate-fade-in">
    <div className="flex items-center gap-3 mb-6">
      <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft size={22} /></Button>
      <h1 className="text-lg font-bold text-foreground flex-1">Título</h1>
    </div>
    {/* Tabs pill se houver múltiplas visões */}
    {/* Lista de itens */}
  </div>
  {!drawerOpen && <FixedFAB onClick={handleAdd} />}
</>
```
- Tabs: `div.flex.p-1.bg-slate-100.rounded-xl` — botão ativo: `bg-white text-slate-900 shadow-xs`
- FAB: `<FixedFAB>` do `@/components/ui/FixedFAB` — cor `#FFB085`, safe-area automática
- `animate-fade-in` **obrigatório** em todas as páginas

**Padrão B — Container fixo com scroll interno**
(FamiliarProfile e páginas com navegação por tabs fixas)
```tsx
<div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
  <div className="flex-none bg-background border-b border-border px-4 py-3 flex items-center gap-3">
    <button onClick={goBack}><ArrowLeft size={22} className="text-foreground" /></button>
    <h1 className="text-lg font-semibold text-foreground">Título</h1>
  </div>
  {/* Tabs underline */}
  <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
    {/* itens */}
    <div className="h-20" />
  </div>
  {/* FAB inline — NÃO usar FixedFAB no Padrão B */}
  <button className="absolute bottom-6 right-4 w-14 h-14 bg-[#E8916C] hover:bg-[#d4805d] text-white rounded-full shadow-lg flex items-center justify-center z-10">
    <Plus size={28} />
  </button>
</div>
```
- Tabs underline: `border-b-2 border-primary text-primary` (ativa); `border-transparent text-muted-foreground` (inativa)

**Regra de escolha:** sem tabs fixas no topo → Padrão A. Com tabs fixas que fixam o layout → Padrão B.

### 4.10 Empty State (padrão obrigatório)

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

### 4.11 Campo de Local — Label Canônico

```tsx
<FormLabel>Local (Hospital / Clínica / Laboratório)</FormLabel>
<Input placeholder="Ex: Hospital das Clínicas" className="text-base" />
```
Usar **exatamente** este label em todos os módulos clínicos (consultas, exames, cirurgias).

---

## 5. MOTOR FINANCEIRO (Asaas — Modelo Cobrança Avulsa)

### 5.1 Arquitetura de Pagamento

Modelo **Spotify/Netflix**: uma cobrança avulsa por período, renovação automática via token de cartão.

```
Usuário clica "Assinar/Reativar"
  → asaasService.ts → create-asaas-checkout (Edge Function)
    → findOrCreateCustomer (GET by email no Asaas)
    → POST /payments { billingType: CREDIT_CARD, creditCardHolderInfo }
    → retorna invoiceUrl
  → checkoutWindow.location.href = invoiceUrl
  → Usuário paga na página Asaas

Asaas dispara PAYMENT_CONFIRMED
  → asaas-webhook (Edge Function)
    → status = 'active'
    → next_billing_date = hoje + 30 dias
    → credit_card_token = payment.creditCard.creditCardToken  ← campo correto

Cron diário (generate-renewal-charge)
  → busca subscriptions: status='active' AND credit_card_token IS NOT NULL AND next_billing_date <= hoje + 3 dias
  → POST /payments { creditCardToken }
  → Webhook PAYMENT_CONFIRMED repete o ciclo
```

### 5.2 Regra de Imutabilidade (CRÍTICA)

```typescript
// ✅ Ao cancelar: alterar APENAS o status
await supabase.from('subscriptions').update({ status: 'canceled' }).eq('user_id', userId)

// ❌ PROIBIDO — NUNCA nullar colunas de data
.update({ status: 'canceled', next_billing_date: null })  // quebra Grace Period
```

### 5.3 Grace Period

```typescript
// PaywallModal permite acesso se:
const hasAccess =
  subscription.status === 'active' ||
  (subscription.status === 'canceled' && isFuture(new Date(subscription.next_billing_date)))

// Durante Grace Period em Meu Plano:
// - Renderizar normalmente
// - Ocultar botão de cancelamento
// - Mostrar: "Acesso válido até [next_billing_date]"
```

### 5.4 Operações Destrutivas

- Cancelamento → Edge Function `cancel-asaas-subscription` (NUNCA frontend direto)
- `resolveAsaasEnv(testMode)` seleciona credenciais sandbox vs prod via `subscriptions.test_mode`
- Secrets: `ASAAS_API_KEY_SANDBOX`, `ASAAS_API_URL_SANDBOX`, `ASAAS_API_KEY_PROD`, `ASAAS_API_URL_PROD`

---

## 6. SEGURANÇA

### 6.1 Secrets — ONDE FICAM E COMO GERENCIAR

> ⚠️ O projeto usa **Lovable Cloud** (não Supabase standalone). Secrets de Edge Functions ficam
> no **Lovable editor → aba "More" → Cloud → Secrets**.
> **NÃO** use o Supabase Dashboard para gerenciar secrets deste projeto.

```
# Lovable Cloud Secrets (backend — acessados via Deno.env.get()):
SENTRY_DSN
ASAAS_API_KEY_SANDBOX / ASAAS_API_URL_SANDBOX
ASAAS_API_KEY_PROD / ASAAS_API_URL_PROD
ASAAS_WEBHOOK_TOKEN
APP_ORIGIN              # ex: https://vita.locustech.com.br (sem barra ou path)
AI_CALLS_PER_HOUR       # Rate limit IA (default: 10)
PLAN_MONTHLY_PRICE / PLAN_ANNUAL_PRICE / PLAN_ANNUAL_THRESHOLD
EMAIL_HASH_SALT
VAPID_PRIVATE_KEY       # Web Push — nunca expor; par com VITE_VAPID_PUBLIC_KEY

# Auto-gerenciados pelo Lovable (NÃO adicionar manualmente):
SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL
LOVABLE_API_KEY / GEMINI_API_KEY

# Frontend (.env — versionar normalmente):
VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PROJECT_ID
VITE_SENTRY_DSN
VITE_VAPID_PUBLIC_KEY   # Web Push public key (safe to expose — é pública por design)
```

**Regra de separação:**
- `VITE_*` → `.env` (build-time, exposto no bundle do browser)
- Todo o resto → Lovable Cloud Secrets (runtime backend, nunca no browser)
- Lovable **rejeita** tentar adicionar `VITE_*` em Secrets

**⚠️ PROIBIDO — Jamais commitar valores reais de secrets em código** — nem em comentários, JSDoc, SQL, migrações ou qualquer arquivo versionado. Usar apenas placeholders como `"YOUR_VAPID_PRIVATE_KEY"`. Incidente: `VAPID_PRIVATE_KEY` exposta em comentário JSDoc no GitHub (sessão 35) → chaves rotacionadas via force push.

**Para logs de Edge Functions:** Lovable editor → aba "More" → Cloud → Logs (NÃO Supabase Dashboard)

### 6.2 Storage

| Bucket | Acesso | Detalhe |
|--------|--------|---------|
| `exam-files` | Privado ✅ | Signed URLs 15 min via `lib/storage.ts` |
| `receitas` | Privado ✅ | Signed URLs 15 min via `lib/storage.ts` |
| `avatars` | Público | URL direta; listagem restrita por path filter |
| `vaccine_documents` | Privado ✅ | Signed URLs |

### 6.3 Helpers RLS SECURITY DEFINER

`is_super_admin`, `is_group_admin`, `is_group_member`, `check_group_access` — helpers booleanos puros. O WARN do linter é falso-positivo aceito (`@security-memory`). `anon` está revogado em todos.

### 6.4 Webhook Asaas

`verify_jwt = false` no `config.toml` — handler valida `ASAAS_WEBHOOK_TOKEN` manualmente no header `asaas-access-token`.

### 6.5 Error Handling em Edge Functions

```typescript
// ✅ Mensagem genérica ao cliente, detalhe apenas no log
} catch (err) {
  log("error", "operacao_falhou", { error: err instanceof Error ? err.message : String(err) });
  return new Response(
    JSON.stringify({ error: "Erro interno. Tente novamente." }),
    { status: 500, headers: jsonHeaders }
  );
}
// ❌ PROIBIDO
JSON.stringify({ error: `Falha: ${err.message}` })  // vaza info interna
```

---

## 7. WORKFLOW DE DESENVOLVIMENTO

### 7.1 Antes de Cada Sessão

1. Confirmar com Fábio o foco da sessão
2. Consultar `docs/BACKLOG.md` para itens priorizados
3. Ler o SPEC da feature em `docs/prds/SPEC_*.docx` se existir
4. `git pull` para garantir código local atualizado

### 7.2 Ao Criar Novo Componente de Formulário

- [ ] Todos os inputs/selects/textareas com `text-base` (16px mínimo)
- [ ] Botão de submit com `disabled={isPending}` + `<Loader2 className="animate-spin" />`
- [ ] Usar `CustomDateTimePicker` (nunca `<input type="date">`)
- [ ] Datas do banco: sempre `parseISO + isValid`
- [ ] Timezone: sempre `lib/tz.ts` com `America/Sao_Paulo`
- [ ] Campo de local: label canônico "Local (Hospital / Clínica / Laboratório)"

### 7.3 Ao Criar Nova Listagem

- [ ] Inner join: `family_members!inner(...)`
- [ ] Filtro soft-delete: `.is('family_members.deleted_at', null)`
- [ ] Empty state com ícone em `bg-[#A7D3CB]` arredondado + dois textos
- [ ] Testar com perfil deletado (caso "Bidu"/"Lívia fantasma")

### 7.4 Ao Criar Nova Edge Function

- Copiar template de `analyze-prescription/index.ts`
- Seguir: CORS → Auth → RBAC → try/catch → mensagem genérica
- Secrets no **Lovable Cloud** (aba "More" → Cloud → Secrets) — **nunca valores reais no código**
- `verify_jwt` definido explicitamente no `config.toml`

### 7.5 Ao Tocar no Motor Financeiro

- NUNCA nullar `next_billing_date`
- NUNCA usar `select("*")` em `subscriptions` — listar colunas explicitamente
- Testar Grace Period (status=canceled, data futura)
- Cancelamentos sempre via Edge Function `cancel-asaas-subscription`
- `creditCardToken` vem de `payment.creditCard.creditCardToken` no payload do webhook

### 7.6 Ao Modificar Posologia

- Validar os 3 `frequency_type`: `'fixed_interval'`, `'specific_times'`, `'specific_days'`
- Normalizar legado: `rawType === 'interval' ? 'fixed_interval' : rawType`
- Testar cenário nulo (array vazio, sem doses históricas)
- Idempotência via constraint `UNIQUE(medication_id, scheduled_for)`

### 7.7 Ao Criar Novo Módulo Clínico

- [ ] Escolher Padrão A (preferencial) ou B e seguir estrutura exata
- [ ] `animate-fade-in` no wrapper externo
- [ ] FixedFAB (Padrão A) ou FAB inline `bg-[#E8916C]` (Padrão B)
- [ ] Empty state com ícone em `bg-[#A7D3CB]` + dois textos
- [ ] Container de ícone: `w-10 h-10 rounded-xl bg-[#A7D3CB]` (card) ou `w-16 h-16 rounded-full bg-[#A7D3CB]` (empty)
- [ ] Ícone Lucide correto para o domínio (ver Seção 10)
- [ ] Badge de status usando paleta de cores do módulo
- [ ] Entrada na ClinicalTimeline (se aplicável — ver Seção 10)
- [ ] Consent AlertDialog antes de OCR/upload (LGPD — `consent_type` específico em `consent_log`)
- [ ] SPEC em `docs/prds/SPEC_[NomeFeature]_v1.0.docx` antes de implementar

### 7.8 Arquivos Auto-Gerados — NUNCA Editar

```
src/integrations/supabase/client.ts   ← regenerado pelo Lovable
src/integrations/supabase/types.ts    ← regenerar após migrations
supabase/config.toml                   ← gerenciado pelo Lovable
```

Após migrations: `supabase gen types typescript --local > src/integrations/supabase/types.ts`

### 7.9 Manutenção da Documentação (ao final de cada sessão)

Atualizar via LOCAL git push:
- `docs/BACKLOG.md` — marcar itens entregues, adicionar novos descobertos
- `docs/TECH_DEBT.md` — registrar débitos identificados, marcar resolvidos
- `docs/prds/SPEC_[Feature]_v*.docx` — bump de versão, marcar User Stories entregues
- `docs/INFRASTRUCTURE.md` — apenas quando há mudança de infra (nova tabela, bucket, edge function)

---

## 8. WORKFLOW DE CANAIS — GIT LOCAL vs MCP LOVABLE

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

**Regra de ouro:** qualquer coisa que toca `supabase/` vai **obrigatoriamente pelo Lovable MCP** — git push nessas pastas apenas sincroniza arquivos, não executa no cloud.

**Critério de desempate:** se Claude consegue implementar com precisão total lendo os arquivos existentes → LOCAL. Se o Lovable precisa entender o contexto do codebase para gerar código correto → MCP.

**Fluxo Lovable MCP:**
1. Claude analisa → envia via `send_message` (plan_mode=true para features complexas)
2. Fábio aprova no Lovable → Lovable commita no GitHub
3. Claude valida com `get_diff`
4. Fábio faz `git pull` no terminal
5. Claude atualiza `docs/` via LOCAL git push

---

## 9. INTEGRAÇÕES EXTERNAS

| Serviço | Propósito | Ponto de entrada |
|---------|-----------|-----------------|
| **Lovable Cloud** | Backend principal: DB + Auth + Storage + Edge Functions | `integrations/supabase/client.ts` (usa API Supabase) |
| Asaas | Cobrança avulsa + tokenização | `services/asaasService.ts` + edge functions |
| Gemini (via Lovable) | OCR receitas, laudos, instruções cirúrgicas | `functions/analyze-prescription/`, `functions/analyze-surgery-instructions/` |
| Web Push (APNs/FCM) | Notificações push iOS/Android | `functions/send-push-notification/` (npm:web-push) |
| IBGE API | Listas de estado/município | `hooks/useIbgeLocations.ts` |
| DataSUS PDF | Importação carteira de vacinas | `lib/parseSusVaccinePdf.ts` |
| PGMQ | Fila de e-mails transacionais | `functions/process-email-queue/` |
| Sentry | APM frontend + Edge Functions | `lib/sentry.ts` + `_shared/sentry-edge.ts` |
| GitHub Actions | CI: lint + typecheck + vitest | `.github/workflows/ci.yml` |

**Observabilidade Sentry — dois canais:**
- **Frontend:** `lib/sentry.ts` → `captureException()` via SDK (`VITE_SENTRY_DSN` no .env)
- **Edge Functions:** `_shared/sentry-edge.ts` → `captureEdgeException()` via HTTP Store API (`SENTRY_DSN` em Lovable Secrets). Fail-safe: se DSN ausente → no-op silencioso. Eventos aparecem com `server_name: "supabase-edge"`.

**Para checar logs de Edge Functions:** Lovable editor → aba "More" → Cloud → Logs

---

## 10. DESIGN SYSTEM

> Fonte canônica: `/Users/fabio/Downloads/Locus Vita Design System/`
> Skill dedicada: `locus-vita-design` (protótipos e mocks visuais)
> Esta seção cobre os padrões aplicáveis ao código de produção.

### 10.1 Paleta de Cores

| Token | Hex | Uso |
|-------|-----|-----|
| Brand BG | `#f2f0eb` | Fundo Padrão B (`bg-[#f2f0eb]`) |
| Brand Dark | `#1C3333` | Home header, dark sections (`bg-[#1C3333]`) |
| Brand FG | `#1a3a4d` | Texto primário em fundos escuros |
| Mint | `#A7D3CB` | Container de ícone, empty state (`bg-[#A7D3CB]`) |
| Peach | `#F2A97F` | Badge "Realizado/Concluído", ícone Cirurgias na timeline |
| Cerulean | `#A0C4D7` | Badge "Retorno", Consultas na timeline |
| Lavender | `#DCC5F1` | Badge "Consulta" (tipo), Exames na timeline |
| Accent Export | `#78C2AD` | `text-[#78C2AD]` — ícone Share2/Export exclusivamente |
| FAB Padrão A | `#FFB085` | `<FixedFAB>` cor padrão |
| FAB Padrão B | `#E8916C` | FAB inline (hover: `#d4805d`) |

**Status colors (Agenda/Timeline):**
```css
scheduled: #AEE2D4   done: #F2A97F   emergency: #F87171
return: #A0C4D7      exam: #FFF4A3   surgery: oklch(0.88 0.06 250)
consultation: #DCC5F1
```

**PROIBIDO:** `text-white`, `bg-white`, `text-gray-900` hardcoded — usar tokens semânticos (`text-foreground`, `bg-background`, `text-muted-foreground`). Gradientes apenas em cards de subscription (`from-[#2A5C82] to-[#78C2AD]`).

### 10.2 Tipografia

- **Fonte única:** Inter (400, 500, 600, 700)
- **Mínimo em inputs:** `text-base` (16px) — anti-zoom iOS
- Título de página: `text-lg font-bold text-foreground` (Padrão A) ou `text-lg font-semibold` (Padrão B)
- Sentence case em títulos de página: "Minhas Cirurgias", "Perfil Familiar"
- Title case em CTAs: "Adicionar Cirurgia", "Começar Agora"

### 10.3 Iconografia — Lucide React (exclusivo)

| Domínio | Ícone | Tamanho padrão | Cor na timeline |
|---------|-------|---------------|----------------|
| Consultas | `<Stethoscope>` | 20 (card) / 28 (empty) | `bg-[#A0C4D7]` |
| Medicamentos | `<Pill>` | 20 / 28 | `--primary` |
| Exames | `<FileText>` | 20 / 28 | `bg-[#DCC5F1]` |
| Cirurgias | `<Scissors>` | 20 / 28 | `bg-[#F2A97F]` |
| Vacinas | `<Syringe>` (lista) / `<Shield>` (timeline) | 20 / 28 | `bg-[#AEE2D4]` |
| Pet | `<PawPrint>` | 20 / 28 | — |
| Alarmes | `<Bell>` | 20 | — |
| Export | `<Share2>` | 18–20 | `text-[#78C2AD]` |
| Navigation | `<ArrowLeft>` | 22 | — |

**Container de ícone:**
```tsx
// Card: quadrado
<div className="w-10 h-10 rounded-xl bg-[#A7D3CB] flex items-center justify-center">
  <Scissors className="text-black" size={20} />
</div>
// Empty state: circular
<div className="w-16 h-16 rounded-full bg-[#A7D3CB] flex items-center justify-center">
  <Scissors className="text-black" size={28} />
</div>
```

### 10.4 ClinicalTimeline — 5 Tipos de Evento

| Tipo | Ícone | Cor de fundo | Filtro Supabase |
|------|-------|-------------|-----------------|
| consulta | `<Stethoscope>` | `bg-[#A0C4D7]` | `.eq('status', 'completed')` |
| medicamento | `<Pill>` | `bg-primary/20` | `.eq('status', 'taken')` |
| exame | `<FileText>` | `bg-[#DCC5F1]` | `.not('result_url', 'is', null)` |
| cirurgia | `<Scissors>` | `bg-[#F2A97F]` | `.eq('status', 'completed')` |
| vacina | `<Shield>` | `bg-[#AEE2D4]` | `.not('applied_date', 'is', null)` |

Todos os filtros da timeline incluem também `.is('deleted_at', null)`.

**Nota cirurgia:** `status = 'completed'` no banco → exibido como "Realizada" na UI.

### 10.5 Componentes-chave

| Componente | Import | Quando usar |
|-----------|--------|-------------|
| `<FixedFAB>` | `@/components/ui/FixedFAB` | FAB em Padrão A — não usar no Padrão B |
| `<SwipeableActionCard>` | `@/components/SwipeableActionCard` | Listas clínicas com delete/ação por swipe |
| `<CustomDateTimePicker>` | `@/components/ui/custom-date-time-picker` | Único componente de data — nunca `<input type="date">` |

---

## 11. ESTRUTURA DE DOCUMENTAÇÃO — REGRAS DE SALVAMENTO

> ⚠️ **REGRA ABSOLUTA:** Todo arquivo gerado neste projeto — SPECs, PRDs, skills, instruções, runbooks — é salvo **obrigatoriamente** dentro de `docs/` no repositório `/Users/fabio/locus-family-health/`.
>
> **NUNCA** salvar em pastas temporárias do Cowork/Claude (ex: `outputs/`, `/tmp/`, caminhos de sessão em `Library/Application Support/Claude/`). Essas pastas não persistem e não fazem parte do projeto.

### 11.1 Estrutura canônica

```
/Users/fabio/locus-family-health/docs/
├── LOCUS_VITA_PROJECT_INSTRUCTIONS_v*.md  ← este documento (instrução arquitetural)
├── BACKLOG.md              ← controle ativo — atualizar após cada sessão via LOCAL
├── TECH_DEBT.md            ← controle ativo — atualizar após cada sessão via LOCAL
├── INFRASTRUCTURE.md       ← referência técnica — atualizar quando infra muda
├── compliance/
│   └── runbook-lgpd-art48.md   ← procedimento ANPD (P0/P1/P2, prazo 3 dias úteis)
├── prds/
│   ├── Template_PRD_v2.docx    ← base para novos PRDs
│   ├── PRD_*.docx              ← documentação de funcionalidades existentes
│   └── SPEC_*.docx             ← SPECs de features (gerado por skill locus-vita-spec)
└── skills/
    ├── locus-vita-dev.skill    ← pacote instalável (skill de desenvolvimento)
    ├── locus-vita-dev/         ← fonte da skill (SKILL.md + references/)
    ├── locus-vita-spec.skill   ← pacote instalável (skill de especificação)
    └── locus-vita-spec/        ← fonte da skill (SKILL.md + assets/ + scripts/)
```

### 11.2 Mapeamento de destino por tipo de arquivo

| Tipo de arquivo | Destino em `docs/` |
|----------------|-------------------|
| Instruções de projeto (este doc) | `docs/LOCUS_VITA_PROJECT_INSTRUCTIONS_v*.md` |
| SPEC de nova feature | `docs/prds/SPEC_[NomeFeature]_v1.0.docx` |
| PRD de feature existente | `docs/prds/PRD_[NomeFeature]_v*.docx` |
| Pacote .skill instalável | `docs/skills/[nome-skill].skill` |
| Fonte de skill (SKILL.md, scripts) | `docs/skills/[nome-skill]/` |
| Runbook / procedimento | `docs/compliance/[nome].md` |
| Backlog e débito técnico | `docs/BACKLOG.md`, `docs/TECH_DEBT.md` |
| Referência de infra | `docs/INFRASTRUCTURE.md` |

### 11.3 Regras de manutenção

- `docs/` é sempre atualizado via **LOCAL git push** — nunca via Lovable MCP
- SPECs geradas pela skill `locus-vita-spec` → salvar em `docs/prds/SPEC_[NomeFeature]_v1.0.docx`
- Ao concluir implementação → bump de versão no SPEC + marcar User Stories entregues
- Skills atualizadas → reempacotar `.skill` e salvar o novo pacote em `docs/skills/`
- Após cada sessão → atualizar `BACKLOG.md` e `TECH_DEBT.md` com o que mudou

---

*Mantido pelo Claude (Cowork). Atualizar quando houver mudança arquitetural, novo módulo ou decisão de produto.*
*Bugs, backlog e débito técnico → ver `docs/TECH_DEBT.md` e `docs/BACKLOG.md`.*
