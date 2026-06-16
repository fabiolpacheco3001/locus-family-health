# Locus Vita — Backlog de Dívida Técnica

> **Versão:** 2.0 | **Atualizado em:** junho/2026  
> **Fonte:** SSOT original + Análise Devin AI (8 prompts) + sessão de segurança junho/2026  
> **Mantenedor:** Claude (Cowork)

---

## Legenda de Status

| Ícone | Significado |
|-------|-------------|
| ✅ | Resolvido nesta sessão |
| 🔴 | Pendente / Bloqueador |
| 🟡 | Em andamento |
| ⬜ | Backlog (priorizado mas não iniciado) |

---

## 🔴 CRÍTICO — Bloqueadores de produção ou risco imediato de dados

### C1 · `.env` commitado no repositório
- **Risco:** `.env` com `SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` versionados no Git. Os valores são chaves públicas (anon key — seguras por design com RLS), mas o arquivo não deveria estar no repositório.
- **Ação:**
  1. Adicionar `.env` ao `.gitignore`
  2. Usar `git rm --cached .env` para remover do tracking
  3. Verificar se existem secrets reais (SERVICE_ROLE_KEY, ASAAS_API_KEY) no histórico — se sim, fazer BFG Repo Cleaner
- **Arquivos:** `.env`, `.gitignore`
- **Status:** 🔴 Pendente

---

### C2 · Asaas hardcoded em `sandbox.asaas.com` — go-live vai falhar
- **Risco:** Todo o fluxo financeiro aponta para o sandbox. Em produção, cobranças não serão processadas.
- **Detalhe extra (C9):** URLs inconsistentes entre funções — `create-asaas-checkout` e `asaas-webhook` usam `sandbox.asaas.com/api/v3`; `cancel-asaas-subscription` usa `api-sandbox.asaas.com/v3` (host diferente).
- **Fix:** Criar secret `ASAAS_BASE_URL` no Supabase → `https://api.asaas.com/v3`. Substituir todas as ocorrências hardcoded.
- **Arquivos:**
  - `supabase/functions/create-asaas-checkout/index.ts` (linhas 15, 78)
  - `supabase/functions/asaas-webhook/index.ts` (linha 17)
  - `supabase/functions/cancel-asaas-subscription/index.ts` (linhas 72, 101)
- **Status:** 🔴 Pendente

---

### C3 · Biometria falsa — toggle em `localStorage` sem WebAuthn
- **Risco:** UX enganosa; usuários acreditam ter proteção biométrica que não existe.
- **Fix (opção A):** Remover o toggle completamente até ter implementação real.  
  **Fix (opção B):** Implementar WebAuthn via `navigator.credentials.create()` / `get()`.
- **Arquivos:** `src/pages/Seguranca.tsx` (linhas 12–22)
- **Status:** 🔴 Pendente

---

### C4 · `family_group_members` sem índice em `auth_user_id` e `group_id`
- **Risco:** Toda query autenticada que acessa tabelas clínicas executa `EXISTS (SELECT 1 FROM family_group_members WHERE auth_user_id = auth.uid())` — **full scan** na tabela. Afeta 100% das RLS policies group-aware (medications, consultations, exams, vaccines, diseases, notifications...).
- **Fix:** Migration com dois índices. Ver **migration 000007** (criada nesta sessão).
- **Status:** 🔴 Pendente (migration criada, aguarda apply)

---

### C5 · `subscriptions` sem `UNIQUE` constraint em `user_id`
- **Risco:** `asaas-webhook` faz `upsert onConflict="user_id"` — sem a constraint UNIQUE, o PostgreSQL não resolve o conflito e pode inserir linhas duplicadas de assinatura silenciosamente.
- **Fix:** Migration com `ALTER TABLE subscriptions ADD UNIQUE (user_id)`. Ver **migration 000007**.
- **Status:** 🔴 Pendente (migration criada, aguarda apply)

---

### C6 · `asaas-webhook`: `externalReference` usado como `user_id` sem validação UUID
- **Risco:** `body.payment.externalReference` é injetado diretamente em `upsert({ user_id: externalReference })`. Se o Asaas enviar um valor malformado ou o webhook token for comprometido, um `user_id` arbitrário pode ser inserido na tabela `subscriptions`.
- **Fix:** Adicionar validação UUID antes do upsert:
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(externalReference)) {
    return json({ error: "Invalid externalReference format" }, 400);
  }
  ```
- **Arquivos:** `supabase/functions/asaas-webhook/index.ts` (linhas 129–144)
- **Status:** 🔴 Pendente

---

### C7 · Art. 11 LGPD — Cadastro sem consentimento para tratamento de dados de saúde
- **Risco:** O cadastro coleta nome/email e cria conta sem mencionar que dados de saúde serão tratados. A política de privacidade tem `path: null` em Ajustes.tsx — link quebrado.
- **Fix:**
  1. Adicionar checkbox de consentimento no cadastro com link para política de privacidade
  2. Criar página `/politica-de-privacidade`
  3. Criar tabela `consent_log` para registrar consentimentos com timestamp
- **Arquivos:** `src/pages/Cadastro.tsx`, `src/pages/Ajustes.tsx` (linha 28)
- **Status:** 🔴 Pendente

---

### C8 · Art. 18-IV LGPD — `handleDeleteAccount` não deleta dados do usuário
- **Risco:** O botão "Excluir Conta" faz apenas soft-delete de `family_members` e signOut. Não deleta `auth.users`, dados clínicos (medications, consultations, exams, vaccines...), arquivos de Storage, `ai_usage_logs`, `email_send_log` ou `subscriptions`.
- **Fix:** Criar Edge Function `delete-user-account` que:
  1. Deleta arquivos de Storage do usuário (receitas, exames, avatares)
  2. Deleta registros clínicos via cascade ou DELETE explícito
  3. Deleta `subscriptions`, `ai_usage_logs`, `email_send_log`, `notifications`
  4. Chama `supabase.auth.admin.deleteUser(userId)` como último passo
- **Arquivos:** `src/pages/Ajustes.tsx` (linhas 83–117)
- **Status:** 🔴 Pendente

---

### C10 · Preços dos planos em 5 locais sem fonte única de verdade
- **Risco:** R$19,90 / R$191,00 duplicados em código frontend e backend. O threshold `>= 150` no webhook é a lógica de classificação de plano — se o preço mudar, a classificação quebra silenciosamente.
- **Fix:** Criar tabela `plan_configs` ou env vars `PLAN_MONTHLY_PRICE` / `PLAN_ANNUAL_PRICE`. Centralizar threshold no webhook.
- **Arquivos:**
  - `supabase/functions/create-asaas-checkout/index.ts` (linhas 21, 27)
  - `supabase/functions/asaas-webhook/index.ts` (linha 169)
  - `src/pages/MeuPlano.tsx`, `src/pages/Landing.tsx`, `src/components/PaywallModal.tsx`
- **Status:** 🔴 Pendente

---

### C11 · `get_admin_clients` RPC sem verificação de role ✅
- **Risco resolvido:** Qualquer usuário autenticado podia obter lista completa de usuários (nome, email, assinatura) via `supabase.rpc("get_admin_clients")`.
- **Resolução:** Migration `20260615000006` — adicionado `RAISE EXCEPTION` para não-admins, `SET search_path`, `REVOKE ALL FROM PUBLIC`.
- **Status:** ✅ Resolvido (aguarda apply no SQL Editor)

---

## 🔴 ALTO — Risco operacional ou segurança significativa

### A1 · CORS wildcard (`*`) em todas as Edge Functions
- **Risco:** Qualquer origem pode fazer chamadas autenticadas às Edge Functions.
- **Fix:** Substituir `"*"` por `Deno.env.get("APP_ORIGIN") ?? "https://seu-dominio.com"` + adicionar `Vary: Origin`. Remover CORS de `asaas-webhook` (server-to-server).
- **Arquivos:** Todas as Edge Functions (7 funções com CORS)
- **Status:** ⬜ Backlog

---

### A2 · Campo "Senha Atual" decorativo — nunca enviado ao servidor
- **Risco:** Usuário acredita que confirmar a senha atual protege a troca de senha, mas o campo não é validado no backend (Supabase não recebe o valor atual).
- **Fix:** Remover o campo ou implementar verificação real via `supabase.auth.signInWithPassword` antes de chamar `updateUser({ password })`.
- **Arquivos:** `src/pages/Seguranca.tsx` (linha 49)
- **Status:** ⬜ Backlog

---

### A3 · `AdminRoute` client-side contornável via React DevTools
- **Risco baixo (mitigado):** Exposição da UI do command-center, mas dados protegidos por RLS + Edge Functions server-side. Não é vetor de acesso a dados.
- **Fix:** Substituir `useState` por verificação via `useEffect` + redirect imediato, sem expor `children` antes da confirmação.
- **Arquivos:** `src/components/AdminRoute.tsx`
- **Status:** ⬜ Backlog (baixa urgência — backend protege dados)

---

### A4 · Rate limiting zero em `analyze-prescription` e `analyze-exam`
- **Risco:** Usuário malicioso pode gerar custos ilimitados de IA. `useAiStatus` fail-open retorna `true` em caso de erro de query.
- **Fix:** Verificar `ai_usage_logs` antes de cada chamada; limitar a N calls/hora por usuário. Corrigir `useAiStatus` para fail-closed.
- **Arquivos:** `supabase/functions/analyze-prescription/index.ts`, `supabase/functions/analyze-exam/index.ts`, `src/hooks/useAiStatus.ts`
- **Status:** ⬜ Backlog

---

### A5 · TypeScript strict mode — Fase 2
- **Fase 1 concluída:** `strictNullChecks: true` + 9 `as any` removidos + type augmentation jspdf-autotable.
- **Fase 2:** Regenerar `src/integrations/supabase/types.ts` via `supabase gen types typescript` → eliminar `.from("table" as any)` e `.insert({ } as any)`. Depois habilitar `noImplicitAny: true`.
- **Status:** 🟡 Fase 1 concluída — Fase 2 pendente

---

### A6 · Sem `<ErrorBoundary>` global → white screens silenciosos
- **Fix:** Adicionar `<ErrorBoundary>` em `src/App.tsx` com fallback UI e log para Sentry.
- **Arquivos:** `src/App.tsx`
- **Status:** ⬜ Backlog

---

### A7 · Cobertura de testes ~0% (apenas 1 smoke test)
- **Fix prioritário:** Hooks críticos (`useUpcomingAppointments`, `calculateNextDose`, `useSubscription`) + fluxos E2E com Playwright (login, cadastro de medicamento, marcação de dose).
- **Status:** ⬜ Backlog

---

### A8 · `manage-admins list-emails` aceita array ilimitado de userIds
- **Risco:** Enumeração massiva de emails de usuários por admins sem audit log.
- **Fix:** Limitar array a 100 IDs máximo + adicionar registro em audit log.
- **Arquivos:** `supabase/functions/manage-admins/index.ts` (linhas 50–60)
- **Status:** ⬜ Backlog

---

### A9 · `publish-changelog` sem paginação de usuários
- **Risco:** `listUsers({ perPage: 1000 })` — usuários além do milésimo não recebem notificação de release.
- **Fix:** Implementar loop de paginação.
- **Arquivos:** `supabase/functions/publish-changelog/index.ts` (linhas 79–92)
- **Status:** ⬜ Backlog

---

### A10 · `subscriptions.asaas_customer_id` sem índice + `user_id` sem índice
- **Risco:** Webhook fallback por `asaas_customer_id` faz full scan. Toda verificação de assinatura ativa filtra por `user_id` sem índice.
- **Fix:** Ver **migration 000007**.
- **Status:** 🔴 Pendente (migration criada, aguarda apply)

---

### A11 · Tabelas clínicas sem índice em `family_member_id` e `user_id`
- **Afeta:** `consultations`, `exams`, `medications`, `vaccines`, `allergies`, `diseases`, `health_measurements`, `blood_pressure_history`, `menstrual_cycles`
- **Fix:** Ver **migration 000008** (a criar).
- **Status:** 🔴 Pendente

---

### A12 · `medication_doses` sem TTL/particionamento
- **Risco:** ~5M rows/ano com 1k usuários. Queries de aderência degradam progressivamente.
- **Fix:** Criar pg_cron job que deleta doses com `scheduled_for < now() - interval '2 years'` + avaliar particionamento por `scheduled_for`.
- **Status:** ⬜ Backlog

---

### A13 · `pdfjs-dist` (~900KB) + `jspdf` (~250KB) importados estaticamente
- **Risco:** Bundle inicial inclui ~1.1MB de libs de PDF que só são usadas ao clicar "Exportar".
- **Fix:** Converter para `dynamic import()` dentro dos handlers de clique.
- **Arquivos:** `src/pages/Vacinas.tsx`, `src/pages/FamiliarProfile.tsx`, `src/components/AdherenceHistoryDrawer.tsx`
- **Status:** ⬜ Backlog

---

### A14 · Art. 7 LGPD — Política de privacidade não implementada
- **Fix:** Criar página `/politica-de-privacidade` com finalidade do tratamento, base legal, compartilhamento de dados e canal de contato (DPO).
- **Status:** ⬜ Backlog

---

### A15 · Art. 18-V LGPD — Sem portabilidade de dados
- **Fix:** Criar endpoint de export completo em JSON/CSV (todos os dados clínicos do titular).
- **Status:** ⬜ Backlog

---

### A16 · Art. 48 LGPD — Sem mecanismo de detecção ou notificação de incidentes
- **Fix:** Integrar Sentry (cobre parcialmente) + criar runbook de resposta a incidentes + definir processo de notificação à ANPD.
- **Status:** ⬜ Backlog

---

### A17 · `patientAge` injetado no system prompt da IA sem sanitização
- **Fix:** Sanitizar/validar `patientAge` antes de interpolar no prompt (número inteiro positivo, máximo 150).
- **Arquivos:** `supabase/functions/analyze-prescription/index.ts` (linhas 62–76)
- **Status:** ⬜ Backlog

---

### A18 · `pdfjs-dist` pinado sem `^` — nunca recebe patches de segurança
- **Fix:** Remover pin fixo, atualizar para `^5.x` no `package.json`.
- **Arquivos:** `package.json` (linha 59)
- **Status:** ⬜ Backlog

---

## 🟡 MÉDIO — Degradação com crescimento ou manutenibilidade

### M1 · Sem APM/Sentry
- **Fix:** Instrumentar `@sentry/react` + `@sentry/node` nas Edge Functions. Adicionar ao `<ErrorBoundary>`.
- **Status:** ⬜ Backlog

---

### M2 · Sem CI/CD no repositório
- **Fix:** GitHub Actions com: `lint` → `typecheck` → `vitest` → `supabase db test`.
- **Status:** ⬜ Backlog

---

### M3 · `Home.tsx` (826 LOC) e `Vacinas.tsx` (801 LOC) monolíticos
- **Fix:** Extrair sub-componentes e hooks por responsabilidade.
- **Status:** ⬜ Backlog

---

### M4 · Edge Functions sem `import_map.json` — versões inconsistentes
- **Risco:** `std@0.168.0` em 2 funções, `supabase-js@2` (sem versão) em 2, `supabase-js@2.49.1` em 4.
- **Fix:** Criar `supabase/functions/import_map.json` centralizando todas as dependências Deno.
- **Status:** ⬜ Backlog

---

### M5 · `useSubscription` — 4 queries sequenciais (2 poderiam ser paralelas)
- **Fix:** Paralelizar queries 1 e 2 com `Promise.all`.
- **Arquivos:** `src/hooks/useSubscription.ts` (linhas 27–64)
- **Status:** ⬜ Backlog

---

### M6 · `useStockAlerts` e `useMenstrualAlerts` — N×2 queries sequenciais
- **Fix:** Substituir loops por single batch dedup query + single batch insert.
- **Arquivos:** `src/hooks/useStockAlerts.ts`, `src/hooks/useMenstrualAlerts.ts`
- **Status:** ⬜ Backlog

---

### M7 · Componentes sem `React.memo`
- **Afeta:** `NotificationCard`, `BottomNav`, `MemberAvatar`, `ClinicalTimeline`
- **Fix:** Adicionar `React.memo` + `useCallback` nas funções inline do `BottomNav`.
- **Status:** ⬜ Backlog

---

### M8 · `manage-admins` sem audit log de acesso
- **Fix:** Inserir registro em tabela `admin_audit_log` a cada ação (promote, revoke, list).
- **Status:** ⬜ Backlog

---

### M9 · Logs não estruturados nas Edge Functions
- **Fix:** Substituir `console.log(string)` por `console.log(JSON.stringify({ level, event, userId, ... }))`.
- **Status:** ⬜ Backlog

---

### M10 · `setTimeout(1500)` hardcoded no checkout Asaas
- **Fix:** Substituir por polling com backoff (verificar status do pagamento a cada N ms até timeout).
- **Arquivos:** `supabase/functions/create-asaas-checkout/index.ts` (linha 72)
- **Status:** ⬜ Backlog

---

### M11 · Sem TTL em `notifications`, `ai_usage_logs`, `email_send_log`
- **Fix:** pg_cron jobs de limpeza:
  - `notifications` lidas com >30 dias
  - `ai_usage_logs` com >90 dias
  - `email_send_log` com >90 dias
- **Status:** ⬜ Backlog

---

### M12 · Art. 18-I LGPD — Acesso a dados apenas via PDF parcial
- **Fix:** Endpoint de export completo em JSON (todos os dados do titular). Ver A15.
- **Status:** ⬜ Backlog

---

### M13 · `email_send_log.recipient_email` em texto plano
- **Fix:** Pseudonimizar com hash SHA-256 + salt; manter email completo apenas por 24h e depois substituir pelo hash.
- **Status:** ⬜ Backlog

---

### M14 · Art. 18-IX LGPD — Sem revogação de consentimento
- **Fix:** Adicionar página "Gerenciar meus dados" com opção de revogar consentimento de uso de IA.
- **Status:** ⬜ Backlog

---

### M15 · Índices parciais ausentes
- **Afeta:** `medications WHERE status='Ativo'`, `notifications WHERE is_read=false`, `subscriptions WHERE status='active'`, `email_send_log WHERE status='pending'`
- **Fix:** Ver **migration 000008**.
- **Status:** 🔴 Pendente

---

### M16 · `blood_pressure_history.familiar_id` e `menstrual_cycles.familiar_id` sem FK constraint
- **Fix:** Migration com `ADD CONSTRAINT ... FOREIGN KEY (familiar_id) REFERENCES family_members(id)`.
- **Fix:** Ver **migration 000008**.
- **Status:** 🔴 Pendente

---

### M17 · Modelo de IA e gateway URL hardcoded
- **Fix:** Criar secrets `AI_MODEL` e `AI_GATEWAY_URL` no Supabase.
- **Arquivos:** `supabase/functions/analyze-exam/index.ts` (linha 134), `supabase/functions/analyze-prescription/index.ts` (linha 151)
- **Status:** ⬜ Backlog

---

### M18 · `.eq('id', 1)` hardcoded em `process-email-queue`
- **Risco:** Se a tabela `email_send_state` for recriada com ID diferente de 1, a fila para silenciosamente.
- **Fix:** Buscar linha por coluna semântica (ex: `.eq('queue_name', 'default')`) em vez de ID numérico.
- **Arquivos:** `supabase/functions/process-email-queue/index.ts` (linha 315)
- **Status:** ⬜ Backlog

---

### M19 · Imagens sem otimização (landing page e listas)
- **Fix:** `loading="lazy"` nas imagens de seção da landing; versão WebP do logo; dimensões no `<img>` do ClinicalTimeline (previne CLS).
- **Status:** ⬜ Backlog

---

## 🟢 BAIXO — Higiene técnica e polish

### B1 · `deno.land/std@0.168.0` desatualizado (atual: 0.224+)
- **Fix:** Atualizar via `import_map.json`. Ver M4.
- **Status:** ⬜ Backlog

---

### B2 · `@radix-ui/react-toast` + `sonner` duplicados
- **Fix:** Remover `useToast` (Radix) dos 3 arquivos que ainda o usam e migrar para `sonner`. Remover `@radix-ui/react-toast`.
- **Arquivos:** `src/components/ui/toaster.tsx`, `src/hooks/use-toast.ts`, `src/App.tsx`
- **Status:** ⬜ Backlog

---

### B3 · Helper de timezone espalhado
- **Fix:** Criar `src/lib/tz.ts` com `formatTZ`, `parseTZ` e constante `TZ = 'America/Sao_Paulo'`.
- **Status:** ⬜ Backlog

---

### B4 · `QueryClient` sem `defaultOptions` de erro global
- **Fix:** Adicionar `defaultOptions: { queries: { onError: (e) => Sentry.captureException(e) } }` no `queryClient` de `App.tsx`.
- **Status:** ⬜ Backlog

---

### B5 · Login, Cadastro, ResetPassword sem `lazy()` — Suspense inútil
- **Fix:** Converter imports estáticos para `const X = lazy(() => import('./pages/X'))`.
- **Arquivos:** `src/App.tsx` (linhas 10–19)
- **Status:** ⬜ Backlog

---

### B6 · `vite` v5.x com histórico de CVEs de path traversal
- **Fix:** Migrar para Vite 6.x (breaking changes documentados).
- **Status:** ⬜ Backlog

---

### B7 · `changelogs` e `group_invites` sem índices nas colunas de filtro
- **Fix:** Ver **migration 000008**.
- **Status:** 🔴 Pendente

---

### B8 · Project ID hardcoded em `useAuth.tsx`
- **Fix:** Substituir string literal pela variável `import.meta.env.VITE_SUPABASE_PROJECT_ID`.
- **Arquivos:** `src/hooks/useAuth.tsx` (linha 22)
- **Status:** ⬜ Backlog

---

### B9 · Dependências 1+ major version atrás
| Pacote | Atual | Disponível | Complexidade de migração |
|--------|-------|------------|--------------------------|
| `pdfjs-dist` | 4.4.168 (pinado) | 5.x | Média (ver A18) |
| `react-router-dom` | 6.x | 7.x | Média |
| `recharts` | 2.x | 3.x | Baixa |
| `react-day-picker` | 8.x | 9.x | Baixa |
| `date-fns` | 3.x | 4.x | Baixa |
| `zod` | 3.x | 4.x | Média |
| `tailwindcss` | 3.x | 4.x | Alta (rewrite completo) |
| `react` | 18.x | 19.x | Alta |
- **Status:** ⬜ Backlog

---

## Itens Resolvidos nesta Sessão (junho/2026)

| Item | Resolução |
|------|-----------|
| Buckets públicos (LGPD) | ✅ Migrations 000004 e 000005 — storage policies com `TO authenticated` + folder scoping |
| HIBP (Leaked Password) | ✅ Habilitado em Auth Settings |
| 16 findings do scanner Lovable | ✅ 0 erros, 23 warnings by-design |
| TypeScript Fase 1 (`strictNullChecks`) | ✅ Habilitado + 9 `as any` removidos + type augmentation jspdf-autotable |
| `get_admin_clients` sem role check | ✅ Migration 000006 com RAISE EXCEPTION para não-admins |

---

## Roadmap Sugerido de Execução

```
Sprint 1 — Segurança e integridade de dados (AGORA)
├── C4 + C5 + A10 + A11 + M15–M16 + B7  → Migrations 000007 + 000008 (indexes)
├── C2 + C9                               → Asaas: ASAAS_BASE_URL como env var
├── C6                                    → asaas-webhook: validação UUID
└── C1                                    → .gitignore + verificar histórico

Sprint 2 — Compliance LGPD (bloqueador legal)
├── C7 + A14                              → Política de privacidade + consentimento no cadastro
├── C8                                    → Edge Function delete-user-account
├── A15 + M12                             → Export de dados (portabilidade)
└── M14                                   → Revogação de consentimento

Sprint 3 — Go-live readiness
├── C3                                    → Biometria: remover fake ou implementar WebAuthn
├── A2                                    → "Senha Atual" — validar ou remover
├── A1                                    → CORS: restringir ao domínio da app
├── A4                                    → Rate limiting nas funções de IA
└── C10                                   → Preços: fonte única de verdade

Sprint 4 — Qualidade e performance
├── A5 (Fase 2 TypeScript)                → Regenerar types.ts, noImplicitAny
├── A6                                    → ErrorBoundary global
├── A7                                    → Testes (hooks críticos + E2E)
├── A13 + B5                              → Dynamic imports PDF + lazy routes
└── M5 + M6 + M7                          → Otimizações de queries e renders

Sprint 5 — Observabilidade e manutenibilidade
├── M1                                    → Sentry / APM
├── M2                                    → CI/CD (GitHub Actions)
├── M4 + B1                               → import_map.json + Deno std atualizado
└── M9                                    → Logs estruturados nas Edge Functions
```

---

*Documento gerado automaticamente pelo Claude (Cowork). Atualizar após cada sprint ou mudança arquitetural significativa.*
