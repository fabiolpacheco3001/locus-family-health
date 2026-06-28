# Diagnóstico de Codebase — Locus Vita
**Data:** 27/06/2026  
**Auditor:** Claude (Cowork)  
**Scope:** src/hooks, src/components, src/pages, src/lib, supabase/functions, supabase/migrations (10 últimas)

---

## Resumo Executivo

| Categoria | Ocorrências |
|-----------|------------|
| 🔴 Crítico | 5 |
| 🟠 Importante | 9 |
| 🟡 Melhoria | 6 |
| **Total** | **20** |

**Estimativa de saúde do código:** 7/10

O codebase demonstra maturidade acima da média para um produto no estágio atual: RLS bem estruturado, gates de auth consistentes em edge functions, padrão `!inner` correto na maioria dos joins, e ausência de PHI real em comentários ou secrets. Os achados concentram-se em três vetores: (1) exposição de mensagem de erro interno ao cliente em uma edge function de cron, (2) N+1 query em cron de lembretes de medicamento, e (3) uso generalizado de `staleTime: 5min` em dados clínicos PHI que deveriam ter `staleTime: 0`.

**Top 3 riscos mais urgentes:**
1. **[ID-001]** `error.message` do Supabase exposto ao cliente na edge function `send-medication-reminders` — vaza schema interno.
2. **[ID-002]** N+1 query em `send-medication-reminders` — `getNotificationTargets` é chamado dentro do loop `for (const med of medications)`, podendo disparar dezenas de queries por execução do cron.
3. **[ID-003]** `staleTime: 5 * 60 * 1000` em dados clínicos PHI (`useHealthMeasurements`, `useClinicalTimeline`, `useProntuarioData`, `useConsultations`, `useExams`) — dados de saúde podem ficar 5 minutos desatualizados após edição por outro membro do grupo.

---

## Matriz Severidade × Esforço

|                    | Esforço Baixo (< 2h) | Esforço Médio (2–8h) | Esforço Alto (> 8h) |
|--------------------|----------------------|----------------------|----------------------|
| 🔴 Crítico         | ID-001, ID-004, ID-005 | ID-002, ID-003    | —                   |
| 🟠 Importante      | ID-006, ID-010, ID-012, ID-013, ID-014 | ID-007, ID-008, ID-009, ID-011 | ID-016 |
| 🟡 Melhoria        | ID-015, ID-017, ID-019 | ID-018            | ID-020              |

---

## Detalhamento por Achado

---

### [ID-001] `error.message` exposto ao cliente em send-medication-reminders

- **Arquivo:** `supabase/functions/send-medication-reminders/index.ts:98-99`
- **Violação:** `err.message` exposto ao cliente em edge function
- **Impacto:** Mensagens de erro do Supabase/Postgres podem vazar nomes de tabelas, colunas, constraints e detalhes do schema interno. Embora esta função seja chamada por `pg_cron` (não diretamente pelo browser), o endpoint é HTTP-acessível e qualquer resposta 500 com `error.message` é um vetor de information disclosure.
- **Severidade × Esforço:** 🔴 Crítico × Baixo

```
ANTES:
return new Response(JSON.stringify({ error: error.message }), { status: 500 });

DEPOIS:
log("error", "med_reminders_fetch_failed", { error: error.message });
return new Response(JSON.stringify({ error: "Erro interno ao buscar medicamentos" }), { status: 500 });
```

---

### [ID-002] N+1 query em cron de lembretes de medicamento

- **Arquivo:** `supabase/functions/send-medication-reminders/index.ts:114,191`
- **Violação:** N+1 query em Edge Function de cron
- **Impacto:** Para cada medicamento com `shouldNotify = true`, `getNotificationTargets` executa um SELECT em `family_group_members`. Em um cenário com 50 medicamentos ativos cujo horário coincide com a janela de 3 minutos, são disparadas 50 queries adicionais por execução do cron (a cada 5 minutos). Sob carga, isso pode causar timeouts e esgotar connection pooling.
- **Severidade × Esforço:** 🔴 Crítico × Médio

```
ANTES (linha 191, dentro do loop for (const med of medications)):
const targetUserIds = await getNotificationTargets(adminClient, member.id, member.group_id);

DEPOIS:
// 1. Coletar todos os group_ids únicos dos medicamentos
const groupIds = [...new Set(medications.map(m => {
  const mb = Array.isArray(m.family_members) ? m.family_members[0] : m.family_members;
  return mb?.group_id;
}).filter(Boolean))];

// 2. Uma única query para todos os grupos
const { data: allGroupMembers } = await adminClient
  .from("family_group_members")
  .select("auth_user_id, role, managed_profiles, group_id")
  .in("group_id", groupIds);

// 3. Construir mapa group_id → members (O(1) no loop)
const groupMembersMap = buildGroupMembersMap(allGroupMembers ?? []);

// 4. No loop, usar o mapa local em vez de query
const targets = resolveTargetsFromMap(groupMembersMap, member.id, member.group_id);
```

---

### [ID-003] staleTime de 5 minutos em dados clínicos PHI

- **Arquivos:**
  - `src/hooks/useHealthMeasurements.ts:34`
  - `src/hooks/useClinicalTimeline.ts:152`
  - `src/hooks/useProntuarioData.ts:23,37`
  - `src/hooks/useConsultations.tsx:66`
  - `src/hooks/useExams.tsx:64`
  - `src/hooks/useMedications.tsx:114`
  - `src/hooks/useSurgeries.tsx:103`
- **Violação:** Dado clínico (PHI) com `staleTime > 0`
- **Impacto:** Em contexto de família compartilhada, se o admin editar o prontuário de um dependente, o usuário logado verá dados desatualizados por até 5 minutos. Para dados médicos (doses tomadas, peso registrado, consultas, cirurgias), isso pode induzir erros clínicos. O padrão correto para PHI é `staleTime: 0`.
- **Severidade × Esforço:** 🔴 Crítico × Médio

```
ANTES (em todos os hooks de dados clínicos acima):
staleTime: 5 * 60 * 1000,

DEPOIS:
staleTime: 0,
// Comentário obrigatório:
// PHI — dados clínicos devem sempre refletir o estado do servidor.
// staleTime: 0 garante refetch ao montar o componente.
// Manter staleTime: 5min APENAS em dados não-PHI:
// useNotifications, useFamilyGroup, usePasskeys, useAiStatus
```

---

### [ID-004] `console.log` com PHI (texto completo do PDF SUS) em produção

- **Arquivo:** `src/lib/parseSusVaccinePdf.ts:325,480,492,496`
- **Violação:** `console.log` em código de produção com PHI (CPF, histórico vacinal, texto completo do PDF)
- **Impacto:** Linha 480 loga `FULL PDF TEXT` — o PDF da carteira SUS contém CPF, nome do paciente e histórico vacinal completo. Em produção, isso aparece nos logs do browser e é visível em DevTools de qualquer pessoa com acesso físico ao dispositivo.
- **Severidade × Esforço:** 🔴 Crítico × Baixo

```
ANTES:
console.log("FULL PDF TEXT:", flatText);        // linha 480 — PHI crítico
console.log("MERGED ROWS COUNT:", ...);          // linha 325
console.log("DETECTED COLUMNS:", ...);           // linha 492
console.log("EXTRACTED VACCINES:", ...);         // linha 496

DEPOIS:
// Remover TODOS os console.log de parseSusVaccinePdf.ts.
// Se necessário para debug local, guard com:
if (import.meta.env.DEV) {
  console.log("FULL PDF TEXT:", flatText);
}
```

---

### [ID-005] `console.log` com CPF em useVaccineImport.ts (sem guard)

- **Arquivo:** `src/hooks/useVaccineImport.ts:99`
- **Violação:** `console.log` em código de produção expondo CPF (PHI — LGPD Art. 11)
- **Impacto:** Loga `DEBUG CPF -> Candidatos no PDF` com candidatos de CPF extraídos do PDF de vacinas — dado pessoal sensível. Visível em qualquer DevTools sem autenticação adicional.
- **Severidade × Esforço:** 🔴 Crítico × Baixo

```
ANTES:
console.log("DEBUG CPF -> Candidatos no PDF:", cleanCandidates, "| Banco:", memberCpf);

DEPOIS:
// Remover completamente — CPF é dado PHI sensível (LGPD Art. 11)
// Manter apenas: if (import.meta.env.DEV) { ... } se necessário
```

---

### [ID-006] Políticas RLS sem `TO authenticated` em migrations antigas

- **Arquivos:**
  - `supabase/migrations/20260326172842_0ea886ad.sql:4,13,24,33`
  - `supabase/migrations/20260321145854_2e5d89ab.sql:16,20,24,28`
  - `supabase/migrations/20260402155636_8aea726c.sql:18,40,62`
- **Violação:** Política RLS sem `TO authenticated`
- **Impacto:** Sem `TO authenticated`, a política se aplica a `PUBLIC` (inclui `anon`). Um usuário anônimo pode inadvertidamente ter acesso a dados de `family_group_members` e `exams` se a política `USING` for satisfeita com uid NULL.
- **Severidade × Esforço:** 🟠 Importante × Baixo

```
ANTES (exemplo):
CREATE POLICY "Members can view their group"
  ON public.family_groups FOR SELECT
  USING (EXISTS (SELECT 1 FROM family_group_members WHERE auth_user_id = auth.uid() ...))

DEPOIS (migration de correção):
ALTER POLICY "Members can view their group" ON public.family_groups TO authenticated;
-- Repetir para todas as políticas afetadas listadas acima
```

---

### [ID-007] `auth.uid()` direto em RLS sem `(select auth.uid())`

- **Arquivos:** Múltiplas migrations — `20260321145854`, `20260402155636`, `20260621120000`, `20260622172313`, `20260622000000` e outras antigas
- **Violação:** Política RLS usa `auth.uid()` diretamente em vez de `(select auth.uid())`
- **Impacto:** `auth.uid()` chamado diretamente em `USING/WITH CHECK` é re-avaliado para cada linha pelo planner do PostgreSQL. `(select auth.uid())` é avaliado uma vez por query (init-plan). Em tabelas com milhares de registros, isso representa uma diferença de performance de 10–100x.
- **Severidade × Esforço:** 🟠 Importante × Médio

```
ANTES (exemplo, migrations 20260621120000 e outras):
USING (auth.uid() = user_id);

DEPOIS (padrão correto do projeto para novas migrations):
USING ((select auth.uid()) = user_id);

NOTA: As migrations existentes são imutáveis. Criar migration de ALTER POLICY
para tabelas de alto volume (medications, consultations, exams, medication_doses).
```

---

### [ID-008] `as any` sem narrowing em hooks críticos

- **Arquivos:**
  - `src/hooks/useHomeData.ts:37,120`
  - `src/hooks/useSurgeries.tsx:79,117,177,204,226`
  - `src/hooks/usePushSubscription.ts:99,122`
- **Violação:** `any` sem narrowing explícito em tipo exportado e em queries Supabase
- **Impacto:** O cast `supabase.from("surgeries" as any) as any` ocorre porque o `types.ts` não foi regenerado após a criação da tabela (TD-SRG-04 pendente). O risco é que erros de tipagem em runtime passem sem detecção em CI. `med: any` em `useHomeData.ts:37` exporta um tipo opaco para `TodayMedicationsSection`.
- **Severidade × Esforço:** 🟠 Importante × Médio

```
SOLUÇÃO:
1. Regenerar types.ts via Supabase CLI:
   bun run supabase gen types typescript --project-id <ID> > src/integrations/supabase/types.ts
2. Remover todos os 'as any' em useSurgeries.tsx e usePushSubscription.ts
3. Tipar MedWithNextDose.med como Medication (ver ID-019)
```

---

### [ID-009] N+1 latente em `send-appointment-reminders`

- **Arquivo:** `supabase/functions/send-appointment-reminders/index.ts:77,94,119`
- **Violação:** N+1 query em Edge Function de cron
- **Impacto:** Para cada consulta/exame/cirurgia do dia, `enqueue()` chama `getNotificationTargets` — 1 query por item. Em dias com muitos compromissos, escala linearmente.
- **Severidade × Esforço:** 🟠 Importante × Médio

```
SOLUÇÃO: Mesma estratégia do ID-002.
Pré-carregar todos os family_group_members dos grupos relevantes antes dos loops
e usar mapa em memória para resolver targets sem queries adicionais.
```

---

### [ID-010] `select("*")` em tabelas com PHI

- **Arquivos:**
  - `src/hooks/useHealthMeasurements.ts:27`
  - `src/hooks/useFamilyMembers.tsx:53`
- **Violação:** `select("*")` em tabela com dados PHI/pessoais
- **Impacto:** Busca todas as colunas incluindo futuras colunas adicionadas por migrations. Se uma migration adicionar uma coluna sensível, ela será retornada automaticamente sem revisão. Também transfere dados desnecessários pela rede.
- **Severidade × Esforço:** 🟠 Importante × Baixo

```
ANTES (useHealthMeasurements.ts:27):
.select("*")

DEPOIS:
.select("id, family_member_id, user_id, weight, height, bmi, recorded_at, created_at")

ANTES (useFamilyMembers.tsx:53):
.select("*")

DEPOIS:
.select("id, user_id, name, relationship, birth_date, gender, blood_type, phone, cpf, avatar_url, created_at, member_type, species, breed, tracks_menstrual_cycle, weight, height, physical_activity, deleted_at, group_id, postal_code, address_number")
```

---

### [ID-011] Dados financeiros Asaas em localStorage sem criptografia

- **Arquivo:** `src/hooks/useSubscription.ts:49-55`
- **Violação:** Dado financeiro em localStorage sem criptografia
- **Impacto:** O objeto armazenado contém `asaas_customer_id`, `asaas_subscription_id`, `asaas_payment_id` e `test_mode`. Em dispositivos compartilhados, outro usuário com acesso ao browser pode ler esses dados via DevTools. O mecanismo de proteção por `user_id` existe mas requer que o atacante saiba o user_id alvo.
- **Severidade × Esforço:** 🟠 Importante × Médio

```
ANTES (writeLocalCache):
localStorage.setItem(LOCAL_SUB_KEY, JSON.stringify({ ...sub, _cachedAt: Date.now() }));

DEPOIS (armazenar apenas o mínimo para o cold-start):
const { id, user_id, status, plan_type, trial_end, next_billing_date } = sub;
localStorage.setItem(LOCAL_SUB_KEY, JSON.stringify({
  id, user_id, status, plan_type, trial_end, next_billing_date,
  _cachedAt: Date.now()
}));
// Remover: asaas_customer_id, asaas_subscription_id, asaas_payment_id, test_mode
```

---

### [ID-012] Índice btree ausente em colunas de RLS de `consent_log`

- **Arquivo:** `supabase/migrations/20260616000009_lgpd_consent_log.sql`
- **Violação:** Nova tabela com coluna de RLS sem índice btree
- **Impacto:** `consent_log` não tem índice em `user_id`. A política `USING (user_id = auth.uid())` executa seq scan — em tabelas de auditoria que crescem rapidamente, isso pode ser custoso.
- **Severidade × Esforço:** 🟠 Importante × Baixo

```
CORREÇÃO (nova migration):
CREATE INDEX IF NOT EXISTS idx_consent_log_user_id
  ON public.consent_log (user_id);
```

---

### [ID-013] `onSuccess` em `useFamilyMembers` invalida queryKeys insuficientes

- **Arquivo:** `src/hooks/useFamilyMembers.tsx:76,92,105`
- **Violação:** `onSuccess` invalida menos queryKeys do que deveria
- **Impacto:** Após soft-delete de um membro, `["upcoming-appointments"]`, `["pending-counts"]` e `["today-pet-routines"]` não são invalidados. O membro deletado pode aparecer no carrossel da Home por até 5 minutos.
- **Severidade × Esforço:** 🟠 Importante × Baixo

```
ANTES (deleteMember.onSuccess):
queryClient.invalidateQueries({ queryKey: ["family_members", user?.id] });

DEPOIS:
queryClient.invalidateQueries({ queryKey: ["family_members"] });
queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
queryClient.invalidateQueries({ queryKey: ["today-pet-routines"] });
queryClient.invalidateQueries({ queryKey: ["agenda"] });
```

---

### [ID-014] `addMedication` / `updateMedication` não invalidam `["agenda"]`

- **Arquivo:** `src/hooks/useMedications.tsx:128,146`
- **Violação:** `onSuccess` invalida menos queryKeys do que deveria
- **Impacto:** Após adicionar ou editar um medicamento, a Agenda não é invalidada. Inconsistência com `useConsultations` que invalida `["agenda"]` corretamente.
- **Severidade × Esforço:** 🟠 Importante × Baixo

```
ANTES (addMedication.onSuccess e updateMedication.onSuccess):
queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
// falta: agenda

DEPOIS:
queryClient.invalidateQueries({ queryKey: ["medications"] });
queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
queryClient.invalidateQueries({ queryKey: ["agenda"] }); // ADICIONAR
```

---

### [ID-015] `console.log`/`console.error` em código de produção (não-PHI)

- **Arquivos:** 15+ ocorrências — `src/components/InviteAcceptInterceptor.tsx:83,132,246`, `src/hooks/useMedicationAlarms.ts:39`, `src/pages/Cadastro.tsx:23`, `src/pages/NotFound.tsx:8`, entre outros
- **Violação:** `console.log`/`console.error` em código de produção
- **Impacto:** Expõe mensagens de erro internas, pathnames e estados de autenticação via DevTools. Menor que ID-004/005 pois não envolve PHI direto.
- **Severidade × Esforço:** 🟡 Melhoria × Baixo

```
ANTES (InviteAcceptInterceptor.tsx:83):
console.error("[InviteInterceptor] provisionNewGroup error:", err);

DEPOIS:
import { captureException } from "@/lib/sentry";
captureException(err, { context: "inviteInterceptor.provisionNewGroup" });
```

---

### [ID-016] Formulários com PHI sem validação Zod no frontend

- **Arquivos:** `src/pages/Cadastro.tsx`, `src/pages/Login.tsx`, `src/components/AddMedicationDrawer.tsx`, `src/components/AddConsultationDrawer.tsx`, `src/components/AddSurgeryDrawer.tsx`
- **Violação:** Formulário com PHI sem validação Zod
- **Impacto:** Validações são feitas com lógica imperativa dispersa. A edge function `create-asaas-checkout` já usa Zod — o frontend não usa schema algum. Dificulta manutenção e permite inconsistências de validação entre frontend e backend.
- **Severidade × Esforço:** 🟠 Importante × Alto

```
SOLUÇÃO:
// src/lib/schemas/auth.ts
import { z } from "zod";
export const CadastroSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string(),
  consentAccepted: z.literal(true, { errorMap: () => ({ message: "Aceite obrigatório" }) }),
}).refine(d => d.password === d.confirmPassword, {
  message: "Senhas não coincidem", path: ["confirmPassword"]
});
```

---

### [ID-017] Comentário explicativo ausente no padrão `window.open("about:blank")`

- **Arquivos:** `src/pages/MeuPlano.tsx:97,167`, `src/pages/Ajustes.tsx:64`, `src/components/PaywallModal.tsx:151`, `src/pages/Landing.tsx:128`
- **Observação:** O padrão `window.open("about:blank")` ANTES do `await` está CORRETO — é a solução para o popup blocker do Safari/iOS. O gate está satisfeito. Achado: ausência de comentário que explique o porquê.
- **Violação:** Ausência de comentário preventivo — risco de regressão futura
- **Severidade × Esforço:** 🟡 Melhoria × Baixo

```
ANTES:
const checkoutWindow = window.open("about:blank", "_blank");
try {
  const url = await withTimeout(...)

DEPOIS:
// iOS Safari popup blocker: must open window synchronously BEFORE any await.
// Do NOT move window.open() after an await — it will be blocked on iOS PWA.
const checkoutWindow = window.open("about:blank", "_blank");
try {
  const url = await withTimeout(...)
```

---

### [ID-018] `aria-label` ausente em cards de saúde interativos

- **Escopo:** `src/components/SwipeableCard.tsx`, `src/components/ExamSwipeableCard.tsx`, `src/components/SurgeryCard.tsx`, `src/components/medications/MedicationListItem.tsx`
- **Violação:** `aria-label` ausente em card ou widget de saúde interativo
- **Impacto:** Cards de medicamento, consulta, exame e cirurgia com gesto de swipe não têm `aria-label` nos elementos interativos. Leitores de tela (VoiceOver iOS, TalkBack Android) não conseguem descrever a ação de swipe para usuários com deficiência visual. Apenas 15 ocorrências de `aria-label` em toda a pasta `src/components/`.
- **Severidade × Esforço:** 🟠 Importante × Médio

```
ANTES (SwipeableCard.tsx — container de swipe sem aria):
<div ref={cardRef} onTouchStart={handleTouchStart} ...>

DEPOIS:
<div
  ref={cardRef}
  role="listitem"
  aria-label={`${title} — deslize para esquerda para ações`}
  onTouchStart={handleTouchStart}
  ...
>
```

---

### [ID-019] `MedWithNextDose.med` tipado como `any` em tipo exportado

- **Arquivo:** `src/hooks/useHomeData.ts:37`
- **Violação:** `any` sem narrowing explícito em tipo exportado
- **Impacto:** `MedWithNextDose` é consumido por `TodayMedicationsSection.tsx`. O campo `med: any` remove toda a segurança de tipo na renderização dos cards de medicamento na Home.
- **Severidade × Esforço:** 🟡 Melhoria × Baixo

```
ANTES:
export type MedWithNextDose = {
  med: any;
  ...
}

DEPOIS:
import type { Medication } from "@/hooks/useMedications";
export type MedWithNextDose = {
  med: Medication;
  effectiveScheduledFor: string | null;
  doseLabel: string;
  isOverdue: boolean;
  doseStatus: "taken" | "skipped" | null;
  isContinuous: boolean;
  effectiveFreqType: string;
  startDateISO: string | null;
};
```

---

### [ID-020] Duas migrations conflitantes para o módulo Cirurgias

- **Arquivos:**
  - `supabase/migrations/20260622000000_add_surgeries_module.sql` — usa `fgm.user_id = auth.uid()` (campo errado)
  - `supabase/migrations/20260622172313_d78937ea.sql` — usa `fgm.auth_user_id = auth.uid()` (campo correto)
- **Violação:** Migrations duplicadas criando as mesmas tabelas com RLS ligeiramente diferente
- **Impacto:** A migration `20260622000000` usa `fgm.user_id` que não existe (o campo correto é `auth_user_id`). Em produção, as políticas com o campo errado foram criadas e depois sobrescritas pela segunda migration. O ambiente de staging pode ter ficado com políticas ineficazes entre os dois deploys, potencialmente permitindo acesso indevido temporário.
- **Severidade × Esforço:** 🟡 Melhoria × Alto

```
AÇÃO RECOMENDADA:
1. Documentar que 20260622000000 foi supersedida por 20260622172313
2. Criar migration 20260625000000_surgeries_cleanup para:
   - DROP TABLE IF EXISTS surgeries CASCADE (se a primeira migration chegou a ser aplicada)
   - Garantir que apenas as políticas da 20260622172313 estejam ativas
3. Adicionar comentário no topo de 20260622000000:
   -- SUPERSEDIDA por 20260622172313 — campo fgm.user_id não existe (correto: fgm.auth_user_id)
```

---

## Achados por Domínio

### Segurança / LGPD
- [ID-001] `error.message` exposto em edge function de cron
- [ID-004] `console.log` com PHI (texto completo do PDF SUS) em produção
- [ID-005] `console.log` com CPF em produção
- [ID-011] Dados financeiros Asaas em localStorage sem criptografia

### Performance / RLS
- [ID-002] N+1 query em `send-medication-reminders`
- [ID-006] Políticas RLS sem `TO authenticated`
- [ID-007] `auth.uid()` direto em vez de `(select auth.uid())`
- [ID-009] N+1 latente em `send-appointment-reminders`
- [ID-012] Índice btree ausente em `consent_log.user_id`

### TypeScript / Qualidade
- [ID-008] `as any` sem narrowing em `useHomeData` e `useSurgeries`
- [ID-016] Formulários com PHI sem validação Zod
- [ID-019] `MedWithNextDose.med` tipado como `any`
- [ID-020] Migrations conflitantes para módulo Cirurgias

### UX / Acessibilidade
- [ID-003] staleTime de 5min em dados clínicos PHI
- [ID-013] `onSuccess` invalida queryKeys incompleto em `useFamilyMembers`
- [ID-014] `addMedication` não invalida `["agenda"]`
- [ID-018] `aria-label` ausente em cards de saúde

### Design System / DX
- [ID-010] `select("*")` em tabelas com PHI
- [ID-015] `console.log`/`error` não-PHI em produção
- [ID-017] Comentário preventivo ausente no padrão `window.open("about:blank")`

---

## Pontos Positivos Identificados

Para referência e manutenção do padrão:

- **RLS bem estruturado:** Uso correto de `!inner` + `.is("family_members.deleted_at", null)` nos joins de tabelas clínicas (useMedications, useHomeData, send-medication-reminders).
- **Sem SELECT * em subscriptions:** Todas as queries em `subscriptions` usam colunas explícitas — satisfaz o gate crítico da migration 20260619212318.
- **window.open antes de await:** Padrão correto implementado em todos os 5 locais de checkout.
- **Auth em edge functions:** Todas as edge functions voltadas ao usuário validam JWT via `auth.getUser()` antes de processar.
- **Sem secrets em comentários:** Nenhum valor real de VAPID, API key ou senha encontrado em comentários, JSDoc ou SQL — apenas placeholders.
- **Sem linguagem diagnóstica clínica:** Nenhuma ocorrência de "você pode ter...", "isso indica...", "provavelmente" em contexto de saúde.
- **group_id presente em inserts:** `addMedication`, `addConsultation`, `addExam` incluem `group_id: groupId` nos inserts.

---

## Próximos Passos Sugeridos

Ordem priorizada considerando severidade + esforço:

1. **[ID-004] + [ID-005]** Remover `console.log` com PHI de `parseSusVaccinePdf.ts` e `useVaccineImport.ts` — 30 minutos, impacto LGPD imediato
2. **[ID-001]** Corrigir `error.message` exposto em `send-medication-reminders` — 15 minutos
3. **[ID-003]** Mudar `staleTime: 0` em hooks de dados clínicos PHI — 1h, impacto direto em integridade de dados médicos
4. **[ID-019]** Tipar `MedWithNextDose.med` como `Medication` — 30 minutos
5. **[ID-013] + [ID-014]** Completar invalidação de queryKeys em `useFamilyMembers` e `useMedications` — 1h
6. **[ID-011]** Sanitizar objeto de cache em localStorage de `useSubscription` — 1h
7. **[ID-010]** Trocar `select("*")` por colunas explícitas em `useHealthMeasurements` e `useFamilyMembers` — 1h
8. **[ID-012]** Migration com índice em `consent_log.user_id` — 30 minutos
9. **[ID-002]** Refatorar N+1 em `send-medication-reminders` com pré-load de grupo members — 4h
10. **[ID-009]** Refatorar N+1 em `send-appointment-reminders` (mesma estratégia) — 3h
11. **[ID-006]** Migration de correção para políticas RLS sem `TO authenticated` — 2h
12. **[ID-007]** Migration de `(select auth.uid())` para tabelas de alto volume — 4h
13. **[ID-008]** Regenerar `types.ts` (TD-SRG-04) e remover `as any` — bloqueia todo o resto
14. **[ID-018]** Adicionar `aria-label` em cards de saúde — 4h
15. **[ID-015]** Substituir `console.error` por `captureException` em componentes críticos — 2h
16. **[ID-016]** Implementar schemas Zod nos formulários de cadastro e medicamentos — 8h+
17. **[ID-017]** Adicionar comentários preventivos ao padrão `window.open("about:blank")` — 30 minutos
18. **[ID-020]** Documentar e consolidar migrations conflitantes de cirurgias — 2h
