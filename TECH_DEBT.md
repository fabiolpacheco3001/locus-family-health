# Locus Vita — Backlog de Dívida Técnica

> **Versão:** 2.9 | **Atualizado em:** junho/2026 (sessão 12)  
> **Fonte:** SSOT original + Análise Devin AI (8 prompts) + sessões de segurança junho/2026  
> **Mantenedor:** Claude (Cowork)

---

## 📋 Resumo das Sessões

| Sessão | Itens resolvidos | Status Sprint |
|--------|-----------------|---------------|
| Sessão 1 | C1, C2+C9, C4, C5, C6, C11, A10, A11, M15, M16, B7 (11 itens) | Sprint 1 ✅ CONCLUÍDO |
| Sessão 2 | C8, C7+A14 — LGPD consentimento + deleção de conta | Sprint 2 🟡 Em progresso |
| Sessão 3 | C3, A2, M14, A15 — Biometria, Senha, Revogação, Portabilidade | Sprint 2 ✅ CONCLUÍDO |
| Sessão 4 | A1, A4, C10 — CORS restrito, Rate limiting IA, Preços centralizados | Sprint 3 ✅ CONCLUÍDO |
| Sessão 5 | Fix 4 Lovable warnings (erros Asaas, ownership clínico, ai_usage_logs, check_group_access) + UX admin + badge fix | Segurança ✅ CONCLUÍDO |
| Sessão 6 | P0 cancel-asaas-subscription body bypass; P1 decrement_stock ownership + error sanitization (5 funções); migration 000017 ownership completo; lib/tz.ts; restructure deploy doc | Segurança ✅ CONCLUÍDO |
| Sessão 7 | Migration 000018: blood_pressure_history + menstrual_cycles INSERT policies com familiar_id ownership (RAIO X 3.0 findings #1/#2) | Segurança ✅ CONCLUÍDO |
| Sessão 8 | A6 ErrorBoundary global, A13 dynamic PDF imports, A17 patientAge sanitização, B3 tz.ts, B5 lazy routes (27 páginas) — Sprint 4 início | Sprint 4 🟡 Em progresso |
| Sessão 9 | M5 Promise.all em useSubscription, M6 batch dedup+insert em Stock/Menstrual alerts, M7 React.memo em 4 componentes + useCallback BottomNav | Sprint 4 🟡 Em progresso |
| Sessão 10 | A5 Fase 2 completa: `noImplicitAny: true` habilitado, 93→0 `as any` eliminados — FamilyMember type augmentado, 22 `.from() as any` via sed, 71 casts explícitos resolvidos por categoria | Sprint 4 ✅ CONCLUÍDO |
| Sessão 11 | Sprint 5: M4+B1 import_map.json Deno (std@0.224, supabase-js@2.49.4); M9 logs JSON estruturados (shared logger.ts, 9 Edge Functions, 66→0 console.* não estruturados); M2 CI/CD GitHub Actions (lint+typecheck+test); A7 testes unitários calculateNextDose (3 describe, 24 it, fake timers); M1 Sentry integração preparada (@sentry/react, lib/sentry.ts, initSentry em main.tsx, captureException em ErrorBoundary) | Sprint 5 ✅ CONCLUÍDO |
| Sessão 12 | Sprint 6: Bug ∞ Dipirona (Fase 401) — homeDoseStatuses date filter (.gte -7d), useMedicationAlarms catch-up (loop calculateNextDose para specific_times/specific_days), MedicationDoseActions auto-conclusão (3 frequency_types, 4 novas props); Fix analyze-prescription "Failed to send" — APP_ORIGIN secret corrigido para `https://vita.locustech.com.br` (sem path); Lovable corrigiu 6 erros TS residuais em Home.tsx, Medicamentos.tsx, Ajustes.tsx, EditPetRoutineDrawer.tsx | Sprint 6 ✅ CONCLUÍDO |

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

### C1 · `.env` commitado no repositório ✅
- **Risco resolvido:** `.env` estava versionado no Git, mas análise do histórico (`git show 871280c:.env`) confirmou que **apenas chaves públicas** foram commitadas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. Nenhuma rotação de secret foi necessária.
- **Resolução:**
  1. `.env` adicionado ao `.gitignore`
  2. `git rm --cached` confirmou que o arquivo já não estava sendo rastreado
  3. Histórico auditado — nenhum secret real (SERVICE_ROLE_KEY, ASAAS_API_KEY) exposto
- **Arquivos:** `.env`, `.gitignore`
- **Status:** ✅ Resolvido

---

### C2 + C9 · Asaas hardcoded em `sandbox.asaas.com` — go-live vai falhar ✅
- **Risco resolvido:** URLs de sandbox hardcoded (e inconsistentes) em 3 Edge Functions.
- **Resolução:** Secret `ASAAS_API_URL` criado no Supabase Dashboard. Todas as 3 funções agora usam `Deno.env.get("ASAAS_API_URL")` com validação de null check. Para go-live: atualizar `ASAAS_API_URL` de `https://sandbox.asaas.com/api/v3` para `https://api.asaas.com/v3` no Supabase Secrets.
- **Arquivos modificados:**
  - `supabase/functions/create-asaas-checkout/index.ts` — linha 15–16 com throw se não configurado
  - `supabase/functions/asaas-webhook/index.ts` — `fetchAsaasSubscription()` usa ASAAS_API_URL
  - `supabase/functions/cancel-asaas-subscription/index.ts` — linhas 53–59 com validação
- **Status:** ✅ Resolvido

---

### C3 · Biometria falsa — toggle em `localStorage` sem WebAuthn ✅
- **Risco resolvido:** Toggle de biometria usava `localStorage` sem WebAuthn real — usuário acreditava ter proteção biométrica que não existia.
- **Resolução (opção A):** Toggle removido de `Seguranca.tsx`. Substituído por card informativo "Biometria / Face ID — Em breve" com badge visual e texto explicativo sobre WebAuthn. Removidos `useState` de `biometria`, `handleBiometria` e import de `Switch`. WebAuthn real fica para roadmap futuro.
- **Arquivos:** `src/pages/Seguranca.tsx`
- **Status:** ✅ Resolvido (sessão 3)

---

### C4 · `family_group_members` sem índice em `auth_user_id` e `group_id` ✅
- **Risco resolvido:** Full scan em cada verificação de RLS.
- **Resolução:** Migration `20260615000007` — 3 índices criados: `idx_family_group_members_auth_user_id`, `idx_family_group_members_group_id`, `idx_family_group_members_auth_user_group` (composto com `auth_user_id` como líder para cobrir `EXISTS` checks de RLS). Nota: existia `UNIQUE (group_id, auth_user_id)` pré-existente — mantido; o novo composto tem ordem invertida que é mais eficiente para RLS.
- **Status:** ✅ Resolvido (migration 000007 aplicada)

---

### C5 · `subscriptions` sem `UNIQUE` constraint em `user_id` ✅
- **Risco resolvido:** `upsert onConflict="user_id"` falhava silenciosamente sem a constraint.
- **Resolução:** Migration `20260615000007` — `subscriptions_user_id_unique` adicionada. Havia uma `subscriptions_user_id_key` pré-existente; a antiga foi removida via `ALTER TABLE DROP CONSTRAINT` (não `DROP INDEX`) e substituída pela nova nomeada explicitamente.
- **Status:** ✅ Resolvido (migration 000007 aplicada)

---

### C6 · `asaas-webhook`: `externalReference` usado como `user_id` sem validação UUID ✅
- **Risco resolvido:** Injeção de `user_id` arbitrário via payload malformado.
- **Resolução:** `isValidUUID()` adicionada no topo de `asaas-webhook/index.ts` com regex `UUID_RE`. Aplicada em dois pontos: `SUBSCRIPTION_UPDATED` (rejeita com 200 + warning se inválido) e eventos de pagamento (`externalReference` normalizado para `null` se inválido, com fallback para `customerId`).
- **Arquivos:** `supabase/functions/asaas-webhook/index.ts` (linhas 4–9, 120–127, 153–157)
- **Status:** ✅ Resolvido

---

### C7 · Art. 11 LGPD — Cadastro sem consentimento para tratamento de dados de saúde ✅
- **Risco resolvido:** Cadastro criava conta sem consentimento explícito para dados de saúde; link da política estava quebrado (`path: null`).
- **Resolução:**
  1. Checkbox de consentimento adicionado em `Cadastro.tsx` com link para `/politica-de-privacidade` (abre em nova aba). Botão "Criar Conta" bloqueado sem aceite. Feedback visual (borda vermelha) ao tentar submeter sem marcar.
  2. `logConsent()` — após signup bem-sucedido, insere 2 registros em `consent_log` (`privacy_policy` + `health_data`) com versão `1.0` e `user_agent`. Non-blocking (não impede o fluxo se falhar).
  3. Tabela `consent_log` criada na migration `20260616000009` com RLS (SELECT + INSERT por `auth.uid()`, sem UPDATE/DELETE via cliente).
  4. Link corrigido em `Ajustes.tsx`: `path: null` → `"/politica-de-privacidade"`.
- **Arquivos:** `src/pages/Cadastro.tsx`, `src/pages/Ajustes.tsx`, `supabase/migrations/20260616000009_lgpd_consent_log.sql`
- **Status:** ✅ Resolvido

---

### C8 · Art. 18-IV LGPD — `handleDeleteAccount` não deleta dados do usuário ✅
- **Risco resolvido:** "Excluir Conta" só fazia soft-delete e signOut — dados clínicos, arquivos, assinatura e `auth.users` permaneciam intactos.
- **Resolução:** Edge Function `delete-user-account` criada (`supabase/functions/delete-user-account/index.ts`). Sequência: Storage (exam-files, receitas, vaccine_documents, avatars) → Asaas cancel (best-effort) → notifications/ai_usage_logs/email_send_log/subscriptions → family_members+cascade clínico → family_group_members → family_groups (admin) → group_invites → user_roles → `auth.admin.deleteUser()`. `Ajustes.tsx` atualizado para chamar a função via `supabase.functions.invoke()`.
- **Arquivos:** `supabase/functions/delete-user-account/index.ts` (novo), `src/pages/Ajustes.tsx`, `supabase/config.toml`
- **Status:** ✅ Resolvido

---

### C10 · Preços dos planos em 5 locais sem fonte única de verdade ✅
- **Risco resolvido:** R$19,90 / R$191,00 duplicados em código frontend e backend. Threshold `>= 150` no webhook ia quebrar silenciosamente se o preço mudasse.
- **Resolução:**
  - **Frontend:** `src/lib/planConfig.ts` criado com todas as constantes (`PLAN_MONTHLY_VALUE`, `PLAN_ANNUAL_VALUE`, `PLAN_MONTHLY_DISPLAY`, `PLAN_ANNUAL_DISPLAY`, `PLAN_MONTHLY_DISPLAY_PERIOD`, `PLAN_ANNUAL_DISPLAY_PERIOD`, `PLAN_ANNUAL_DISCOUNT_PCT`). Importado em `PaywallModal.tsx`, `MeuPlano.tsx`, `Ajustes.tsx` e `Landing.tsx`.
  - **Backend:** `create-asaas-checkout` lê `PLAN_MONTHLY_PRICE` e `PLAN_ANNUAL_PRICE` de env vars Supabase (fallback hardcoded como segurança). `asaas-webhook` lê `PLAN_ANNUAL_THRESHOLD` (fallback 150).
  - Para mudar preço: atualizar `planConfig.ts` (frontend) + 3 secrets Supabase (backend).
- **Arquivos:** `src/lib/planConfig.ts` (novo), `src/components/PaywallModal.tsx`, `src/pages/MeuPlano.tsx`, `src/pages/Ajustes.tsx`, `src/pages/Landing.tsx`, `supabase/functions/create-asaas-checkout/index.ts`, `supabase/functions/asaas-webhook/index.ts`
- **Secrets necessários:** `PLAN_MONTHLY_PRICE=19.90`, `PLAN_ANNUAL_PRICE=191.00`, `PLAN_ANNUAL_THRESHOLD=150`
- **Status:** ✅ Resolvido (sessão 4)

---

### C11 · `get_admin_clients` RPC sem verificação de role ✅
- **Risco resolvido:** Qualquer usuário autenticado podia obter lista completa de usuários (nome, email, assinatura) via `supabase.rpc("get_admin_clients")`.
- **Resolução:** Migration `20260615000006` — recriada com `RAISE EXCEPTION 'Access denied'` (`ERRCODE = insufficient_privilege`) para não-admins, `SET search_path = public, pg_catalog`, `REVOKE ALL FROM PUBLIC`, `REVOKE ALL FROM anon`. Validado: não-admin recebe 403 com mensagem correta. DROP necessário antes do CREATE por mudança de tipo de retorno (`date` → `text` em `next_billing_date`).
- **Status:** ✅ Resolvido (migration 000006 aplicada e validada)

---

## 🔴 ALTO — Risco operacional ou segurança significativa

### A1 · CORS wildcard (`*`) em todas as Edge Functions ✅
- **Risco resolvido:** Qualquer origem podia fazer chamadas autenticadas às Edge Functions.
- **Resolução:** Criado `supabase/functions/_shared/cors.ts` — SSOT do header CORS. `ALLOWED_ORIGIN` lido de `APP_ORIGIN` env var; `Vary: Origin` adicionado automaticamente quando origin não é `*`; `asaas-webhook` teve CORS removido completamente (server-to-server, sem browser). 8 Edge Functions atualizadas para importar `corsHeaders` do módulo compartilhado. Fallback `"*"` mantido para compatibilidade com previews Lovable quando `APP_ORIGIN` não está configurado.
- **Arquivos:** `supabase/functions/_shared/cors.ts` (novo), 8 Edge Functions atualizadas
- **Secret necessário:** `APP_ORIGIN=https://seu-dominio.com` no Supabase Dashboard
- **Status:** ✅ Resolvido (sessão 4)

---

### A2 · Campo "Senha Atual" decorativo — nunca enviado ao servidor ✅
- **Risco resolvido:** Campo "Senha Atual" em `Seguranca.tsx` era decorativo — valor ignorado, qualquer usuário podia trocar a senha sem confirmar a atual.
- **Resolução:** `handleUpdatePassword` agora (1) busca o email via `supabase.auth.getUser()`, (2) chama `supabase.auth.signInWithPassword({ email, password: senhaAtual })` e rejeita com `toast.error("Senha atual incorreta.")` se falhar, (3) só então chama `updateUser({ password: novaSenha })`. Botão de submit mostra "Verificando..." durante o processo.
- **Arquivos:** `src/pages/Seguranca.tsx`
- **Status:** ✅ Resolvido (sessão 3)

---

### A3 · `AdminRoute` client-side contornável via React DevTools
- **Risco baixo (mitigado):** Exposição da UI do command-center, mas dados protegidos por RLS + Edge Functions server-side. Não é vetor de acesso a dados.
- **Fix:** Substituir `useState` por verificação via `useEffect` + redirect imediato, sem expor `children` antes da confirmação.
- **Arquivos:** `src/components/AdminRoute.tsx`
- **Status:** ⬜ Backlog (baixa urgência — backend protege dados)

---

### A4 · Rate limiting zero em `analyze-prescription` e `analyze-exam` ✅
- **Risco resolvido:** Usuário malicioso podia gerar custos ilimitados de IA. `useAiStatus` fail-open retornava `true` em caso de erro de query.
- **Resolução:** Criado `supabase/functions/_shared/rate-limit.ts` com `checkAiRateLimit()` e `logAiUsage()`. Padrão fail-closed: se a query de contagem falhar, bloqueia a chamada (ao invés de deixar passar). Limite configurável via secret `AI_CALLS_PER_HOUR` (default: 10/hora por usuário por feature). `analyze-prescription` e `analyze-exam` verificam o limite antes de chamar a IA e registram o uso após resposta bem-sucedida. `useAiStatus.ts` corrigido: `return true` → `return false` em caso de erro.
- **Arquivos:** `supabase/functions/_shared/rate-limit.ts` (novo), `supabase/functions/analyze-prescription/index.ts`, `supabase/functions/analyze-exam/index.ts`, `src/hooks/useAiStatus.ts`
- **Secret necessário:** `AI_CALLS_PER_HOUR=10` (opcional — default já configurado)
- **Status:** ✅ Resolvido (sessão 4)

---

### A5 · TypeScript strict mode — Fase 2 ✅
- **Fase 1 concluída (sessão anterior):** `strictNullChecks: true` + 9 `as any` removidos + type augmentation jspdf-autotable.
- **Fase 2 concluída (sessão 10):** `noImplicitAny: true` habilitado em `tsconfig.json` e `tsconfig.app.json`. Todos os 93 `as any` eliminados (0 restantes):
  - 22 `.from("X" as any)` → sed bulk removal (todas as tabelas já existiam em `types.ts`)
  - `FamilyMember` type augmentado: `weight`, `height`, `physical_activity`, `deleted_at`, `group_id`
  - Casts de propriedades inexistentes: `(editingMedication as any).reason/frequency_type`, `(m as any).reason`, `(r as any).recurrence/status/time_performed` → tipos diretos
  - `(location.state as any)?.from` → `(location.state as { from?: string })?.from`
  - `delete (cached as any).prop` → `delete (cached as Record<string, unknown>).prop`
  - `(grp as any)?.name`, `(newGroup as any).id`, `(newMember as any).id` → remoção de casts (tipos inferidos pelo Supabase)
  - `...(groupId ? { group_id: groupId } : {}) as any` → `group_id: groupId ?? undefined` (18 ocorrências)
  - `{ role: newRole } as any`, `{ managed_profiles } as any`, `{ tracks_menstrual_cycle } as any` → remoção de casts
  - `(data as any[])` → remoção de casts (tipos Supabase já corretos)
  - `(data?.value as any)?.is_active` → `(data?.value as { is_active?: boolean })?.is_active`
- **Arquivos:** 25+ arquivos modificados
- **Status:** ✅ Resolvido (sessão 10)

---

### A6 · Sem `<ErrorBoundary>` global → white screens silenciosos ✅
- **Fix:** `src/components/ErrorBoundary.tsx` criado (class component com `getDerivedStateFromError` + `componentDidCatch`, errorId para suporte, botões Reload/Home). Wrapping completo em `src/App.tsx`.
- **Arquivos:** `src/components/ErrorBoundary.tsx` (novo), `src/App.tsx`
- **Status:** ✅ Resolvido (sessão 8)

---

### A7 · Cobertura de testes ~0% (apenas 1 smoke test)
- **Fix prioritário:** Hooks críticos (`useUpcomingAppointments`, `calculateNextDose`, `useSubscription`) + fluxos E2E com Playwright (login, cadastro de medicamento, marcação de dose).
- **Status:** ✅ Resolvido parcialmente (sessão 11) — `calculateNextDose.test.ts` com 24 testes unitários cobrindo os 3 `frequency_types` (fixed_interval, specific_times, specific_days) incluindo `vi.useFakeTimers` para branch "start=hoje". E2E Playwright permanece como backlog.

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

### A10 · `subscriptions.asaas_customer_id` sem índice + `user_id` sem índice ✅
- **Risco resolvido:** Full scan na tabela `subscriptions` para webhook fallback e verificações de status de assinatura.
- **Resolução:** Migration `20260615000007` — dois índices parciais: `idx_subscriptions_asaas_customer_id` (`WHERE asaas_customer_id IS NOT NULL`) e `idx_subscriptions_active_user` (`WHERE status = 'active'`).
- **Status:** ✅ Resolvido (migration 000007 aplicada)

---

### A11 · Tabelas clínicas sem índice em `family_member_id` e `user_id` ✅
- **Risco resolvido:** Full scan em listagens clínicas — afetava 100% das queries de perfil familiar.
- **Resolução:** Migration `20260615000008` — índices em `family_member_id` e `user_id` para todas as 9 tabelas. Índices compostos com ordenação temporal (`DESC`) para `consultations`, `exams`, `health_measurements`, `blood_pressure_history`, `menstrual_cycles`.
- **Status:** ✅ Resolvido (migration 000008 aplicada)

---

### A12 · `medication_doses` sem TTL/particionamento
- **Risco:** ~5M rows/ano com 1k usuários. Queries de aderência degradam progressivamente.
- **Fix:** Criar pg_cron job que deleta doses com `scheduled_for < now() - interval '2 years'` + avaliar particionamento por `scheduled_for`.
- **Status:** ⬜ Backlog

---

### A13 · `pdfjs-dist` (~900KB) + `jspdf` (~250KB) importados estaticamente ✅
- **Risco resolvido:** ~1.15MB removidos do bundle inicial.
- **Fix:** `dynamic import()` aplicado em `Vacinas.tsx` (parseSusVaccinePdf), `Prontuario.tsx` (generateProntuarioPdf), `AdherenceHistoryDrawer.tsx` (generateAdherencePdf). Libs carregadas apenas quando o usuário clica em exportar.
- **Status:** ✅ Resolvido (sessão 8)

---

### A14 · Art. 7 LGPD — Política de privacidade não implementada ✅
- **Risco resolvido:** Sem política de privacidade acessível aos titulares antes do aceite.
- **Resolução:** Página `src/pages/PoliticaPrivacidade.tsx` criada com 10 seções (controlador, dados coletados, finalidade + base legal LGPD Art. 7/11, compartilhamento, retenção, direitos Art. 18, segurança, incidentes Art. 48, DPO, alterações). Rota `/politica-de-privacidade` adicionada em `App.tsx` fora do `AppLayout` (pública, sem autenticação). Acessível a partir do link no cadastro e de Ajustes.
- **Arquivos:** `src/pages/PoliticaPrivacidade.tsx` (novo), `src/App.tsx`
- **Status:** ✅ Resolvido

---

### A15 · Art. 18-V LGPD — Sem portabilidade de dados ✅
- **Risco resolvido:** Sem mecanismo de exportação de dados — titular não podia exercer direito de portabilidade.
- **Resolução:** Botão "Exportar Meus Dados" adicionado em `Ajustes.tsx`. Ao clicar: busca todos os dados clínicos do grupo familiar (medications, consultations, exams, vaccines, allergies, diseases, health_measurements, blood_pressure_history, menstrual_cycles, pet_routines) + histórico de consentimento, monta JSON estruturado com metadados LGPD (controlador, base legal, data de export) e dispara download do arquivo `locus-vita-dados-YYYY-MM-DD.json`. Estado de loading durante a busca.
- **Arquivos:** `src/pages/Ajustes.tsx`
- **Status:** ✅ Resolvido (sessão 3)

---

### A16 · Art. 48 LGPD — Sem mecanismo de detecção ou notificação de incidentes
- **Fix:** Integrar Sentry (cobre parcialmente) + criar runbook de resposta a incidentes + definir processo de notificação à ANPD.
- **Status:** ⬜ Backlog

---

### A17 · `patientAge` injetado no system prompt da IA sem sanitização ✅
- **Fix:** Validação em `analyze-prescription/index.ts`: tipo `number`, inteiro, ≥ 0, ≤ 130. Qualquer outro valor → `null` (contexto pediátrico desabilitado). Fecha vetor de prompt injection via campo numérico.
- **Status:** ✅ Resolvido (sessão 8)

---

### A18 · `pdfjs-dist` pinado sem `^` — nunca recebe patches de segurança
- **Fix:** Remover pin fixo, atualizar para `^5.x` no `package.json`.
- **Arquivos:** `package.json` (linha 59)
- **Status:** ⬜ Backlog

---

## 🟡 MÉDIO — Degradação com crescimento ou manutenibilidade

### M1 · Sem APM/Sentry
- **Fix:** Instrumentar `@sentry/react` + `@sentry/node` nas Edge Functions. Adicionar ao `<ErrorBoundary>`.
- **Status:** ✅ Resolvido (sessão 11) — `@sentry/react@^8.54.0` adicionado ao `package.json`; `src/lib/sentry.ts` com `initSentry()` (no-op se `VITE_SENTRY_DSN` não configurado) e `captureException()`; `main.tsx` inicializa Sentry antes do render; `ErrorBoundary.tsx` usa `captureException`. **Ação pendente do Fábio:** criar projeto em sentry.io e adicionar DSN em `.env` → `VITE_SENTRY_DSN=https://...`; depois rodar `npm install`.

---

### M2 · Sem CI/CD no repositório
- **Fix:** GitHub Actions com: `lint` → `typecheck` → `vitest` → `supabase db test`.
- **Status:** ✅ Resolvido (sessão 11) — `.github/workflows/ci.yml` criado: Node 20 + npm ci + lint + `tsc --noEmit` + `npm test`. Disparado em push/PR para `main`. `supabase db test` fica para quando houver SQL tests.

---

### M3 · `Home.tsx` (826 LOC) e `Vacinas.tsx` (801 LOC) monolíticos
- **Fix:** Extrair sub-componentes e hooks por responsabilidade.
- **Status:** ⬜ Backlog

---

### M4 · Edge Functions sem `import_map.json` — versões inconsistentes
- **Risco:** `std@0.168.0` em 2 funções, `supabase-js@2` (sem versão) em 2, `supabase-js@2.49.1` em 4.
- **Fix:** Criar `supabase/functions/import_map.json` centralizando todas as dependências Deno.
- **Status:** ✅ Resolvido (sessão 11) — `import_map.json` com `std@0.224.0`, `@supabase/supabase-js@2.49.4`, `zod@3.25.76`; `config.toml` atualizado com `[functions] import_map`; todos os 9 `index.ts` usando bare specifiers.

---

### M5 · `useSubscription` — 4 queries sequenciais (2 poderiam ser paralelas) ✅
- **Fix:** `Promise.all([ownSub, membership])` — Q1 e Q2 agora executam em paralelo. Reduz latência de subscrição em ~50% para usuários em trial ou billing familiar.
- **Arquivos:** `src/hooks/useSubscription.ts`
- **Status:** ✅ Resolvido (sessão 9)

---

### M6 · `useStockAlerts` e `useMenstrualAlerts` — N×2 queries sequenciais ✅
- **Fix:** Loop N×(SELECT + INSERT) → 1 SELECT batch com `.in()` + 1 INSERT batch com array. Para 5 meds em estoque baixo: de 10 queries para 2.
- **Arquivos:** `src/hooks/useStockAlerts.ts`, `src/hooks/useMenstrualAlerts.ts`
- **Status:** ✅ Resolvido (sessão 9)

---

### M7 · Componentes sem `React.memo` ✅
- **Fix:** `memo()` adicionado em `NotificationCard`, `MemberAvatar`, `ClinicalTimeline`, `BottomNav`. `useCallback` aplicado em `handlePrefetch`, `getFilteredMembers` e `handleClick` do BottomNav. Lógica duplicada de filtro no drawer unificada em `getFilteredMembers()`.
- **Status:** ✅ Resolvido (sessão 9)

---

### M8 · `manage-admins` sem audit log de acesso
- **Fix:** Inserir registro em tabela `admin_audit_log` a cada ação (promote, revoke, list).
- **Status:** ⬜ Backlog

---

### M9 · Logs não estruturados nas Edge Functions
- **Fix:** Substituir `console.log(string)` por `console.log(JSON.stringify({ level, event, userId, ... }))`.
- **Status:** ✅ Resolvido (sessão 11) — `_shared/logger.ts` criado com `log(level, event, data?)`; todos os 66 `console.*` bare de 9 funções + `_shared/rate-limit.ts` convertidos para `log("info"|"warn"|"error", "snake_case_event", {...})`. Zero `console.*` restantes fora do logger.

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

### M14 · Art. 18-IX LGPD — Sem revogação de consentimento ✅
- **Risco resolvido:** Sem mecanismo formal de revogação de consentimento — titular não podia exercer direito do Art. 18-IX.
- **Resolução:**
  1. Migration `20260616000010` — altera constraint `consent_log_consent_type_check` para incluir `'revoked'`; adiciona índice composto `idx_consent_log_user_type (user_id, consent_type, granted_at DESC)` para consultas eficientes.
  2. Botão "Revogar Consentimento" adicionado em `Ajustes.tsx` com badge âmbar e `AlertDialog` de confirmação com aviso claro: revogação registra a solicitação mas não apaga dados (para remoção usar "Excluir Conta"). `handleRevokeConsent` insere registro `consent_type = 'revoked'` em `consent_log` — a tabela é imutável por RLS, mantendo histórico completo.
- **Arquivos:** `src/pages/Ajustes.tsx`, `supabase/migrations/20260616000010_lgpd_consent_log_revoke.sql`
- **Status:** ✅ Resolvido (sessão 3) — ⚠️ migration 000010 precisa ser aplicada via SQL Editor

---

### M15 · Índices parciais ausentes ✅
- **Risco resolvido:** Queries frequentes (medicamentos ativos, notificações não lidas, emails pendentes) executavam full scan.
- **Resolução:** Migration `20260615000008` — 4 índices parciais: `idx_medications_active` (`WHERE status = 'Ativo'`), `idx_consultations_active` e `idx_exams_active` (WHERE excluindo cancelados), `idx_notifications_unread` (`WHERE is_read = false`), `idx_email_send_log_pending` (`WHERE status = 'pending'`). Parcial de `subscriptions` resolvido em migration 000007.
- **Status:** ✅ Resolvido (migration 000008 aplicada)

---

### M16 · `blood_pressure_history.familiar_id` e `menstrual_cycles.familiar_id` sem FK constraint ✅
- **Risco resolvido:** Dados orfãos podiam persistir após soft-delete de `family_members`, quebrando joins e vazando dados.
- **Resolução:** Migration `20260615000008` — FKs adicionadas com `ON DELETE CASCADE`: `fk_blood_pressure_history_family_member` e `fk_menstrual_cycles_family_member`. Alinha com o padrão de cascade do trigger `cascade_soft_delete_family_member`.
- **Status:** ✅ Resolvido (migration 000008 aplicada)

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

### B3 · Helper de timezone espalhado ✅
- **Fix:** `src/lib/tz.ts` criado com `TZ_SAO_PAULO`, `parseDate`, `toSaoPaulo`, `formatDate`, `formatDateTime`, `formatTime`, `formatDateTimeSeconds`, `formatISOSaoPaulo`, `todaySaoPaulo`, `nowSaoPaulo`. SSOT para todas as operações de data no frontend.
- **Status:** ✅ Resolvido (sessão 8)

---

### B4 · `QueryClient` sem `defaultOptions` de erro global
- **Fix:** Adicionar `defaultOptions: { queries: { onError: (e) => Sentry.captureException(e) } }` no `queryClient` de `App.tsx`.
- **Status:** ⬜ Backlog

---

### B5 · Login, Cadastro, ResetPassword sem `lazy()` — Suspense inútil ✅
- **Fix:** Todos os 27 imports de páginas convertidos para `lazy()` em `src/App.tsx`. Funções de import extraídas para permitir prefetch via `prefetchByRoute` e `prefetchCriticalChunks`. `<Suspense>` adicionado nas 4 rotas que faltavam (Landing, Home, AdminLogin, NotFound).
- **Status:** ✅ Resolvido (sessão 8)

---

### B6 · `vite` v5.x com histórico de CVEs de path traversal
- **Fix:** Migrar para Vite 6.x (breaking changes documentados).
- **Status:** ⬜ Backlog

---

### B7 · `changelogs` e `group_invites` sem índices nas colunas de filtro ✅
- **Risco resolvido:** Ordenação e busca por email de convite sem índice.
- **Resolução:** Migration `20260615000008` — `idx_changelogs_created_at` e `idx_changelogs_release_date` (DESC); `idx_group_invites_group_id`, `idx_group_invites_email` e `idx_group_invites_email_group` (composto para aceitar convite por email + grupo). Também adicionado `idx_ai_usage_logs_user_id` para future rate limiting.
- **Status:** ✅ Resolvido (migration 000008 aplicada)

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

## Itens Resolvidos (junho/2026)

### Sessão 1

| Item | Resolução |
|------|-----------|
| Buckets públicos (LGPD) | ✅ Migrations 000004 e 000005 — storage policies com `TO authenticated` + folder scoping |
| HIBP (Leaked Password) | ✅ Habilitado em Auth Settings |
| 16 findings do scanner Lovable | ✅ 0 erros, 23 warnings by-design |
| TypeScript Fase 1 (`strictNullChecks`) | ✅ Habilitado + 9 `as any` removidos + type augmentation jspdf-autotable |
| Bug ∞ — Dipirona Bug (Fase 401) | ✅ `useUpcomingAppointments` refatorado para consumir `calculateNextDose.ts`; fix de skip de horários passados no dia de início |
| Bug ∞ — Fase 401 (sessão 12) | ✅ 3 causas raiz corrigidas: (1) `homeDoseStatuses` sem filtro de data → truncamento de 1000 linhas → mapa incompleto; (2) `useMedicationAlarms` catch-up ignorava `specific_times`/`specific_days`; (3) `MedicationDoseActions` auto-conclusão só para `fixed_interval` |

### Sessão 2

| Item | ID | Migration / Arquivo | Resolução |
|------|----|---------------------|-----------|
| C11 — `get_admin_clients` sem role check | C11 | `000006` | `RAISE EXCEPTION` para não-admins + `SET search_path` + `REVOKE FROM PUBLIC` |
| Indexes `family_group_members` | C4 | `000007` | 3 índices: `auth_user_id`, `group_id`, composto |
| UNIQUE constraint em `subscriptions.user_id` | C5 | `000007` | `ALTER TABLE ADD CONSTRAINT subscriptions_user_id_unique` |
| Indexes `subscriptions` para webhook | A10 | `000007` | Parciais: `asaas_customer_id IS NOT NULL`, `status = 'active'` |
| Indexes tabelas clínicas | A11 | `000008` | `family_member_id` + `user_id` em 9 tabelas |
| Índices parciais | M15 | `000008` | 5 parciais: medicamentos ativos, consultas/exames ativos, notificações não lidas, emails pendentes |
| FK constraints `blood_pressure` + `menstrual_cycles` | M16 | `000008` | `ON DELETE CASCADE` para `family_members(id)` |
| Indexes `changelogs` e `group_invites` | B7 | `000008` | Ordenação + busca por email de convite |
| UUID validation em `asaas-webhook` | C6 | `asaas-webhook/index.ts` | `isValidUUID()` antes de qualquer upsert com `externalReference` |
| Asaas URLs hardcoded | C2 + C9 | 3 Edge Functions | `ASAAS_API_URL` env var em `create-asaas-checkout`, `asaas-webhook`, `cancel-asaas-subscription` |
| `.env` no repositório | C1 | `.gitignore` | Histórico auditado — apenas chaves públicas; arquivo não rastreado |

---

## Roadmap Sugerido de Execução

```
Sprint 1 — Segurança e integridade de dados ✅ CONCLUÍDO
├── ✅ C4 + C5 + A10                       → Migration 000007 (indexes + UNIQUE subscriptions)
├── ✅ A11 + M15–M16 + B7                  → Migration 000008 (índices clínicos + FKs + parciais)
├── ✅ C2 + C9                             → Asaas: ASAAS_API_URL como env var nas 3 funções
├── ✅ C6                                  → asaas-webhook: validação UUID externalReference
├── ✅ C1                                  → .gitignore + histórico git auditado
└── ✅ C11                                 → get_admin_clients: role check + search_path + REVOKE

Sprint 2 — Compliance LGPD (bloqueador legal para go-live) ✅ CONCLUÍDO
├── ✅ C8                                  → Edge Function delete-user-account (Art. 18-IV)
├── ✅ C7 + A14                            → Consentimento no cadastro + Política de privacidade
├── ✅ A15                                 → Export de dados JSON (portabilidade Art. 18-V)
├── ✅ M14                                 → Revogação de consentimento (Art. 18-IX) ⚠️ migration pendente
└── ✅ C3 + A2                             → Biometria falsa removida + Senha atual validada

Sprint 3 — Go-live readiness ✅ CONCLUÍDO
├── ✅ A1                                 → CORS: `_shared/cors.ts` + `APP_ORIGIN` env var
├── ✅ A4                                 → Rate limiting IA: `_shared/rate-limit.ts` + fail-closed
└── ✅ C10                                → Preços: `planConfig.ts` + secrets `PLAN_MONTHLY_PRICE/ANNUAL_PRICE/ANNUAL_THRESHOLD`

Sprint 4 — Qualidade e performance ✅ CONCLUÍDO
├── ✅ A5 (Fase 2 TypeScript)             → noImplicitAny: true + 93→0 `as any` eliminados
├── ✅ A6                                 → <ErrorBoundary> global em App.tsx
├── ✅ A13 + B5                           → Dynamic imports PDF + lazy routes em App.tsx
├── ✅ M5 + M6 + M7                       → Otimizações de queries e re-renders
└── ✅ A7 (parcial)                       → 24 testes unitários calculateNextDose (E2E Playwright: backlog)

Sprint 5 — Observabilidade e manutenibilidade ✅ CONCLUÍDO
├── ✅ M4 + B1                            → import_map.json + Deno std@0.224 + supabase-js@2.49.4
├── ✅ M9                                 → _shared/logger.ts + 66 console.* → log() JSON estruturado
├── ✅ M2                                 → .github/workflows/ci.yml (lint + typecheck + vitest)
├── ✅ A7 (parcial)                       → calculateNextDose.test.ts (24 testes, 3 frequency_types)
└── ✅ M1                                 → @sentry/react + src/lib/sentry.ts (⚠️ DSN pendente do Fábio)

Sprint 6 — Bug ∞ Dipirona (Fase 401) + OCR Receitas ✅ CONCLUÍDO
├── ✅ homeDoseStatuses date filter       → .gte("scheduled_for", -7d) em Home.tsx + Medicamentos.tsx
├── ✅ useMedicationAlarms catch-up       → loop calculateNextDose para specific_times/specific_days
├── ✅ MedicationDoseActions auto-conclusão → suporta os 3 frequency_types; props startDateISO, frequencyType, specificTimes, specificDays adicionados
├── ✅ Fix analyze-prescription CORS      → APP_ORIGIN corrigido: `https://vita.locustech.com.br` (sem /login)
└── ✅ 6 erros TS residuais              → time_performed, effectiveFreqType, startDateISO (Lovable auto-fix)
```

---

*Documento gerado automaticamente pelo Claude (Cowork). Atualizar após cada sprint ou mudança arquitetural significativa.*
