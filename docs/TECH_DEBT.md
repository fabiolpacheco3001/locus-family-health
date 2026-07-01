# Locus Vita — Backlog de Dívida Técnica

> **Versão:** 8.3 | **Atualizado em:** 2026-07-01 (sessão 69 — rotação VAPID par 3, BadJwtToken diagnosticado via Sentry, notificações revalidadas)  
> **Fonte:** SSOT original + Análise Devin AI (8 prompts) + sessões de segurança junho/2026  
> **Mantenedor:** Claude (Cowork)

---

## 📋 Resumo das Sessões

| Sessão | Itens resolvidos | Status Sprint |
|--------|-----------------|---------------|
| Sessão 69 | **BK-01 push — rotação VAPID par 3 (BadJwtToken) ✅**: Sentry LOCUS-VITA-Z confirmou `statusCode=403 body={"reason":"BadJwtToken"}` aparecendo ~9 min após Fábio atualizar apenas `VAPID_PUBLIC_KEY` no Supabase Secrets. Root cause: Fábio havia gerado **dois pares distintos** durante o incidente 2026-06-21. Par 1 (`BNQueAzo...`) = public key em `pushConfig.ts` original. Par 2 = novo par gerado mas apenas VAPID_PRIVATE_KEY atualizado nos Secrets. Ao rotacionar sessão 68, `VAPID_PUBLIC_KEY` foi substituída pelo par 1, mas `VAPID_PRIVATE_KEY` permaneceu do par 2 → JWT assinado com private do par 2 + public do par 1 = chave inválida → APNs `BadJwtToken`. Fix: (1) par 3 gerado via `npx web-push generate-vapid-keys` (ferramenta correta — não Node.js WebCrypto); (2) AMBAS `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` atualizadas nos Supabase Secrets com par 3; (3) `src/lib/pushConfig.ts` atualizado com public key do par 3 (`BPiseS4YA78...`); (4) subscriptions `is_active=false` limpas do DB; (5) usuários re-subscreveram ao reabrir o app. **E2E revalidado por Fábio ✅** JSDoc de `pushConfig.ts` atualizado para recomendar `npx web-push generate-vapid-keys` e alertar sobre mismatch. Docs: BACKLOG.md v2.6, INFRASTRUCTURE.md v1.2. | Push ✅ ROTAÇÃO VAPID PAR 3 CONCLUÍDA |
| Sessão 68 | **retry-renewal-failures ✅ — Auth mismatch corrigido (commit `0107061f`, Lovable MCP)**: A função comparava o bearer token recebido do pg_cron com `SUPABASE_SERVICE_ROLE_KEY` (env var), mas o cron enviava `email_queue_service_role_key` extraído do vault — secret diferente → 401 sempre. Fix: auth migrado para padrão `CRON_SECRET` (consistente com os jobs 15/16); `verify_jwt = false` adicionado ao `config.toml`; job 9 atualizado via migration `20260701045818` para enviar `Bearer {CRON_SECRET}`. `cron_job_log` confirmou que a função nunca chegava a logar (morria no auth check). **manage-google-identity ✅ — NOT A BUG (90% = 422 esperado)**: Sentry: 0 erros em 24h. As 9 "falhas" eram respostas 422 legítimas do guard "não é possível remover o único método de login" — usuários com apenas Google sem senha. 1 sucesso = Fábio (tinha Google + email). Nenhuma mudança de código necessária. **webauthn-challenge ✅ — NOT A BUG (71.4% = 404 esperado)**: Falhas são 404 quando `passkeys` está vazio para o tipo `authentication` — usuário sem passkey registrado tenta autenticar. Comportamento esperado e documentado. Nenhuma mudança de código necessária. **BK-01 push ✅ — subscription confirmada no banco**: `push_subscriptions` consultada via Lovable MCP → row do Fábio presente (`is_active: true`, endpoint APNs, `updated_at: 2026-06-28`). Backend (`send-medication-reminders`) confirmado em 100% de sucesso. Causa mais provável de não receber: medicamentos fora da janela ±3 min durante os testes, ou app não instalado na Home Screen do iOS. Fix `usePushSubscription.ts` (commit `5f4b6a9`) ainda LOCAL — Fábio deve rodar `git push origin main` da máquina local. | Edge Functions + Push ✅ DIAGNÓSTICO CONCLUÍDO |
| Sessão 67 | **LOCUS-VITA-V ✅ — Desvincular Google (commit `f96d5658`, Lovable MCP)**: `manage-google-identity` edge function com action `unlink` usando `adminClient.auth.admin` + `admin_delete_identity(UUID, TEXT)` (Deno PostgreSQL direto ao GoTrue DB). Root cause: GoTrue SDK `unlinkIdentity` requer `manual_linking_enabled=true` (indisponível no Lovable Cloud). Workaround: `SELECT auth.admin_delete_identity(identity_id::uuid, provider)` executado via `Deno.env.get("SUPABASE_DB_URL")`. `useAuth.tsx` atualizado: `unlinkIdentityAdmin({ id, provider })` → invoca a edge function + parse do error body via `context.clone().json()`. Sentry marcado como resolvido. **SEC ✅ — `surgery_instructions` created_by + RLS completo (commit `5d56aef7`, Lovable MCP)**: Migration adicionou coluna `created_by UUID REFERENCES auth.users(id)` + trigger `set_surgery_instructions_created_by()` que preenche automaticamente no INSERT. Policies UPDATE/DELETE corrigidas: de `surgery_id IN (SELECT id FROM surgeries WHERE user_id = auth.uid())` para `created_by = (select auth.uid())` — cada instrução agora só pode ser modificada por quem a criou. **BK-01 push fix ✅ — diagnóstico regressão + fix `usePushSubscription` (commit `5f4b6a9`, LOCAL)**: Diagnóstico completo: backend funcional (confirmado `{"processed":2,"sent":2}` às 20:00 BRT 2026-06-30); dois bugs latentes encontrados: (1) `syncSubscriptionToDb` não incluía `is_active:true` — subscription marcada como inativa (após 410 APNs) nunca era reativada no próximo sync; (2) `useEffect([])` só roda no mount — após `signOut` (que deleta a row do banco) + OAuth re-login, subscription só voltava ao DB se usuário visitasse `/notificacoes`. Fix: `is_active:true` explícito no upsert + novo `useEffect([user, syncSubscriptionToDb])` que re-sincroniza ao detectar mudança de identidade. | Segurança + BK-01 ✅ CONCLUÍDO |
| Sessão 1 | C1, C2+C9, C4, C5, C6, C11, A10, A11, M15, M16, B7 (11 itens) | Sprint 1 ✅ CONCLUÍDO |
| Sessão 2 | C8, C7+A14 — LGPD consentimento + deleção de conta | Sprint 2 ✅ CONCLUÍDO |
| Sessão 3 | C3, A2, M14, A15 — Biometria, Senha, Revogação, Portabilidade | Sprint 2 ✅ CONCLUÍDO |
| Sessão 4 | A1, A4, C10 — CORS restrito, Rate limiting IA, Preços centralizados | Sprint 3 ✅ CONCLUÍDO |
| Sessão 5 | Fix 4 Lovable warnings (erros Asaas, ownership clínico, ai_usage_logs, check_group_access) + UX admin + badge fix | Segurança ✅ CONCLUÍDO |
| Sessão 6 | P0 cancel-asaas-subscription body bypass; P1 decrement_stock ownership + error sanitization (5 funções); migration 000017 ownership completo; lib/tz.ts; restructure deploy doc | Segurança ✅ CONCLUÍDO |
| Sessão 7 | Migration 000018: blood_pressure_history + menstrual_cycles INSERT policies com familiar_id ownership (RAIO X 3.0 findings #1/#2) | Segurança ✅ CONCLUÍDO |
| Sessão 8 | A6 ErrorBoundary global, A13 dynamic PDF imports, A17 patientAge sanitização, B3 tz.ts, B5 lazy routes (27 páginas) — Sprint 4 início | Sprint 4 ✅ CONCLUÍDO |
| Sessão 9 | M5 Promise.all em useSubscription, M6 batch dedup+insert em Stock/Menstrual alerts, M7 React.memo em 4 componentes + useCallback BottomNav | Sprint 4 ✅ CONCLUÍDO |
| Sessão 10 | A5 Fase 2 completa: `noImplicitAny: true` habilitado, 93→0 `as any` eliminados — FamilyMember type augmentado, 22 `.from() as any` via sed, 71 casts explícitos resolvidos por categoria | Sprint 4 ✅ CONCLUÍDO |
| Sessão 11 | Sprint 5: M4+B1 import_map.json Deno (std@0.224, supabase-js@2.49.4); M9 logs JSON estruturados (shared logger.ts, 9 Edge Functions, 66→0 console.* não estruturados); M2 CI/CD GitHub Actions (lint+typecheck+test); A7 testes unitários calculateNextDose (3 describe, 24 it, fake timers); M1 Sentry integração preparada (@sentry/react, lib/sentry.ts, initSentry em main.tsx, captureException em ErrorBoundary) | Sprint 5 ✅ CONCLUÍDO |
| Sessão 12 | Sprint 6: Bug ∞ Dipirona (Fase 401) — homeDoseStatuses date filter (.gte -7d), useMedicationAlarms catch-up (loop calculateNextDose para specific_times/specific_days), MedicationDoseActions auto-conclusão (3 frequency_types, 4 novas props); Fix analyze-prescription "Failed to send" — APP_ORIGIN secret corrigido para `https://vita.locustech.com.br` (sem path); Lovable corrigiu 6 erros TS residuais em Home.tsx, Medicamentos.tsx, Ajustes.tsx, EditPetRoutineDrawer.tsx | Sprint 6 ✅ CONCLUÍDO |
| Sessão 13 | M1 Sentry: DSN configurado (`VITE_SENTRY_DSN`) no Lovable env var + produção testada e validada (primeiro issue capturado em vita.locustech.com.br, Chrome Mobile/Android); buckets `exam-files` e `receitas` confirmados Private no Supabase Storage; M12 encerrado (coberto por A15) | Sprint 7 ✅ CONCLUÍDO |
| Sessão 14 | Sprint 7: A3 ✅ AdminRoute authorizedRef; A8 ✅ manage-admins limite 100 IDs; A9 ✅ publish-changelog paginação; A12+M11 ✅ pg_cron TTL 4 jobs; B4 ✅ QueryCache captureException; B8 ✅ Project ID via env var; M10 ✅ polling backoff Asaas; M17 ✅ AI model/gateway env vars; M18 ✅ queue_name semântico; A18 ✅ pdfjs-dist ^; B2 ✅ Toaster Radix removido; M19 ✅ loading lazy + dimensões; M8 ✅ admin_audit_log; M13 ✅ recipient_email hash+TTL 24h | Sprint 7 ✅ CONCLUÍDO |
| Sessão 15 | CI desbloqueado: package-lock.json regenerado (13 pkgs ausentes); Node.js 20→22 no ci.yml; eslint.config.js corrigido (no-explicit-any, no-empty-object-type, no-require-imports como warn); lint corrigido em parseSusVaccinePdf.ts (useless-escape + prefer-const), Home.tsx (Infinity→InfinityIcon), Medicamentos.tsx (prefer-const), useAuth.tsx (no-empty). CI #18 ✅ VERDE pela primeira vez | Sprint 8 ✅ CONCLUÍDO |
| Sessão 16 | B6 ✅ Vite 5→6: `package.json` `"vite": "^6.0.0"`; fix `calculateNextDose` (refSP em vez de new Date() — teste determinístico). A16 ✅ Runbook LGPD Art. 48: `docs/runbook-lgpd-art48.md` (P0/P1/P2, prazo ANPD 3 dias úteis, templates, evidências). Auditoria TECH_DEBT.md v4.2→4.3 | Sprint 8 ✅ CONCLUÍDO |
| Sessão 17 | M3 ✅ Refatoração Home.tsx (849→138 LOC) + Vacinas.tsx (802→478 LOC): useHomeData, 5 sub-componentes home/, useVaccineImport, VaccineFormDrawer. TECH_DEBT.md v4.5 | Sprint 8 ✅ CONCLUÍDO |
| Sessão 18 | B9 ✅ completo: B9-A (react-router-dom v7, vaul v1.1.2, pdfjs-dist v5), B9-B (React 18→19), B9-C (Tailwind v3→v4: @tailwindcss/vite, @import "tailwindcss", 63× outline-hidden, 51× shadow-xs). .npmrc legacy-peer-deps=true para npm ci. Pós-deploy: bun.lockb desatualizado removido do git (Lovable regenerou com @tailwindcss/vite); sonner.tsx forçado para theme=light (next-themes "system" causava toast preto no iOS em dark mode). Build Lovable exit code 0 ✅. TECH_DEBT.md v5.1 | Sprint 8 ✅ CONCLUÍDO |
| Sessão 19 | BK-04 ✅ WebAuthn passkeys: registro + autenticação FIDO2 full-flow validados em produção (iOS 18.7 PWA). BK-06 ✅ Signed URLs 15 min: `storage.ts` refatorado (TTL 600→900s, `getSignedUrl` genérico, `PRESCRIPTIONS_BUCKET` constante, bucket param nas funções); hook `useSignedUrl.ts` com React Query (staleTime = TTL − 60s, auto-renova antes de expirar). Todos os pontos de acesso a `exam-files` e `receitas` já usavam signed URLs — nenhum `getPublicUrl` em arquivos clínicos. S3-02 ✅ prefers-reduced-motion no OverviewCarousel. S3-05 ✅ OCR retry UI. | Sprint 10+11 ✅ CONCLUÍDO |
| Sessão 20 | BK-04 fix ✅ Revert para discoverable credentials: `webauthn-challenge` revertido para `allowCredentials:[]`; `webauthn.ts` revertido para publicKey minimal (sem serverAllowCreds, sem rpId). Tentativa de specific-IDs causava picker QR cross-device no iOS PWA. Fix crítico ✅ `usePasskeys` cache bleed entre usuários: `queryKey` atualizado para `["passkeys", user?.id]`; filtro `.eq("user_id", user.id)` adicionado (defence-in-depth além da RLS); `enabled: !!user?.id`. Impede que usuário sem passkey veja lock screen por causa de cache do usuário anterior no mesmo dispositivo. | Manutenção BK-04 ✅ CONCLUÍDO |
| Sessão 35 | BK-01 ✅ Web Push VAPID end-to-end: `public/sw.js` (push + notificationclick + pushsubscriptionchange), `src/lib/pushConfig.ts`, `src/hooks/usePushSubscription.ts` (PushManager.subscribe + upsert push_subscriptions), `src/pages/Notificacoes.tsx` (opt-in card). Edge Functions: `send-push-notification` (npm:web-push@3.6.7, auto-deactivates 410/404), `send-medication-reminders` (±3min window, 3 frequency_types, BRT), `send-appointment-reminders` (D-0 e D-1, 8h BRT). Migration `20260621120000_push_notifications.sql`: tabela, RLS, índices, TTL pg_cron dominical. pg_cron jobs ativos com `timeout_milliseconds:=30000`. **Incidente de segurança:** `VAPID_PRIVATE_KEY` exposta em comentário JSDoc no GitHub → chaves rotacionadas via force push, Supabase Secrets atualizados. JSDoc reescrito com placeholder. Smoke test final: `net._http_response` ID 20 → `200 {"processed":0}` ✅. | Sprint 35 ✅ CONCLUÍDO |
| Sessão 36 | BK-01 E2E fix ✅: diagnóstico completo do push não chegar no iPhone. Root cause: par VAPID inconsistente — `VAPID_PRIVATE_KEY` no Supabase Secrets não correspondia à public key em `pushConfig.ts` (geradas em momentos distintos durante a rotação da sessão 35). Evidência: campo `push_details` adicionado ao response de `send-medication-reminders` revelou `{sent:0,failed:1}` (APNs rejeitando) → `{sent:1,failed:0}` após fix. Fix: par VAPID P-256 regenerado via Node.js WebCrypto (`subtle.generateKey` + JWK export), ambas as chaves atualizadas no Supabase Secrets, `pushConfig.ts` atualizado, usuário re-subscreveu. **Validação E2E:** notificação "💊 Hora do Remédio!" recebida no iPhone com PWA completamente fechado ✅. Bug fix colateral: `send-medication-reminders` contava `sent` por `res.ok` (HTTP 200), não pelo resultado real do APNs — corrigido com leitura do response body. | Sprint 36 ✅ CONCLUÍDO |
| Sessão 37 | Bug ∞ Dipirona ✅ (Fase 401 — causa raiz real identificada e corrigida): `frequency_type = "interval"` (valor legado no banco de medicamentos criados antes da Fase 398) não era reconhecido por `calculateNextDose` nem por `advancePastTakenDoses` — `"interval"` é truthy, impedia o fallback para `"fixed_interval"`. Dois sintomas: (a) med com `frequency_hours>0` sumia silenciosamente do widget Home; (b) med com `frequency_hours=null` exibia ∞ indevidamente. Fix: normalização `rawType === "interval" ? "fixed_interval" : rawType` em `calculateNextDose.ts`, `advancePastTakenDoses.ts` e `useHomeData.ts`. Testes de regressão: 2 novos `describe` / 7 novos `it` em `calculateNextDose.test.ts`. CI #184 ✅ VERDE (commit 88cbefd). | Sprint 37 ✅ CONCLUÍDO |
| Sessão 38 | Diagnóstico completo do codebase (`docs/DIAGNOSTICO_CODEBASE_2026-06-27.md`) — 20 achados em 5 domínios; 3 críticos corrigidos nesta sessão: **[ID-004/005]** 7 `console.log` com PHI removidos de `parseSusVaccinePdf.ts` (CPF completo, texto PDF inteiro, colunas detectadas, vacinas extraídas) e `useVaccineImport.ts` (CPF em texto plano); comparação CPF preservada — ocorre apenas em memória. **[ID-001]** `error.message` exposto em resposta HTTP de `send-medication-reminders` → substituído por mensagem genérica; `log()` interno preservado com detalhe. **[ID-011]** `asaas_customer_id`, `asaas_subscription_id`, `asaas_payment_id` removidos de `writeLocalCache` em `useSubscription.ts`; `MeuPlano.tsx` atualizado para chamar `refetchSubscription()` no handler de cancelamento (prevenção de regressão — IDs não mais disponíveis em cold-start do localStorage). Commits: `95bf1d74` (Lovable MCP — edge fn) + `a8f6e2c` (local — 5 arquivos). | Sprint 38 ✅ CONCLUÍDO |
| Sessão 39 | **[ID-003]** `staleTime: 5 * 60 * 1000` → `staleTime: 0 + gcTime: 5 * 60_000` nos 7 hooks PHI clínicos: `useHealthMeasurements`, `useProntuarioData` (2 queries: alergias + doenças), `useClinicalTimeline`, `useConsultations`, `useExams`, `useMedications`, `useSurgeries`. LGPD art. 11: dados de saúde não podem ser servidos de cache de sessão anterior. Análise de regressão: `isFetching` só consumido por `useSubscription` (não-PHI); todos hooks PHI consomem `isLoading` nos componentes — sem risco de spinner infinito. Commit: `62e5589` (7 arquivos, canal LOCAL). | Sprint 39 ✅ CONCLUÍDO |
| Sessão 40 | **Sprint Quick Wins** — 6 IDs corrigidos via canal LOCAL (9 arquivos, sem migrations/edge functions): **[ID-013]** `deleteMember.onSuccess` agora invalida 5 queryKeys (`family_members`, `upcoming-appointments`, `pending-counts`, `today-pet-routines`, `agenda`) — membro deletado não aparece mais por até 5 min na Home. **[ID-014]** `addMedication/updateMedication.onSuccess` passam a invalidar `["agenda"]` — posologia nova/editada reflete imediatamente na Agenda. **[ID-019]** `MedWithNextDose.med: any` → `med: Medication` em `useHomeData.ts` — segurança de tipo em `TodayMedicationsSection`. **[ID-017]** Comentário preventivo `// iOS Safari popup blocker: must open window synchronously BEFORE any await.` adicionado nos 5 locais de `window.open("about:blank")` (MeuPlano.tsx×2, Ajustes.tsx, PaywallModal.tsx, Landing.tsx). **[ID-010]** `select("*")` → colunas explícitas em `useHealthMeasurements.ts` e `useFamilyMembers.tsx`. **[ID-015]** `console.log`/`console.error` não-PHI substituídos por `captureException` em 6 locais: `InviteAcceptInterceptor.tsx` (3×), `useMedicationAlarms.ts`, `Cadastro.tsx`, `NotFound.tsx`. | Sprint 40 ✅ CONCLUÍDO |
| Sessão 41 | **ID-013 v2 + PROD-03 Asaas Root Cause**: **[ID-013 v2]** Causa raiz identificada: `refetchQueries` é no-op para queries inativas em TQ v5 — quando exclusão ocorre em FamiliarProfile (Home não montada), `["upcoming-appointments"]` exibia dados stale ao montar a Home. Fix: `removeQueries` (evicta cache completamente) em vez de `invalidate+refetch` para `["upcoming-appointments"]` e `["pending-counts"]`. Commit `e3c3184`. **[PROD-03]** Root cause do "Erro do servidor financeiro: Erro ao processar pagamento": contas de teste tinham `subscriptions.test_mode = false` (produção) + `cpf: null` → fallback `"00000000191"` rejeitado pela Receita Federal no Asaas Produção. Fix em 3 camadas: (1) DB — `test_mode = true` para teste15/teste16; (2) Edge function `create-asaas-checkout`: guard 422 se `!testMode && cpfCnpj === "00000000191"` (commit `ed7eb33` Lovable MCP); (3) `asaasService.ts`: extração de `errorCode`, tratamento limpo sem Sentry para `missing_cpf`, `asaasError`+`asaasDebug` no Sentry para demais erros (commit `49d600d`). Sistema de pagamento validado em produção por Fábio ✅. | Sprint 41 ✅ CONCLUÍDO |
| Sessão 45 | **CC — Reset de senha via Resend**: `supabase.auth.resetPasswordForEmail()` (browser/anon key, SMTP Supabase limitado a 3/hora) → Edge Function `manage-admins` action `reset` usando `adminClient.auth.admin.generateLink({ type: "recovery" })` + Resend API. `Clientes.tsx` atualizado para invocar a edge function. Audit log registrado. | Sprint 45 ✅ CONCLUÍDO |
| Sessão 66c | **SEC ✅ — `surgeries` UPDATE/DELETE restrito ao dono do registro (commit `158dc65`, Lovable MCP)**: Scanner do Lovable identificou que a policy criada na sessão 66b ainda permitia que qualquer group admin modificasse cirurgias de outros admins do grupo (`is_group_admin` exception). Análise: em todos os casos práticos o admin que cria cirurgia para um dependente já é o `user_id` do registro — a exceção abria privilege escalation entre admins do mesmo grupo sem utilidade real. Migration `20260630180809_205fd56f-c62e-4205-89e4-058ac4bcc738.sql`: DROP nas policies "Owners and admins can update/delete surgeries" + CREATE "Owners can update/delete own surgeries" com `user_id = (select auth.uid())` puro (sem OR is_group_admin). 8/8 findings do scanner Lovable confirmados resolvidos via `read_file` MCP: devin-mcp ✅, HTML injection ✅, Origin header ✅, family_members cross-group ✅, push spoof ✅, debug field ✅, PGMQ wrappers ✅, surgeries ownership ✅. | Segurança ✅ CONCLUÍDO |
| Sessão 66b | **SEC-P1 ✅ — `surgeries` UPDATE/DELETE sem ownership (commit `bb2f152`, Lovable MCP)**: Policies UPDATE e DELETE de `surgeries` validavam apenas membership de grupo, permitindo que qualquer membro editasse/apagasse cirurgia de outro. Fix: `DROP POLICY` nas policies antigas + `CREATE POLICY "Owners and admins can update/delete surgeries"` com `user_id = (select auth.uid()) OR is_group_admin(...)` em USING e WITH CHECK. **SEC-P1 ✅ — PGMQ wrappers acessíveis a usuários autenticados (commit `bb2f152`)**: `enqueue_email`, `read_email_batch`, `delete_email` e `move_to_dlq` tinham `EXECUTE` concedido ao role `authenticated` — qualquer usuário logado podia chamar via `supabase.rpc()`. Fix: `REVOKE EXECUTE ... FROM anon, authenticated` nas 4 funções. **P3 (defesa em profundidade)**: `REVOKE EXECUTE ... FROM anon` nas helpers RLS `check_group_access`, `is_group_member`, `is_group_admin`. | Segurança ✅ CONCLUÍDO |
| Sessão 66 | **SEC-P1 ✅ — HTML injection em `send-invite-email` (commit `22de5c2`, Lovable MCP)**: `buildInviteEmailHtml` interpolava `inviterName`, `groupName` e `email` em template HTML sem escaping — atacante que controla nome de perfil ou grupo podia injetar `<a>` tags de phishing no email de convite. Fix: `escapeHtml()` helper adicionado (entidades `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#x27;`); objeto `safe` criado no topo de `buildInviteEmailHtml` com os 3 valores escapados; subject line sanitizada contra CRLF injection (`replace(/[\r\n\t]/g," ").slice(0,100)`). **SEC-P1 ✅ — `family_members` INSERT cross-group (migration `20260630172523`, Lovable MCP)**: Policy INSERT de `family_members` validava apenas `(select auth.uid()) = user_id` — não verificava se o `group_id` informado pertencia a um grupo do caller. Atacante com UUID de outro grupo podia inserir membros nele. Fix: `ALTER POLICY "Users can insert own family members"` expandiu `WITH CHECK` com `group_id IS NULL OR group_id IN (SELECT group_id FROM family_group_members WHERE auth_user_id = (select auth.uid()))`. Edge function `send-invite-email` deployada. Demais 4 findings do scanner (sessão 66) eram stale — confirmado via leitura de código atual. | Segurança ✅ CONCLUÍDO |
| Sessão 65 | **SEC-P1 ✅ — Origin header reflection em `manage-admins` (commit `adc5b51`, Lovable MCP)**: A edge function `manage-admins` action `reset` refletia o header HTTP `Origin` (controlado pelo caller) em duas URLs: `redirectTo` do Supabase generateLink e `resetLink` enviado por email. Um admin malicioso podia manipular `Origin: https://evil.com` e fazer a vítima receber um email de reset apontando para domínio do atacante com o token OTP embutido. Fix: ambas as variáveis (`origin` + `appOrigin`) substituídas por `const appOrigin = Deno.env.get("APP_URL") ?? "https://vita.locustech.com.br"` — declarada uma única vez, nunca lendo o request header. Comentário `// SEC-P1: NUNCA usar req.headers.get("origin")` adicionado para prevenir regressão. Demais 3 findings do scanner (devin-mcp, push-notification spoof, create-asaas-checkout debug) já estavam corrigidos no commit `c2a5052` (Sessão 64) — scanner estava usando estado cacheado anterior aos fixes. | Segurança ✅ CONCLUÍDO |
| Sessão 64 | **Raio-X Segurança ✅ — 4 findings corrigidos (commit `c2a5052`, Lovable MCP)**: **[SEC-P0]** `supabase/functions/devin-mcp/` deletado completamente + entrada `[functions.devin-mcp]` removida do `config.toml` — endpoint público sem auth (verify_jwt=false, CORS *, zero guards) eliminado. **[SEC-P1a]** `send-push-notification`: guard de user_id spoof adicionado — caller JWT validado, role admin consultada em `user_roles`; se `body.user_id !== callerUserId && !callerIsAdmin` → 403. Cron calls (CRON_SECRET) mantêm acesso irrestrito. **[SEC-P1b]** `create-asaas-checkout`: campo `debug: msg` removido do response 400 (info disclosure — expunha erros brutos do Asaas ao cliente); substituído por `requestId` (UUID) para correlação com logs server-side. `asaasService.ts` atualizado: `debugInfo` mantido no Sentry context mas não mais exibido ao usuário na mensagem de erro. **[SEC-P2]** Migration `20260630200000_surgery_documents_group_access.sql`: policy SELECT do bucket `surgery-documents` expandida via JOIN em `family_group_members` — além do uploader (`owner = auth.uid()`), qualquer membro do mesmo grupo familiar pode visualizar os documentos (consistência com RLS das `surgeries`). **[SEC-P3 — não corrigido por design]** `credit_card_token` — false positive já mitigado por migration prévia (coluna com REVOKE SELECT). | Segurança ✅ CONCLUÍDO |
| Sessão 58 | **ID-008 ✅ — Remoção de `as any` em hooks críticos**: 8 casts `supabase.from("surgeries" as any) as any`, `supabase.from("surgery_instructions" as any) as any`, `supabase.from("push_subscriptions" as any) as any` removidos de `useSurgeries.tsx` (5×), `useHomeData.ts` (1×) e `usePushSubscription.ts` (2×). Root cause: `types.ts` estava 0 bytes localmente (unstaged) — restaurado via `git restore`. `npx tsc --noEmit` → 0 erros. | Sprint 58 ✅ CONCLUÍDO |
| Sessão 63 | **BK-03 UX Auth ✅ — Face ID 7s→~0s + re-trava em troca de app + push da conta antiga**: (1) `webauthn.ts`: exportou `fetchWebAuthnChallenge()` separado; removeu `getSession()` redundante (−500ms); `authenticatePasskey()` aceita `prefetchedOptions?`. (2) `AppLockScreen.tsx`: pré-busca o challenge no `useEffect` de mount — cold-start (2–5s) da edge function roda em background; Face ID aparece imediatamente ao toque. (3) `useAppLock.ts`: `UNLOCK_TS_KEY` + `wasRecentlyUnlocked()` + `markUnlocked()` — TTL 5 min em localStorage; quando iOS mata e reinicia o processo PWA em troca rápida de app, lock é saltado (igual a apps nativos). (4) `useAuth.tsx`: `signIn`/`signUp` escrevem TTL; `signOut` deleta push_subscription do banco para este dispositivo (evita notificações da conta anterior) e limpa TTL. (5) `AuthCallback.tsx`: escreve TTL após OAuth Google/Apple. Canal LOCAL, 5 arquivos, `npx tsc --noEmit` limpo, commit `b79a14c`. | Sprint 63 ✅ CONCLUÍDO |
| Sessão 62 | **SEC-STORAGE ✅ — Policy UPDATE ausente no bucket `surgery-documents`**: O Security Scanner apontou que o bucket privado `surgery-documents` tinha políticas INSERT, SELECT e DELETE mas nenhuma UPDATE — access surface incompleto. Migration `20260630180000_add_surgery_documents_update_policy.sql` criada via Lovable MCP (commit `c8c8e0d`): `CREATE POLICY "Users can update own surgery-documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'surgery-documents' AND owner = auth.uid()) WITH CHECK (...)`. Padrão idêntico às demais políticas do bucket. USING + WITH CHECK ambos obrigatórios em UPDATE pelo Supabase. | Sprint 62 ✅ CONCLUÍDO |
| Sessão 61 | **SEC-VAPID ✅ — Remover VAPID_PUBLIC_KEY hardcoded do código-fonte**: O Security Scanner do Lovable detectou a `VAPID_PUBLIC_KEY` hardcoded como fallback (`?? "BBvOiZ0..."`) em `send-push-notification/index.ts`. Mesmo sendo chave pública, o padrão foi apontado como "hardcoded credential" pelo scanner — mesmo risk profile do incidente VAPID_PRIVATE_KEY de junho/21 (sessão 35), e impede rotação de chave sem mudança de código. Fix (commit `26f9426`, Lovable MCP): (1) `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` agora são `Deno.env.get(...)` sem fallback; (2) guard 503 adicionado no handler logo após o OPTIONS check: se qualquer uma das duas secrets estiver ausente → `log("error", "push_vapid_secrets_missing")` + response `503 {"error":"Configuração de push incompleta"}`. `VAPID_SUBJECT` manteve fallback `mailto:suporte@locustech.com.br` (não é credential). Workaround colateral: `useSurgeries.tsx` precisou de `as unknown as Surgery[]` para resolver conflito de type inference com `types.ts` — issue de types.ts em aberto (requer regeneração). | Sprint 61 ✅ CONCLUÍDO |
| Sessão 60 | **BK-03 ✅ OAuth Google — velocidade e deep link**: (1) **Velocidade:** `AuthCallback.tsx` substituiu `setInterval` (200ms × 25 = até 5s) por `supabase.auth.onAuthStateChange(SIGNED_IN)` — detecção sub-100ms após troca PKCE. Timeout fallback de 8s para erros reais. (2) **Deep link perdido em notificações:** `AppLayout.tsx` ganhou auth guard (`!loading && !user`) que salva `window.location.pathname` em `lv_redirect_after_login` e redireciona a `/login`; `AuthCallback.tsx` e `Login.tsx` (handleSubmit + auto-redirect useEffect) leem e restauram a chave. Validação: path deve começar com `/` sem `://` (open redirect prevention). Canal LOCAL, 3 arquivos, commit `80fc54d`. | Sprint 60 ✅ CONCLUÍDO |
| Sessão 59 | **ID-018 ✅ completo — `aria-label` no `SwipeableCard` legacy**: `SwipeableCard.tsx` recebeu prop `ariaLabel?: string`, `role="listitem"` e `aria-label={ariaLabel}` no container; `Trash2` (decorativo, sem botão) recebeu `aria-hidden="true"`. `BloodPressureHistoryDrawer.tsx` passa `ariaLabel="Pressão arterial: {systolic}/{diastolic} mmHg"`. `MenstrualCycleDrawer.tsx` passa `ariaLabel="Ciclo menstrual: {formatDateRange(start, end)}"`. Commit `3242a1c`. | Sprint 59 ✅ CONCLUÍDO |
| Sessão 54 | **ID-002 ✅ + ID-009 ✅ — Eliminação de N+1 nos crons de notificação**: `_shared/notification-targets.ts`: adicionados `prefetchGroupFamilyMembers(adminClient, groupIds[])` (1 SELECT `.in("group_id", uniqueGroupIds)` para N grupos) e `resolveNotificationTargets(fgmMap, memberId, groupId)` (lookup síncrono O(1)); `getNotificationTargets` original mantido intacto. `send-medication-reminders`: prefetch batch após fetch de medications, `resolveNotificationTargets` síncrono no lugar de `await getNotificationTargets` dentro do loop — de 1 SELECT/medicamento para 1 SELECT total. `send-appointment-reminders`: 5 queries de entidades paralelizadas via `Promise.all`; prefetch único de todos os group_ids; `enqueue()` virou síncrona. Commit `80a0b50` (Lovable MCP — 3 arquivos, deploy via Lovable). | Sprint 54 ✅ CONCLUÍDO |
| Sessão 53 | **A7 ✅ E2E Playwright 8/8 — fix `add-medication.spec.ts`**: Root cause duplo: (1) `dispatchEvent(new MouseEvent("click", { bubbles: true }))` acionava o close do Vaul drawer via bubbling até o overlay — substituído por `saveBtn.click({ force: true })` (Playwright faz pointer events no centro do elemento, sem borbulhar). (2) `checkDateAndProceed("save")` abre AlertDialog quando `startDateTime` vazio — o gate exige click em "Continuar" para chamar `handleSave()`. Fix: handling condicional com `isVisible({ timeout: 3_000 })`. Toast correto: `"Medicamento adicionado!"` (não `"salvo"`). Variável de ambiente: `bun run test:e2e` (não `npx playwright test` — `.env.e2e` só carregado via `--env-file` do Bun). Commit `c06eea6`. **Resultado: 8/8 passando em 47.2s.** | Sprint 53 ✅ CONCLUÍDO |
| Sessão 52 | **ID-012 + ID-006 + ID-007 — RLS performance hardening**: Migration `20260629000001_perf_index_consent_log_user_id.sql`: `CREATE INDEX IF NOT EXISTS idx_consent_log_user_id ON consent_log(user_id)` — elimina seq scan na tabela de auditoria LGPD. Migration `20260629000002_perf_rls_select_auth_uid.sql`: (1) **ID-006** — `passkeys` policies `passkeys_select_own`/`passkeys_delete_own` receberam `TO authenticated` (únicas policies clínicas sem essa restrição). (2) **ID-007** — 19 tabelas (family_members, consultations, exams, medications, medication_doses, allergies, diseases, vaccines, health_measurements, blood_pressure_history, menstrual_cycles, push_subscriptions, family_groups, family_group_members, group_invites, notifications, surgeries, surgery_instructions) tiveram `auth.uid()` substituído por `(select auth.uid())` via `ALTER POLICY` — previne re-avaliação por linha (171ms → ~9ms em 100K rows). Lovable MCP edit `edt-d5a35823-8c17-43c3-9955-df9f5eb2ec51`. | Sprint 52 ✅ CONCLUÍDO |
| Sessão 51 | **PROD-05 Regressão 5 + cleanup payload Asaas**: (1) **PROD-05 v6 — Pagamentos infinitos (regressão 5):** `cancelAllPendingPayments` buscava por `customer=customerId` — falhou pois Asaas pode rejeitar `/cancel` para CREDIT_CARD e `AWAITING_PAYMENT` não é status válido da API v3. Além disso, não havia idempotência real: clicar no mesmo plano duas vezes criava um novo payment. Fix definitivo: função substituída por `handleExistingPayments(creds, userId, planDescription)` que busca por `externalReference=userId` (mais robusto — independe do customer ID no banco), aplica idempotência real (PENDING + mesmo plano → reutiliza `invoiceUrl`), e cancela orphans de planos diferentes. Commits `990e109` + `d055ce1`. (2) **Cleanup payload Asaas:** `creditCardHolderInfo` removido do `POST /payments` — é campo da API v2 para tokenização direta; no hosted checkout (invoiceUrl), o pré-preenchimento vem do customer profile. Telefone fictício `11912345678` removido — `effectivePhone` agora é `""` quando usuário não tem telefone real. Placeholders de endereço (`01310100`, `1`) removidos do customer profile — só envia campos com dados reais do usuário. | Sprint 51 ✅ CONCLUÍDO |
| Sessão 48 | **PROD-04 Regressão 4 — sync CPF sempre:** bloco de sync `PUT /customers/{id}` condicional em `subRow?.asaas_customer_id` — quando banco limpo (null) mas customer ainda existe no Asaas, `findOrCreateCustomer` reutilizava o customer pelo email mas o sync não disparava → customer sem CPF atualizado → checkout em branco. Fix: condição `subRow?.asaas_customer_id &&` removida; sync agora sempre roda logo após obter `customerId`, independente da origem (banco ou Asaas). Commit `2e42fdd` (Lovable MCP — edge function `create-asaas-checkout` deployada). | Sprint 48 ✅ CONCLUÍDO |
| Sessão 47 | **PROD-05 Regressão 3 + PROD-04 Regressão 3 + CC PT-BR**: (1) **PROD-05 v4 — Pagamentos infinitos ao alternar plano:** condição `subRow?.status === "pending_payment"` no bloco de cancelamento de plano (análogo ao bug da sessão 46 na idempotência) impedia que payments antigos fossem cancelados quando o status no banco não era `pending_payment` (ex: `active` após webhook). Fix: bloco de cancelamento passou a verificar o status real do payment no Asaas via `GET /payments/{id}` — apenas cancela se `PENDING` ou `AWAITING_PAYMENT`; status do banco não é mais consultado para essa decisão. (2) **PROD-04 v3 — CPF/dados não pré-preenchidos no Plano Mensal:** `syncPayload` do `PUT /customers/{id}` omitia `postalCode` e `addressNumber` — Asaas pode limpar esses campos no update parcial, causando checkout sem dados de endereço. Fix: `postalCode` e `addressNumber` adicionados ao `syncPayload`. Commit `8e3b212` (Lovable MCP). (3) **CC — Badge PT-BR:** "Grace Period até" → "Período de Carência até". Commits `6de8a10` + `59abc6e` (LOCAL). | Sprint 47 ✅ CONCLUÍDO |
| Sessão 46 | **PROD-04/05 Regressões 2 — CPF sync + idempotência checkout**: (1) **PROD-04 v2 — CPF não pré-preenchido (regressão):** quando `asaas_customer_id` já salvo no banco era reutilizado diretamente (bypass de `findOrCreateCustomer`), o customer Asaas nunca recebia `PUT /customers/{id}` com CPF/phone. Asaas pré-preenche o checkout a partir do registro do customer, não do `creditCardHolderInfo` do payment. Fix: `PUT /customers/{id}` sync adicionado logo após o bloco de reutilização de `customerId`. (2) **PROD-05 v3 — Pagamento duplicado (regressão 2):** condição `subRow?.status === "pending_payment"` na idempotência excluía todos os usuários retornantes (`status: "trialing"`, `"canceled"`, `"active"`) — a cada abertura do checkout, novo payment era criado. Fix: condição `status` removida; Asaas é SSOT via `GET /payments/{id}` (status `PENDING`/`AWAITING_PAYMENT` → reutiliza). Commit `13384422` (Lovable MCP, edge function only). | Sprint 46 ✅ CONCLUÍDO |
| Sessão 44 | **PROD-05 regressão + debug cego + `.single()` em subscription ausente**: (1) Regressão PROD-05: `select` em `create-asaas-checkout` deixado com 3 colunas apenas em vez das 6 necessárias — blocos de idempotência e cancelamento de plano eram dead code. Corrigido: select ampliado para `status, plan_type, asaas_payment_id`. (2) Debug cego: erros não-`asaas_error:`-prefixed não apareciam no `debug` da resposta 400 — `asaasDebug` sempre vazia no Sentry. Corrigido: catch block agora sempre expõe `debug: msg`. (3) **Root cause real do erro `teste10`**: o checkout foi tentado às 13:09:31 UTC mas a subscription row só foi criada às 13:10:38 (via `set_user_test_mode` INSERT branch). O código antigo usava `.single()` em vez de `.maybeSingle()` — SELECT vazio com `.single()` lança exceção não-`asaas_error:` → debug vazio no Sentry. Código atual usa `.maybeSingle()` + `testMode = subRow?.test_mode !== false` (default sandbox quando ausente). `teste10` tem perfil completo validado no banco (CPF real `599.422.840-01`, postal_code, address_number) — checkout deve funcionar na próxima tentativa. Commit `dd75267` (Lovable MCP). | Sprint 44 ✅ CONCLUÍDO |
| Sessão 43 | **PROD-04/05 — CPF pré-preenchido no checkout + checkout idempotente**: (1) Root cause PROD-04: `findOrCreateCustomer` criava o customer Asaas sem CPF (`{ name, email }` only) — Asaas usa dados do customer para pré-preencher o checkout. Fix: `findOrCreateCustomer` agora passa `cpfCnpj + phone + postalCode + addressNumber` no `POST /customers` e faz `PUT /customers/{id}` se o customer existente não tiver CPF (guard: só atualiza se `cpfCnpj !== "00000000191"`). (2) Root cause PROD-05: cada clique em "Assinar" criava novo payment — se usuário fechava e tentava de novo, payment antigo ficava `PENDING` indefinidamente. Fix idempotente: edge function consulta `GET /payments/{asaas_payment_id}` antes de criar novo. Se status `PENDING` ou `AWAITING_PAYMENT` com mesmo `plan_type`, retorna a `invoiceUrl` existente. Se expirou, cancela o antigo (`POST /payments/{id}/cancel`) antes de criar novo. Mudança de plano (mensal→anual) também cancela o antigo. Commit `179b02f` (Lovable MCP — edge function only). Fix Command Center (sessão anterior): `GRANT EXECUTE ON FUNCTION public.get_admin_clients() TO authenticated` + `set_user_test_mode`. Migration `20260629000001`. Commit `6134e6d`. | Sprint 43 ✅ CONCLUÍDO |
| Sessão 42 | **PROD-03 complemento — CPF guard hard-block + bypass paywall**: (1) Guard anterior era advisory-only (`toast.warning` sem bloqueio) — UX quebrada: tab em branco abria, edge function chamada, 422 `missing_cpf` retornado, tab ficava em branco. Fix: 3 handlers de checkout agora verificam `!hasCpf` ANTES de qualquer `window.open` → emitem `toast.info` + `navigate("/meus-dados")` + `return` early (`MeuPlano.tsx` ×2, `PaywallModal.tsx` ×1). Commit `57381b0`. (2) Deadlock detectado: trial expirado + paywall `locked=true` + CPF ausente → guard redireciona para `/meus-dados` mas timer de 1s em fila reabre o paywall imediatamente. Fix: `PAYWALL_BYPASS_PATHS = ['/meus-dados']` em `AppLayout.tsx` + `pathname` adicionado ao deps do useEffect — ao navegar para bypass route: `setShowPaywall(false)` + early return (sem novo timer). Ao navegar de volta: effect re-executa normalmente → paywall volta a aparecer para usuário completar assinatura com CPF. Commit `908c155`. | Sprint 42 ✅ CONCLUÍDO |

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

### C3 · Biometria falsa → BK-04 WebAuthn real (FaceID / TouchID) ✅
- **Risco resolvido:** Toggle de biometria usava `localStorage` sem WebAuthn real — usuário acreditava ter proteção biométrica que não existia.
- **Resolução final (BK-04 — 18/06/2026):** WebAuthn FIDO2/Passkeys implementado end-to-end e validado em produção no iPhone (iOS 18.7 PWA).
  - **Migration:** `20260617000001_webauthn_passkeys.sql` — tabelas `passkeys` + `webauthn_challenges` + RLS completa.
  - **Edge functions:** `webauthn-challenge` (gera options via `@simplewebauthn/server@9.0.3`; `allowCredentials:[]` para discoverable credential flow no iOS) + `webauthn-verify` (verifica assertionResponse, persiste passkey, atualiza `sign_count`).
  - **Cliente:** `src/lib/webauthn.ts` — Credential Management API nativa (zero deps frontend); `publicKey` construído sem spread do response do servidor; `rpId` e `allowCredentials` omitidos → iOS usa hostname efetivo e busca discoverable; base64url helpers inline.
  - **Hook + UI:** `src/hooks/usePasskeys.ts` + card completo em `Seguranca.tsx` (cadastro, lista, remoção de passkeys).
  - **Fluxo validado:** registro → `{"success":true}` ✅; autenticação → picker iOS "Usar Chave-senha" → Face ID → `{"success":true}` ✅; app desbloqueado ✅.
  - **Sessão 20 — fixes adicionais:**
    - Tentativa de specific credential IDs (para eliminar picker) revertida: iOS PWA roteava para picker QR cross-device ao receber IDs específicos mesmo com `transports:["internal"]`. Causa raiz: comportamento iOS diferente de Chrome Desktop.
    - Discoverable flow (`allowCredentials:[]`) restaurado em `webauthn-challenge/index.ts` e `webauthn.ts`. Picker "Usar Chave-senha" → Face ID permanece como UX final aceita.
    - **Fix crítico de lock screen:** `usePasskeys.ts` tinha `queryKey:["passkeys"]` sem user ID → React Query servia cache do usuário A para o usuário B no mesmo dispositivo → usuário sem passkey via lock screen. Corrigido: `queryKey:["passkeys", user?.id]` + `.eq("user_id", user.id)` + `enabled:!!user?.id`.
- **Arquivos:** `src/lib/webauthn.ts`, `src/hooks/usePasskeys.ts`, `src/pages/Seguranca.tsx`, `supabase/functions/webauthn-challenge/`, `supabase/functions/webauthn-verify/`, `supabase/migrations/20260617000001_webauthn_passkeys.sql`
- **Status:** ✅ Resolvido (BK-04 — sessão 19 + fixes sessão 20, 18/06/2026)

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

### ID-002 · N+1 query em cron de lembretes de medicamento ✅
- **Risco resolvido:** N+1 query em `send-medication-reminders` — `getNotificationTargets` chamado dentro do `for (const med of medications)` gerava 1 SELECT em `family_group_members` por medicamento. Em 50 meds simultâneos → 50 queries extras a cada 5 minutos.
- **Resolução (sessão 54):** `prefetchGroupFamilyMembers(adminClient, allGroupIds)` adicionado em `_shared/notification-targets.ts` — 1 SELECT batch `.in("group_id", uniqueGroupIds)` antes do loop. Dentro do loop: `resolveNotificationTargets(fgmMap, member.id, member.group_id)` — lookup síncrono O(1). De 50 SELECTs → 1 SELECT total por execução do cron. Commit `80a0b50` (Lovable MCP).
- **Arquivos:** `supabase/functions/_shared/notification-targets.ts`, `supabase/functions/send-medication-reminders/index.ts`
- **Status:** ✅ Resolvido (sessão 54)

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
- **Fix:** `authorizedRef` (useRef) adicionado como fonte de verdade imutável via DevTools. A condição de render verifica `authorizedRef.current` além do `status` state — mesmo que alguém manipule `status` de "loading" → "authorized" no DevTools, `authorizedRef.current` permanece `false` até a query confirmar. Toast de "Acesso negado" movido para `useEffect` (side-effect fora do render path).
- **Arquivos:** `src/components/AdminRoute.tsx`
- **Status:** ✅ Resolvido (sessão 13)

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
- **Status:** ✅ Resolvido (sessão 11 + sessão 53) — `calculateNextDose.test.ts` com 24 testes unitários (sessão 11). E2E Playwright 8/8 passando (sessão 53): `playwright.config.ts` standalone, `e2e/global.setup.ts` com storageState, 4 specs. Fix crítico: `dispatchEvent(bubbles:true)` → `click({ force:true })` + handling AlertDialog "Continuar". Sempre usar `bun run test:e2e` (não `npx playwright test`).

---

### A8 · `manage-admins list-emails` aceita array ilimitado de userIds
- **Risco:** Enumeração massiva de emails de usuários por admins sem audit log.
- **Fix:** Limite de 100 IDs por chamada — retorna 400 se excedido. Audit log permanece como M8 (backlog separado).
- **Arquivos:** `supabase/functions/manage-admins/index.ts`
- **Status:** ✅ Resolvido (sessão 13)

---

### A9 · `publish-changelog` sem paginação de usuários
- **Risco:** `listUsers({ perPage: 1000 })` — usuários além do milésimo não recebem notificação de release.
- **Fix:** Loop de paginação implementado — busca páginas de 1000 até `batch.length < 1000` (última página). Falha parcial mantém changelog criado e notifica os usuários já coletados.
- **Arquivos:** `supabase/functions/publish-changelog/index.ts`
- **Status:** ✅ Resolvido (sessão 13)

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
- **Fix:** pg_cron job criado — deleta doses com `scheduled_for < now() - interval '2 years'`, todo domingo às 3h UTC. Particionamento avaliado como desnecessário até ~50M rows.
- **Migration:** `20260616000019_ttl_pg_cron_jobs.sql` — aplicada ✅ (pg_cron habilitado; 5 jobs confirmados no Dashboard)
- **Status:** ✅ Resolvido (sessão 13)

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

### A16 · Art. 48 LGPD — Sem mecanismo de detecção ou notificação de incidentes ✅
- **Fix:** Sentry já integrado (sessão 13). Runbook de resposta a incidentes criado em `docs/runbook-lgpd-art48.md`: classificação P0/P1/P2, fluxo de contenção, notificação ANPD (3 dias úteis via peticionamento.anpd.gov.br, conforme Resolução CD/ANPD 4/2023), templates de comunicação aos titulares, registro de evidências e revisão pós-incidente.
- **Arquivos:** `docs/runbook-lgpd-art48.md`
- **Status:** ✅ Resolvido (sessão 16)

---

### A17 · `patientAge` injetado no system prompt da IA sem sanitização ✅
- **Fix:** Validação em `analyze-prescription/index.ts`: tipo `number`, inteiro, ≥ 0, ≤ 130. Qualquer outro valor → `null` (contexto pediátrico desabilitado). Fecha vetor de prompt injection via campo numérico.
- **Status:** ✅ Resolvido (sessão 8)

---

### A18 · `pdfjs-dist` pinado sem `^` — nunca recebe patches de segurança
- **Fix inicial (sessão 14):** `"pdfjs-dist": "4.4.168"` → `"^4.4.168"`. 
- **Fix completo (sessão 18 / B9-A):** Atualizado para `"^5.7.284"`. Caminho do worker `build/pdf.worker.min.mjs` preservado em v5 — `parseSusVaccinePdf.ts` sem alterações necessárias.
- **Arquivos:** `package.json`
- **Status:** ✅ Resolvido (sessão 14 → atualizado sessão 18)

---

### ID-004/005 · PHI em `console.log` — `parseSusVaccinePdf.ts` e `useVaccineImport.ts` ✅
- **Risco resolvido:** LGPD Art. 11 — dados de saúde sensíveis (CPF, texto completo do PDF da carteira SUS, vacinas extraídas) expostos em console do browser, visíveis no DevTools de qualquer sessão aberta.
- **Resolução:** 7 chamadas `console.log` removidas:
  - `parseSusVaccinePdf.ts`: `"FULL PDF TEXT"` (texto integral com CPF), `"DETECTED COLUMNS"`, `"EXTRACTED VACCINES"`, `"MERGED ROWS COUNT"` — 4 remoções.
  - `useVaccineImport.ts`: `"DEBUG CPF"` (CPF do membro + candidatos do PDF em texto plano), `catch (error) { console.error("Erro no Parser")`, `catch (err) { console.error("Import error")` — 3 remoções.
  - Comentário `// LGPD Art. 11: CPF não é logado — comparação ocorre apenas em memória, sem persistência` adicionado no ponto de comparação.
- **Arquivos:** `src/lib/parseSusVaccinePdf.ts`, `src/hooks/useVaccineImport.ts`
- **Status:** ✅ Resolvido (sessão 38, commit `a8f6e2c`)

---

### ID-001 · `error.message` exposto em resposta HTTP — `send-medication-reminders` ✅
- **Risco resolvido:** Mensagem de erro interno do Supabase retornada diretamente ao chamador HTTP — vaza detalhes de implementação e schema de banco para qualquer consumidor da Edge Function.
- **Resolução:** Linha 90 substituída: `{ error: error.message }` → `{ error: "Erro interno ao buscar medicamentos" }`. `log("error", "med_reminders_fetch_failed", { error: error.message })` preservado para diagnóstico interno no Supabase Dashboard.
- **Arquivos:** `supabase/functions/send-medication-reminders/index.ts`
- **Status:** ✅ Resolvido (sessão 38, commit Lovable MCP `95bf1d74`)

---

### ID-003 · `staleTime: 5min` em hooks PHI clínicos ✅
- **Risco resolvido:** LGPD Art. 11 — 7 hooks de dados de saúde configurados com `staleTime: 5 * 60 * 1000`, permitindo que medicamentos, consultas, exames, cirurgias, medidas corporais, alergias e doenças fossem servidos de cache por até 5 minutos. Em dispositivos compartilhados ou após troca de membro familiar, o usuário poderia ver dados clínicos de uma sessão anterior.
- **Resolução:** `staleTime: 0` + `gcTime: 5 * 60_000` aplicados em todos os 7 hooks PHI:
  - `useHealthMeasurements` — medidas corporais (peso, altura, IMC)
  - `useProntuarioData` — alergias (query 1) + doenças (query 2)
  - `useClinicalTimeline` — timeline histórica agregada
  - `useConsultations` — histórico de consultas médicas
  - `useExams` — exames e laudos
  - `useMedications` — medicamentos em uso e posologia
  - `useSurgeries` — cirurgias e instruções pré/pós-operatórias
- **Análise de regressão:** `isFetching` consumido apenas por `useSubscription` (não-PHI). Todos hooks PHI usam `isLoading` nos componentes — nenhum spinner infinito. Cache (gcTime) servido sincronamente durante refetch em background — sem flash de loading.
- **Arquivos:** `src/hooks/useHealthMeasurements.ts`, `src/hooks/useProntuarioData.ts`, `src/hooks/useClinicalTimeline.ts`, `src/hooks/useConsultations.tsx`, `src/hooks/useExams.tsx`, `src/hooks/useMedications.tsx`, `src/hooks/useSurgeries.tsx`
- **Status:** ✅ Resolvido (sessão 39, commit `62e5589`)

---

### ID-011 · IDs de pagamento Asaas em `localStorage` ✅
- **Risco resolvido:** `asaas_customer_id`, `asaas_subscription_id` (e campo extra `asaas_payment_id`) persistidos em `lv_sub_cache` no localStorage do browser — IDs de processador de pagamento acessíveis via DevTools, XSS, ou compartilhamento de dispositivo.
- **Resolução:**
  - `writeLocalCache` em `useSubscription.ts` agora desestrutura e descarta os 3 campos antes de gravar. localStorage armazena apenas o que é necessário para determinar `canUsePremium` (status, datas de faturamento, tipo de plano).
  - `MeuPlano.tsx`: `handleCancelSubscription` chama `refetchSubscription()` no início para obter `asaas_subscription_id` fresco do Supabase — prevenção de regressão, pois o ID não está mais disponível no cold-start do localStorage. Fallback `freshSub?.asaas_subscription_id ?? subscription?.asaas_subscription_id` cobre falhas transitórias de rede.
- **Arquivos:** `src/hooks/useSubscription.ts`, `src/pages/MeuPlano.tsx`
- **Status:** ✅ Resolvido (sessão 38, commit `a8f6e2c`)

---

### ID-006 · Políticas RLS sem `TO authenticated` em migrations antigas ✅
- **Risco resolvido:** Sem `TO authenticated`, a política se aplica a `PUBLIC` (inclui `anon`). Após análise completa, apenas `passkeys` (`passkeys_select_own` e `passkeys_delete_own`, migration `20260617000001`) estava afetada no escopo clínico — as demais policies das migrations identificadas já tinham `TO authenticated`.
- **Resolução:** Migration `20260629000002_perf_rls_select_auth_uid.sql` adicionou `TO authenticated` às duas policies da tabela `passkeys` via `ALTER POLICY ... TO authenticated USING (...)`.
- **Status:** ✅ Resolvido (sessão 52, Lovable edit `edt-d5a35823`)

---

### ID-007 · `auth.uid()` direto em RLS sem `(select auth.uid())` ✅
- **Risco resolvido:** `auth.uid()` chamado diretamente em `USING/WITH CHECK` era re-avaliado para cada linha. `(select auth.uid())` usa `initPlan` — avaliado 1× por query. Em tabelas com > 10K linhas: diferença medida de 171ms → ~9ms (sem índice).
- **Resolução:** Migration `20260629000002_perf_rls_select_auth_uid.sql` aplicou `ALTER POLICY` em 19 tabelas: `family_members`, `consultations`, `exams`, `medications`, `medication_doses`, `allergies`, `diseases`, `vaccines`, `health_measurements`, `blood_pressure_history`, `menstrual_cycles`, `push_subscriptions`, `family_groups`, `family_group_members`, `group_invites`, `notifications`, `surgeries`, `surgery_instructions`, `passkeys`. Inclui otimização de chamadas a `is_group_member(auth.uid(), ...)` → `is_group_member((select auth.uid()), ...)`.
- **Status:** ✅ Resolvido (sessão 52, Lovable edit `edt-d5a35823`)

---

### ID-009 · N+1 latente em cron de lembretes de consultas/exames ✅
- **Risco resolvido:** `send-appointment-reminders` chamava `getNotificationTargets` dentro dos 4 loops (consultas, exames, vacinas, cirurgias), gerando 1 SELECT por item. Em dias com muitos compromissos, escalava linearmente. Além disso, as 5 queries de entidades eram sequenciais.
- **Resolução (sessão 54):** (1) 5 queries de entidades paralelizadas via `Promise.all` — latência de ~500ms → ~100ms. (2) Prefetch único de todos os `group_ids` de todas as entidades → 1 SELECT batch. (3) `enqueue()` refatorada para síncrona — usa `resolveNotificationTargets(fgmMap, ...)` (O(1) lookup). De N SELECTs → 1 SELECT total por execução do cron. Commit `80a0b50` (Lovable MCP).
- **Arquivos:** `supabase/functions/_shared/notification-targets.ts`, `supabase/functions/send-appointment-reminders/index.ts`
- **Status:** ✅ Resolvido (sessão 54)

---

### ID-010 · `select("*")` em tabelas com PHI ✅
- **Risco resolvido:** Colunas explícitas previnem vazamento automático de dados em migrations futuras.
- **Arquivos:** `src/hooks/useHealthMeasurements.ts:27` (health_measurements), `src/hooks/useFamilyMembers.tsx:53` (family_members)
- **Resolução:** `.select("id, user_id, family_member_id, weight, height, bmi, recorded_at, created_at")` em `useHealthMeasurements.ts`; lista completa de 19 colunas do tipo `FamilyMember` em `useFamilyMembers.tsx`. Comentário `[ID-010]` explica o motivo.
- **Status:** ✅ Resolvido (sessão 40)

---

### ID-012 · Índice btree ausente em `consent_log.user_id` ✅
- **Risco resolvido:** A política RLS `USING (user_id = auth.uid())` em `consent_log` executava seq scan — tabela de auditoria que cresce constantemente (1 linha por aceite/revogação de consentimento).
- **Resolução:** Migration `20260629000001_perf_index_consent_log_user_id.sql`: `CREATE INDEX IF NOT EXISTS idx_consent_log_user_id ON public.consent_log (user_id);`
- **Status:** ✅ Resolvido (sessão 52, Lovable edit `edt-d5a35823`)

---

### ID-013 · Widget "5 Próximos Compromissos" exibe compromissos de membros deletados ✅
- **Risco resolvido (v2 — sessão 41):** Causa raiz corrigida: `refetchQueries` em TQ v5 é no-op para queries inativas. Quando a exclusão ocorre em FamiliarProfile (Home não montada), a Home voltava a exibir dados stale do membro deletado enquanto o background refetch ainda não havia completado. Fix: `removeQueries({ queryKey: ["upcoming-appointments"] })` e `removeQueries({ queryKey: ["pending-counts"] })` evictam o cache completamente — ao montar a Home, as queries iniciam do zero sem dados residuais. Server query já filtra por `family_members.deleted_at IS NULL` (defense in depth).
- **Histórico:** sessão 40 adicionou `invalidateQueries + refetchQueries` para 5 queryKeys — fix parcial (funciona apenas quando Home está montada durante a exclusão).
- **Arquivos:** `src/hooks/useFamilyMembers.tsx`
- **Status:** ✅ Resolvido v2 (sessão 41, commit `e3c3184`)

---

### ID-014 · `addMedication` / `updateMedication` não invalidam `["agenda"]` ✅
- **Risco resolvido:** `addMedication.onSuccess` e `updateMedication.onSuccess` agora invalidam `["agenda"]` — medicamento novo/editado reflete imediatamente na Agenda.
- **Arquivos:** `src/hooks/useMedications.tsx`
- **Status:** ✅ Resolvido (sessão 40)

---

### ID-016 · Formulários com PHI sem validação Zod
- **Risco:** Cadastro, Login, AddMedicationDrawer, AddConsultationDrawer e AddSurgeryDrawer validam PHI com lógica imperativa dispersa. Sem schema Zod centralizado, inconsistências entre frontend e backend passam despercebidas e erros de validação são difíceis de testar.
- **Arquivos:** `src/pages/Cadastro.tsx`, `src/pages/Login.tsx`, `src/components/AddMedicationDrawer.tsx`, `src/components/AddConsultationDrawer.tsx`, `src/components/AddSurgeryDrawer.tsx`
- **Fix:** Criar `src/lib/schemas/` com schemas Zod por domínio (auth, medication, consultation, surgery). Usar `zodResolver` com React Hook Form.
- **Severidade × Esforço:** 🟠 Importante × Alto (8h+)
- **Status:** ⬜ Pendente (ver também BACKLOG.md)

---

### ID-018 · `aria-label` ausente em cards de saúde interativos
- **Risco:** Cards de medicamento, consulta, exame e cirurgia com gesto de swipe não têm `aria-label` nos elementos interativos. VoiceOver iOS e TalkBack Android não conseguem descrever as ações para usuários com deficiência visual. Apenas 15 ocorrências de `aria-label` em toda a pasta `src/components/`.
- **Arquivos:** `src/components/SwipeableCard.tsx`, `src/components/ExamSwipeableCard.tsx`, `src/components/SurgeryCard.tsx`, `src/components/medications/MedicationListItem.tsx`
- **Fix:** Adicionar `role="listitem"`, `aria-label` descritivo e `onKeyDown` handlers nos containers de swipe. Ver padrão em seção Acessibilidade do SKILL.md.
- **Severidade × Esforço:** 🟠 Importante × Médio (4h)
- **Status:** ✅ Resolvido (sessão 57 + sessão 59) — Sessão 57: `role="listitem"` + `ariaLabel` em `SwipeableActionCard` e `ExamSwipeableCard`; botões de ação com `aria-label`; ícones decorativos com `aria-hidden="true"` em 6 arquivos. Sessão 59: `SwipeableCard.tsx` (legacy usado em Pressão Arterial e Ciclo Menstrual) recebeu `ariaLabel?: string`, `role="listitem"` e `aria-hidden` no ícone Trash2; os dois drawers consumidores passam label contextual. Commit `3242a1c`.

---

## 🟡 MÉDIO — Degradação com crescimento ou manutenibilidade

### M1 · Sem APM/Sentry
- **Fix:** Instrumentar `@sentry/react` + `@sentry/node` nas Edge Functions. Adicionar ao `<ErrorBoundary>`.
- **Status:** ✅ Resolvido (sessão 11 + 13) — `@sentry/react@^8.54.0` adicionado ao `package.json`; `src/lib/sentry.ts` com `initSentry()` (no-op se `VITE_SENTRY_DSN` não configurado) e `captureException()`; `main.tsx` inicializa Sentry antes do render; `ErrorBoundary.tsx` usa `captureException`. DSN configurado via Lovable env var (`VITE_SENTRY_DSN`) em sessão 13. Validado em produção: primeiro evento capturado confirmado no dashboard Sentry (projeto `locus-vita-1`). Ativo apenas em `import.meta.env.PROD`.

---

### M2 · Sem CI/CD no repositório
- **Fix:** GitHub Actions com: `lint` → `typecheck` → `vitest` → `supabase db test`.
- **Status:** ✅ Resolvido (sessão 11) — `.github/workflows/ci.yml` criado: Node 20 + npm ci + lint + `tsc --noEmit` + `npm test`. Disparado em push/PR para `main`. `supabase db test` fica para quando houver SQL tests.

---

### M3 · `Home.tsx` (826 LOC) e `Vacinas.tsx` (801 LOC) monolíticos
- **Fix:** Extrair sub-componentes e hooks por responsabilidade.
- **Status:** ✅ Resolvido (sessão 17)
  - `Home.tsx`: 849 → 138 LOC (−84%)
    - `src/hooks/useHomeData.ts` — pendingCounts, upcoming, todayPetRoutines, homeDoseStatuses, medsWithNextDose
    - `src/components/home/HomeHeader.tsx` — saudação, busca, notificações
    - `src/components/home/OverviewCarousel.tsx` — carrossel Visão Geral com dots
    - `src/components/home/TodayMedicationsSection.tsx` — accordion Ações Medicamentosas
    - `src/components/home/UpcomingAppointmentsSection.tsx` — accordion 5 Próximos Compromissos
    - `src/components/home/FamilySelectDrawer.tsx` — drawer seleção de familiar
  - `Vacinas.tsx`: 802 → 478 LOC (−40%)
    - `src/hooks/useVaccineImport.ts` — upload PDF, parsing SUS, validação CPF, deduplicação
    - `src/components/vacinas/VaccineFormDrawer.tsx` — formulário add/edit vacina

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
- **Fix:** Migration `20260616000021` cria tabela `admin_audit_log` (id, performed_by, action, target_id, target_email, metadata, created_at) com RLS — apenas super_admins podem SELECT; escrita exclusiva via service_role. Helper `audit()` non-blocking adicionado em `manage-admins/index.ts` — registra `promote`, `revoke`, `create`, `list-emails`. Ação `list` não gera registro individual (volume alto, baixo risco).
- **Arquivos:** `supabase/migrations/20260616000021_admin_audit_log.sql`, `supabase/functions/manage-admins/index.ts`
- **Status:** ✅ Resolvido (sessão 14) — migration 000021 aplicada ✅

---

### M9 · Logs não estruturados nas Edge Functions
- **Fix:** Substituir `console.log(string)` por `console.log(JSON.stringify({ level, event, userId, ... }))`.
- **Status:** ✅ Resolvido (sessão 11) — `_shared/logger.ts` criado com `log(level, event, data?)`; todos os 66 `console.*` bare de 9 funções + `_shared/rate-limit.ts` convertidos para `log("info"|"warn"|"error", "snake_case_event", {...})`. Zero `console.*` restantes fora do logger.

---

### M10 · `setTimeout(1500)` hardcoded no checkout Asaas
- **Fix:** `getSubscriptionInvoiceUrl` refatorada com polling de backoff crescente: 5 tentativas com delays `[500, 1000, 1500, 2000, 2500]ms` (máx 7.5s total). Retorna assim que `invoiceUrl` estiver disponível — no happy path é mais rápido que o delay fixo. Na tentativa final, se `invoiceUrl` ainda ausente, deriva a URL via `payment.id` (fallback mantido). Bem dentro do timeout de 60s das Edge Functions.
- **Arquivos:** `supabase/functions/create-asaas-checkout/index.ts`
- **Status:** ✅ Resolvido (sessão 14)

---

### M11 · Sem TTL em `notifications`, `ai_usage_logs`, `email_send_log`
- **Fix:** pg_cron jobs de limpeza — mesma migration que A12:
  - `notifications` lidas com >30 dias (diário 2h UTC)
  - `ai_usage_logs` com >90 dias (segundas 2h UTC)
  - `email_send_log` com >90 dias (segundas 2:30h UTC)
- **Migration:** `20260616000019_ttl_pg_cron_jobs.sql`
- **Status:** ✅ Resolvido (sessão 13) — migration 000019 aplicada ✅ (junto com A12)

---

### M12 · Art. 18-I LGPD — Acesso a dados apenas via PDF parcial
- **Fix:** Endpoint de export completo em JSON (todos os dados do titular). Ver A15.
- **Status:** ✅ Resolvido (sessão 3, via A15) — export JSON completo implementado em `Ajustes.tsx` cobrindo todos os dados clínicos do grupo familiar.

---

### M13 · `email_send_log.recipient_email` em texto plano
- **Fix:** Migration `20260616000022`: coluna `recipient_email_hash TEXT` adicionada; `recipient_email` tornada nullable; pg_cron job `anonymize_email_send_log` roda a cada hora e NULL-a `recipient_email` em registros com >24h. Edge Function `process-email-queue`: helper `hashEmail()` com `crypto.subtle.digest('SHA-256')` + `EMAIL_HASH_SALT` env var; os 3 inserts (dlq, sent, rate_limited) agora gravam `recipient_email_hash` junto.
- **Arquivos:** `supabase/migrations/20260616000022_email_send_log_pseudonymize.sql`, `supabase/functions/process-email-queue/index.ts`
- **Secret:** `EMAIL_HASH_SALT` ✅ criado no Supabase Dashboard → Edge Functions → Secrets (sessão 14)
- **Status:** ✅ Resolvido (sessão 14) — migration 000022 aplicada ✅

---

### M14 · Art. 18-IX LGPD — Sem revogação de consentimento ✅
- **Risco resolvido:** Sem mecanismo formal de revogação de consentimento — titular não podia exercer direito do Art. 18-IX.
- **Resolução:**
  1. Migration `20260616000010` — altera constraint `consent_log_consent_type_check` para incluir `'revoked'`; adiciona índice composto `idx_consent_log_user_type (user_id, consent_type, granted_at DESC)` para consultas eficientes.
  2. Botão "Revogar Consentimento" adicionado em `Ajustes.tsx` com badge âmbar e `AlertDialog` de confirmação com aviso claro: revogação registra a solicitação mas não apaga dados (para remoção usar "Excluir Conta"). `handleRevokeConsent` insere registro `consent_type = 'revoked'` em `consent_log` — a tabela é imutável por RLS, mantendo histórico completo.
- **Arquivos:** `src/pages/Ajustes.tsx`, `supabase/migrations/20260616000010_lgpd_consent_log_revoke.sql`
- **Status:** ✅ Resolvido (sessão 3) — migration 000010 aplicada.

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
- **Fix:** `AI_GATEWAY_URL` e `AI_MODEL` lidos de `Deno.env.get()` com fallback para os valores atuais. Sem secrets configurados, comportamento idêntico ao anterior. Para trocar modelo ou gateway: criar `AI_GATEWAY_URL` e `AI_MODEL` no Supabase Dashboard → Edge Functions → Secrets.
- **Arquivos:** `supabase/functions/analyze-prescription/index.ts`, `supabase/functions/analyze-exam/index.ts`
- **Status:** ✅ Resolvido (sessão 14)

---

### M18 · `.eq('id', 1)` hardcoded em `process-email-queue`
- **Fix:** Migration `20260616000020` adiciona coluna `queue_name TEXT NOT NULL DEFAULT 'default'` com UNIQUE index. SELECT e UPDATE agora usam `.eq('queue_name', 'default')` — semântico e resiliente a recriação de tabela.
- **Arquivos:** `supabase/functions/process-email-queue/index.ts`, `supabase/migrations/20260616000020_email_send_state_queue_name.sql`
- **Status:** ✅ Resolvido (sessão 14) — migration 000020 aplicada ✅

---

### M19 · Imagens sem otimização (landing page e listas)
- **Fix:** Logo nav com `loading="eager"` + dimensões explícitas (120×80); logo footer com `loading="lazy"` + dimensões (100×56); imagens de seção já tinham `loading="lazy"` ✅; ClinicalTimeline viewer com `loading="lazy"` + `width={800} height={600}` para prevenir CLS. WebP do logo fica para quando os assets forem atualizados.
- **Arquivos:** `src/pages/Landing.tsx`, `src/components/ClinicalTimeline.tsx`
- **Status:** ✅ Resolvido (sessão 14)

---

### ID-008 · `as any` sem narrowing em hooks críticos ✅
- **Risco resolvido:** 8 ocorrências de `supabase.from("surgeries" as any) as any`, `supabase.from("surgery_instructions" as any) as any` e `supabase.from("push_subscriptions" as any) as any` removidas de `useSurgeries.tsx` (5×), `useHomeData.ts` (1×) e `usePushSubscription.ts` (2×). Root cause: `types.ts` estava esvaziado localmente (unstaged) — restaurado via `git restore`. `MedWithNextDose.med: any` → `med: Medication` já resolvido em ID-019 (sessão 40). `npx tsc --noEmit` → 0 erros.
- **Status:** ✅ Resolvido (sessão 58)

---

### ID-015 · `console.log`/`console.error` não-PHI em produção ✅
- **Risco resolvido:** 6 ocorrências substituídas por `captureException` via `@/lib/sentry` em `InviteAcceptInterceptor.tsx` (3×: provisionNewGroup, checkInvite_retry, handleAccept), `useMedicationAlarms.ts` (1×: decrement_stock — `console.error` redundante removido, Sentry já presente), `Cadastro.tsx` (1×: logConsent), `NotFound.tsx` (1×: 404 + pathname).
- **Status:** ✅ Resolvido (sessão 40)

---

### ID-019 · `MedWithNextDose.med` tipado como `any` em tipo exportado ✅
- **Risco resolvido:** `import type { Medication } from "./useMedications"` adicionado; `med: any` → `med: Medication` em `MedWithNextDose`. Segurança de tipo completa em `TodayMedicationsSection.tsx`.
- **Arquivos:** `src/hooks/useHomeData.ts`
- **Status:** ✅ Resolvido (sessão 40)

---

### ID-020 · Migrations conflitantes para módulo Cirurgias
- **Risco:** `20260622000000_add_surgeries_module.sql` usa `fgm.user_id` (campo inexistente — correto é `fgm.auth_user_id`). Supersedida por `20260622172313`. Em staging, as políticas com campo errado podem ter ficado ativas entre os dois deploys, potencialmente permitindo acesso indevido temporário.
- **Arquivos:** `supabase/migrations/20260622000000_add_surgeries_module.sql`, `supabase/migrations/20260622172313_d78937ea.sql`
- **Fix:** Adicionar comentário no topo de `20260622000000` indicando que foi supersedida. Documentar historicamente — não remover (imutabilidade das migrations).
- **Severidade × Esforço:** 🟡 Melhoria × Alto (documentação + auditoria)
- **Status:** ✅ Resolvido (sessão 57) — Comentário de supersedência adicionado ao topo de `20260622000000_add_surgeries_module.sql` explicando o bug `fgm.user_id` e indicando a migration corretora `20260622172313`.

---

## 🟢 BAIXO — Higiene técnica e polish

### B1 · `deno.land/std@0.168.0` desatualizado (atual: 0.224+)
- **Fix:** Atualizar via `import_map.json`. Ver M4.
- **Status:** ✅ Resolvido (sessão 11, via M4) — `import_map.json` centraliza `std@0.224.0`; todas as 9 funções usam bare specifiers resolvidos pelo mapa.

---

### B2 · `@radix-ui/react-toast` + `sonner` duplicados
- **Fix:** `<Toaster />` Radix removido do `App.tsx` (import + JSX). Nenhuma página usava `useToast()` diretamente — todas já em Sonner. Arquivos `ui/toaster.tsx` e `hooks/use-toast.ts` mantidos como dead code compatível com Lovable (shadcn UI gerado). Pacote `@radix-ui/react-toast` mantido no `package.json` para não quebrar o build do shadcn.
- **Arquivos:** `src/App.tsx`
- **Status:** ✅ Resolvido (sessão 14)

---

### B3 · Helper de timezone espalhado ✅
- **Fix:** `src/lib/tz.ts` criado com `TZ_SAO_PAULO`, `parseDate`, `toSaoPaulo`, `formatDate`, `formatDateTime`, `formatTime`, `formatDateTimeSeconds`, `formatISOSaoPaulo`, `todaySaoPaulo`, `nowSaoPaulo`. SSOT para todas as operações de data no frontend.
- **Status:** ✅ Resolvido (sessão 8)

---

### B4 · `QueryClient` sem `defaultOptions` de erro global
- **Fix:** `QueryCache` e `MutationCache` com `onError: (error) => captureException(error)` adicionados ao `new QueryClient()` em `App.tsx`. TanStack Query v5 removeu `onError` de `defaultOptions.queries` — `QueryCache`/`MutationCache` são a API correta em v5. No-op em desenvolvimento (`captureException` verifica `import.meta.env.PROD` internamente). Garante que falhas silenciosas de query/mutation apareçam no dashboard Sentry.
- **Arquivos:** `src/App.tsx`
- **Status:** ✅ Resolvido (sessão 14)

---

### B5 · Login, Cadastro, ResetPassword sem `lazy()` — Suspense inútil ✅
- **Fix:** Todos os 27 imports de páginas convertidos para `lazy()` em `src/App.tsx`. Funções de import extraídas para permitir prefetch via `prefetchByRoute` e `prefetchCriticalChunks`. `<Suspense>` adicionado nas 4 rotas que faltavam (Landing, Home, AdminLogin, NotFound).
- **Status:** ✅ Resolvido (sessão 8)

---

### B6 · `vite` v5.x com histórico de CVEs de path traversal ✅
- **Fix:** `"vite": "^5.4.19"` → `"^6.0.0"` em `package.json`. Vite 6 suportado por todos os plugins: `@vitejs/plugin-react-swc` ^3.11.0 (`^4||^5||^6||^7`), `lovable-tagger` v1.1.13 (`>=5 <8`), `vitest` ^3.2.6 (`^5||^6||^7`). `vite.config.ts` sem alterações necessárias. Breaking changes Vite 5→6 não afetam o projeto (sem Sass, sem library mode, sem resolve.conditions custom, postcss.config.js em ESM, tailwind.config.ts lido pelo TailwindCSS).
- **Arquivos:** `package.json`
- **Status:** ✅ Resolvido (sessão 16) — aguardando `npm install` + `npm run build` locais para regenerar lock file

---

### B7 · `changelogs` e `group_invites` sem índices nas colunas de filtro ✅
- **Risco resolvido:** Ordenação e busca por email de convite sem índice.
- **Resolução:** Migration `20260615000008` — `idx_changelogs_created_at` e `idx_changelogs_release_date` (DESC); `idx_group_invites_group_id`, `idx_group_invites_email` e `idx_group_invites_email_group` (composto para aceitar convite por email + grupo). Também adicionado `idx_ai_usage_logs_user_id` para future rate limiting.
- **Status:** ✅ Resolvido (migration 000008 aplicada)

---

### B8 · Project ID hardcoded em `useAuth.tsx`
- **Fix:** `sb-xazlrdwdkafhzwkezfxz-auth-token` → `` `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token` ``. `VITE_SUPABASE_PROJECT_ID` já estava no `.env` e no Lovable env vars.
- **Arquivos:** `src/hooks/useAuth.tsx`
- **Status:** ✅ Resolvido (sessão 14)

---

### B9 · Dependências 1+ major version atrás

**B9-A** ✅ (sessão 18): `pdfjs-dist` ^4→^5, `react-router-dom` 6→7, `vaul` 0.9→1.1.2  
**B9-B** ✅ (sessão 18): `react` + `react-dom` 18→19, `@types/react` + `@types/react-dom` 18→19. `.npmrc legacy-peer-deps=true` para CI.  
**B9-C** ✅ (sessão 18): `tailwindcss` v3→v4, `@tailwindcss/vite` (novo), `autoprefixer` removido. `vite.config.ts` com plugin, `index.css` com `@import "tailwindcss"` + `@config`. 63× `outline-none→outline-hidden`, 51× `shadow-sm→shadow-xs`.

| Pacote | Status |
|--------|--------|
| `pdfjs-dist` | ✅ v5.7.284 (B9-A) |
| `react-router-dom` | ✅ v7.16 (B9-A) |
| `vaul` | ✅ v1.1.2 (B9-A) |
| `react` + `react-dom` | ✅ v19.0 (B9-B) |
| `tailwindcss` | ✅ v4.0 (B9-C) |
| `recharts` | ⬜ 2.x (3.x disponível — baixa prioridade) |
| `react-day-picker` | ⬜ 8.x (9.x disponível — baixa prioridade) |
| `date-fns` | ⬜ 3.x (4.x disponível — baixa prioridade) |
| `zod` | ⬜ 3.x (4.x — não usado em src/, baixíssima prioridade) |

- **Status:** ✅ Itens de alto risco concluídos. Restam 4 pacotes de baixo risco para sprint futuro.

---

### ID-017 · Comentário preventivo ausente no padrão `window.open("about:blank")` ✅
- **Risco resolvido:** Comentário `// iOS Safari popup blocker: must open window synchronously BEFORE any await.` adicionado nos 5 locais: `MeuPlano.tsx:97,167`, `Ajustes.tsx:64`, `PaywallModal.tsx:151`, `Landing.tsx:128`.
- **Status:** ✅ Resolvido (sessão 40)

---

### CC-01 · Reset de senha no Command Center não entregava e-mail ✅
- **Risco resolvido:** `handleResetPassword` em `Clientes.tsx` chamava `supabase.auth.resetPasswordForEmail()` diretamente do browser com anon key — rota que usa o SMTP padrão do Supabase (rate limit: 3 e-mails/hora, deliverability ruim). E-mails de reset nunca chegavam ao destinatário.
- **Causa raiz:** Anon key → Supabase Auth SMTP (não o Resend já configurado no projeto).
- **Resolução (sessão 45, commit Lovable MCP `2a783b64`):**
  - `manage-admins/index.ts`: adicionados `sendViaResend()` helper + `buildResetPasswordHtml()` template; bloco `reset` inserido **antes** do super_admin check (admin OU super_admin podem usar); usa `adminClient.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } })` → envia via `RESEND_API_KEY`; audit log via `await audit("reset-password", ...)`.
  - `Clientes.tsx`: `supabase.auth.resetPasswordForEmail()` substituído por `supabase.functions.invoke("manage-admins", { body: { action: "reset", email } })`.
- **Observação:** `redirectTo` (`${origin}/reset-password`) precisa estar na allowlist em Lovable Cloud → Auth → Redirect URLs. Se ausente, Supabase usa o site URL padrão como fallback — link ainda funciona.
- **Arquivos:** `supabase/functions/manage-admins/index.ts`, `src/pages/command-center/Clientes.tsx`
- **Status:** ✅ Resolvido (sessão 45, commit `2a783b64`)

---

### CC-02 · Command Center — Melhorias de qualidade (sessão 44) ✅
- **Ação "Alterar Plano Grátis":** Dropdown de ações em `Clientes.tsx` ganhou opção "Alterar para Plano Grátis" → invoca `set_user_test_mode` + zera plano. Antes só era possível via SQL direto.
- **Paginação (20/página):** Lista de clientes em `Clientes.tsx` limitada a 20 por página com navegação Anterior/Próxima. Evita timeout da RPC `get_admin_clients` em listas longas.
- **staleTime nos 3 tabs CC:** `Clientes.tsx`, `Admins.tsx` e `Dashboard.tsx` passaram a usar `staleTime: 5 * 60 * 1000` — elimina refetch a cada re-render do tab de admin e reduz carga na RPC.
- **Commit:** `44ecc43` (canal LOCAL)
- **Status:** ✅ Resolvido (sessão 44)

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
├── ✅ M14                                 → Revogação de consentimento (Art. 18-IX) + migration 000010 aplicada
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
└── ✅ M1                                 → @sentry/react + src/lib/sentry.ts + DSN configurado + validado em produção

Sprint 6 — Bug ∞ Dipirona (Fase 401) + OCR Receitas ✅ CONCLUÍDO
├── ✅ homeDoseStatuses date filter       → .gte("scheduled_for", -7d) em Home.tsx + Medicamentos.tsx
├── ✅ useMedicationAlarms catch-up       → loop calculateNextDose para specific_times/specific_days
├── ✅ MedicationDoseActions auto-conclusão → suporta os 3 frequency_types; props startDateISO, frequencyType, specificTimes, specificDays adicionados
├── ✅ Fix analyze-prescription CORS      → APP_ORIGIN corrigido: `https://vita.locustech.com.br` (sem /login)
└── ✅ 6 erros TS residuais              → time_performed, effectiveFreqType, startDateISO (Lovable auto-fix)

Sprint 7 — Segurança avançada + TTL + Observabilidade ✅ CONCLUÍDO
├── ✅ A3, A8, A9, A12, A16, M8–M10, M13, M17, M18, A18, B2, B4, B8, M19
└── (detalhes na tabela de sessões 13 e 14)

Sprint 8 — Qualidade de código + Upgrades ✅ CONCLUÍDO
├── ✅ B6                                → Vite 5→6
├── ✅ A16                               → Runbook LGPD Art. 48
├── ✅ M3                                → Refatoração Home.tsx (849→138 LOC) + Vacinas.tsx (802→478 LOC)
├── ✅ B9-A                              → react-router-dom v7 + vaul v1.1.2 + pdfjs-dist v5
├── ✅ B9-B                              → React 18→19 + .npmrc legacy-peer-deps=true
└── ✅ B9-C                              → Tailwind v3→v4: @tailwindcss/vite, @import, 63× outline-hidden, 51× shadow-xs

Sprint 10 — Segurança + UX ✅ CONCLUÍDO
├── ✅ S3-02                             → prefers-reduced-motion no OverviewCarousel
├── ✅ S3-05                             → OCR retry UI no fluxo analyze-prescription
└── ✅ BK-04                             → WebAuthn passkeys: registro + autenticação FIDO2 (iOS 18.7 PWA confirmado)

Sprint 11 — LGPD reforço + Signed URLs ✅ CONCLUÍDO
└── ✅ BK-06                             → storage.ts: TTL 900s, getSignedUrl genérico, PRESCRIPTIONS_BUCKET; hook useSignedUrl.ts com auto-renovação React Query

Sprint 12 — Pendente (sugestão)
├── ⬜ A7 E2E                            → Playwright: login, cadastro de medicamento, marcação de dose
├── ⬜ BK-02                             → Ciclos posológicos complexos (anticoncepcional 21+7)
└── ⬜ BK-03                             → OAuth Google / Apple (login social)

Sprint 38 — Diagnóstico LGPD + 3 Achados Críticos ✅ CONCLUÍDO (sessão 2026-06-28)
├── ✅ DIAGNOSTICO_CODEBASE_2026-06-27.md  → 20 achados em 5 domínios gerados e commitados
├── ✅ ID-004/005                           → PHI removido de console.log (parseSusVaccinePdf + useVaccineImport)
├── ✅ ID-001                               → error.message → mensagem genérica em send-medication-reminders
└── ✅ ID-011                               → IDs Asaas removidos de localStorage (writeLocalCache + refetch no cancel)

Sprint 39 — [ID-003] staleTime PHI ✅ CONCLUÍDO (sessão 2026-06-28)
└── ✅ ID-003                               → staleTime: 0 + gcTime: 5min nos 7 hooks PHI clínicos (LGPD art. 11)

Sprint 40 — Quick Wins LOCAL ✅ CONCLUÍDO (sessão 2026-06-28)
├── ✅ ID-013                               → deleteMember.onSuccess: 5 queryKeys invalidados (family_members, upcoming-appointments, pending-counts, today-pet-routines, agenda)
├── ✅ ID-014                               → addMedication/updateMedication.onSuccess: ["agenda"] invalidada
├── ✅ ID-019                               → MedWithNextDose.med: any → Medication (segurança de tipo em TodayMedicationsSection)
├── ✅ ID-017                               → Comentário preventivo iOS Safari popup blocker em 5 locais de window.open
├── ✅ ID-010                               → select("*") → colunas explícitas em useHealthMeasurements + useFamilyMembers
└── ✅ ID-015                               → console.log/error não-PHI → captureException em 6 locais (InviteAcceptInterceptor×3, useMedicationAlarms, Cadastro, NotFound)

Sprint 35+36 — Web Push VAPID ✅ CONCLUÍDO E2E (sessão 2026-06-21)
├── ✅ BK-01 (código)                    → Infraestrutura Web Push VAPID implementada no repo local
│   ├── public/sw.js                     → Service Worker: push event, notificationclick, install/activate
│   ├── src/lib/pushConfig.ts            → Chave pública VAPID
│   ├── src/hooks/usePushSubscription.ts → Hook opt-in, registro SW, sync para push_subscriptions
│   ├── src/main.tsx                     → Registro do SW em PROD
│   ├── src/pages/Notificacoes.tsx       → Card de opt-in Ativar/Desativar push
│   ├── src/hooks/useMedicationAlarms.ts → Removido Notification API redundante
│   ├── supabase/functions/send-push-notification/   → Edge Fn genérica VAPID (npm:web-push)
│   ├── supabase/functions/send-medication-reminders/ → pg_cron 5min → push por dose
│   ├── supabase/functions/send-appointment-reminders/ → pg_cron 8h BRT → push D-0/D-1
│   ├── supabase/migrations/20260621120000_push_notifications.sql → tabela push_subscriptions + RLS + TTL
│   ├── supabase/functions/import_map.json → npm:web-push@3.6.7
│   └── supabase/config.toml             → verify_jwt=false nas 3 novas Edge Functions
├── ✅ Secrets configurados               → VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET no Supabase Dashboard
│                                           (par VAPID regenerado sessão 36 — incidente de inconsistência pós-rotação)
├── ✅ Migration 20260621120000 aplicada  → tabela push_subscriptions criada + RLS + índices ativos
├── ✅ 3 Edge Functions deployadas        → send-push-notification, send-medication-reminders, send-appointment-reminders
├── ✅ pg_cron jobs ativos (confirmado via query cron.job em 2026-06-21):
│   ├── send-medication-reminders        → */5 * * * * (a cada 5 min) — active=true
│   ├── send-appointment-reminders       → 0 11 * * * (8h BRT) — active=true
│   └── ttl_push_subscriptions_inactive  → 0 4 * * 0 (domingo 4h UTC) — active=true
└── ✅ E2E validado                       → notificação "💊 Hora do Remédio!" recebida no iPhone com PWA fechado
```

---

*Documento gerado automaticamente pelo Claude (Cowork). Atualizar após cada sprint ou mudança arquitetural significativa.*
