# LOCUS VITA — Backlog de Features e Melhorias

> **Versão:** 2.6 | **Atualizado em:** 2026-07-01 (sessão 69 — rotação VAPID par 3 (BadJwtToken), notificações E2E revalidadas)
> Arquivo de controle de backlog. Atualizar após cada sprint.
> Débito técnico (bugs, código, arquitetura) → ver `TECH_DEBT.md`

---

## Legenda

| Símbolo | Significado |
|---------|------------|
| 🔴 | Alta prioridade — impacto direto no usuário ou receita |
| 🟡 | Média prioridade — melhoria significativa |
| 🟢 | Baixa prioridade — nice-to-have |
| ✅ | Concluído |
| ⬜ | Pendente |
| 🔄 | Em progresso |

---

## Produção — Itens Urgentes

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| PROD-01 | ~~CPF real do usuário em `creditCardHolderInfo`~~ | ✅ | Resolvido (sessão 33): `create-asaas-checkout` agora busca `cpf` real de `family_members`. Se ausente, usa fallback `"00000000191"` + log `warn "checkout_cpf_fallback"`. Migration adicionou campo `cpf` à tabela; tela MeusDados permite preenchimento. |
| PROD-02 | ~~Endereço/telefone real em `creditCardHolderInfo`~~ | ✅ | Resolvido (sessão 33): edge function busca `phone`, `postal_code`, `address_number` reais do perfil familiar. Campos CEP e número adicionados à tela MeusDados. Migration `postal_code + address_number` aplicada. |
| PROD-03 | ~~Validar tokenização + Root cause "Erro do servidor financeiro"~~ | ✅ | **Resolvido (sessões 41+42).** Root cause: contas de teste com `subscriptions.test_mode = false` (Asaas Produção) + `cpf: null` → fallback `"00000000191"` rejeitado pela Receita Federal. Fix sessão 41 (3 camadas): (1) DB `test_mode = true` para contas de teste; (2) edge function `create-asaas-checkout`: guard 422 com `code: "missing_cpf"` se produção sem CPF; (3) `asaasService.ts`: tratamento limpo de `missing_cpf` sem Sentry. Fix sessão 42 (UX hard-block): guard advisory-only substituído por hard-block em 3 handlers (`handleRegularize`, `handleReactivate`, `handleSubscribe`) — `navigate("/meus-dados") + return` antes de qualquer `window.open`. |
| PROD-04 | ~~CPF pré-preenchido no checkout Asaas~~ | ✅ | **Resolvido (sessão 43).** Root cause: `findOrCreateCustomer` criava o customer no Asaas com `{ name, email }` apenas — CPF ia só no `creditCardHolderInfo` do payment (cobrança API). Asaas usa dados do *customer* para pré-preencher o checkout. Fix: `findOrCreateCustomer` agora passa `cpfCnpj + phone + postalCode + addressNumber` no `POST /customers`. Customers existentes sem CPF são atualizados via `PUT /customers/{id}` (guard: só atualiza se `cpfCnpj !== "00000000191"`). |
| PROD-04 | ~~CPF pré-preenchido no checkout Asaas~~ | ✅ | **Resolvido (sessão 43).** Root cause: `findOrCreateCustomer` criava o customer no Asaas com `{ name, email }` apenas — CPF ia só no `creditCardHolderInfo` do payment (cobrança API). Asaas usa dados do *customer* para pré-preencher o checkout. Fix: `findOrCreateCustomer` agora passa `cpfCnpj + phone + postalCode + addressNumber` no `POST /customers`. Customers existentes sem CPF são atualizados via `PUT /customers/{id}`. **Regressão 2 (sessão 46):** bypass de `findOrCreateCustomer` ao reutilizar `asaas_customer_id` do banco — customer nunca recebia CPF/phone. Fix: `PUT /customers/{id}` sync adicionado ao path de reutilização (commit `13384422`). **Regressão 3 (sessão 47):** `syncPayload` omitia `postalCode` e `addressNumber` — Asaas limpava esses campos no PUT, causando checkout do Plano Mensal sem dados pré-preenchidos. Fix: `postalCode` e `addressNumber` adicionados ao `syncPayload` (commit `8e3b212`). **Regressão 4 (sessão 48):** sync block condicional em `subRow?.asaas_customer_id` — quando banco limpo (null) mas customer ainda existe no Asaas, `findOrCreateCustomer` reutiliza o customer mas o sync não dispara → customer sem CPF → checkout em branco. Fix: condição `subRow?.asaas_customer_id &&` removida; sync agora sempre roda após obter `customerId` (commit `2e42fdd`). **Diagnóstico sessão 49:** campo "CPF do titular do cartão" no checkout hosted ≠ CPF do customer. O Asaas só pré-preenche esse campo quando o customer tem cartão tokenizado (pagamento confirmado). Customer confirmado com CPF correto no dashboard Asaas ✅ — backend está correto. Campo em branco é comportamento esperado em primeiros pagamentos/sandbox. |
| PROD-05 | ~~Pagamentos duplicados / pendentes no Asaas~~ | ✅ | **Resolvido (sessão 43) + Regressões 1-5.** Problema original: cada clique em "Assinar" criava novo payment. Fix sessão 43: check idempotente via `GET /payments/{asaas_payment_id}`. **Regressão 1:** `select` incompleto tornava blocos dead code — corrigido sessão 44. **Regressão 2:** `status === "pending_payment"` na idempotência bloqueava usuários retornantes — removido sessão 46. **Regressão 3 (sessão 47):** o mesmo `status === "pending_payment"` no bloco de cancelamento — ao alternar annual↔monthly o payment antigo nunca era cancelado → acúmulo infinito de PENDING. Fix: condição de DB status removida; verifica status real via `GET /payments/{id}`. **Regressão 4 (sessão 50):** cancelamento ao trocar plano não incluía `OVERDUE` — quando o payment antigo vencia (dueDate=hoje em sandbox), condição `["PENDING","AWAITING_PAYMENT"]` era FALSE → payment não cancelado → novo criado → acúmulo de OVERDUE no Asaas. Fix: `"OVERDUE"` adicionado à lista de status cancelandáveis; catch agora loga o erro em vez de engolir silenciosamente (commit `ac51b3f`). **Regressão 5 (sessão 51):** `cancelAllPendingPayments` buscava por `customer=customerId` — mas o Asaas pode rejeitar o cancelamento por restrições de cartão de crédito, e `AWAITING_PAYMENT` não é status válido na API v3. Além disso, não havia idempotência real: clicar no mesmo plano duas vezes criava um segundo payment. Fix definitivo (commit `990e109`): substituído por `handleExistingPayments` que busca por `externalReference=userId` (mais robusto — independe do customer ID no banco), aplica idempotência real (PENDING + mesmo plano → reutiliza `invoiceUrl` sem criar novo payment), e cancela orphans de planos diferentes com log de diagnóstico detalhado. **Cleanup payload (commit `d055ce1`):** `creditCardHolderInfo` removido do `POST /payments` (campo API v2 — não documentado na v3; o pré-preenchimento do hosted checkout vem do customer profile); telefone fictício `11912345678` removido (só envia `phone` se usuário tem dado real); placeholders de endereço `"01310100"`/`"1"` removidos do customer profile. |

---

## Features — Alta Prioridade

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| BK-01 | ~~Push notifications multi-dispositivo~~ | ✅ | **E2E validado em produção (sessão 36, 2026-06-21).** Implementação completa: SW, PushManager, `send-push-notification`, `send-medication-reminders` (±3 min), `send-appointment-reminders` (D-0/D-1 às 8h BRT), migration com pg_cron. Incidente de segurança (sessão 35): VAPID_PRIVATE_KEY exposta em JSDoc → chaves rotacionadas. E2E fix (sessão 36): par VAPID inconsistente pós-rotação → par regenerado. **Fix sessão 67 (2026-07-01):** dois bugs em `usePushSubscription.ts` corrigidos — `is_active:true` no upsert + re-sync ao fazer login (commit `5f4b6a9`). **Diagnóstico sessão 68 (2026-07-01):** backend 100% funcional. **Rotação sessão 69 (2026-07-01):** Sentry LOCUS-VITA-Z confirmou `statusCode=403 BadJwtToken` — VAPID_PUBLIC_KEY em Secrets apontava para o par 1 (`BNQueAzo...`) mas VAPID_PRIVATE_KEY era do par 2 → JWT assinado com chave errada. Fix: par 3 gerado via `npx web-push generate-vapid-keys`, AMBAS as chaves (public + private) atualizadas nos Secrets, `pushConfig.ts` atualizado para chave pública do par 3 (`BPiseS4Y...`), subscriptions inativas limpas do banco, usuários re-subscreveram ao reabrir o app. **Notificações E2E revalidadas por Fábio ✅** |
| A7-E2E | ~~Testes E2E Playwright~~ | ✅ | **8/8 passando (sessão 53, 2026-06-30).** `playwright.config.ts` standalone (sem lovable-agent dep), `e2e/global.setup.ts` para autenticação com storageState, 4 specs: `auth/login.spec.ts`, `medications/add-medication.spec.ts`, `medications/mark-dose.spec.ts`, `payment/checkout.spec.ts`. **Fix crítico:** `add-medication.spec.ts` — substituído `dispatchEvent(bubbles:true)` por `saveBtn.click({ force: true })` (dispatchEvent fechava o Vaul drawer via bubbling) + handling condicional do AlertDialog "Continuar" (gate `checkDateAndProceed` exige click em "Continuar" quando `startDateTime` vazio). Toast: `"Medicamento adicionado!"` (não "salvo"). **Importante:** usar `bun run test:e2e` (não `npx playwright test`) — `.env.e2e` só é carregado via flag `--env-file` do Bun. |

---

## Features — Média Prioridade

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| BK-02 | ~~Ciclos posológicos complexos~~ | ✅ | **Implementado (sessão 70, 2026-07-01):** novo `frequency_type = 'cyclic'` com `cycle_active_days + cycle_pause_days + cycle_start_date`. Migration `20260702000000_add_cyclic_posology.sql` + CHECK constraint (risco HIGH — sem dose na pausa). `calculateNextDose.ts` branch cyclic (aritmética modular, fase ativa/pausa). `AddMedicationDrawer.tsx` com opção "Ciclo (com pausa)" e UI amber de aviso. `AdherenceHistoryDrawer.tsx` geração virtual apenas nos dias ativos. `useHomeData.ts` badge "Pausa do Ciclo". `send-medication-reminders` bloqueia push na pausa + lembrete "Reinício amanhã" no último dia de pausa. |
| BK-03 | ~~OAuth Google / Apple~~ | ✅ | Google OAuth implementado. Sessão 60 (2026-06-30): velocidade melhorada (polling→onAuthStateChange, sub-100ms) + deep link restaurado após re-login via notificação. **Login Social completo (sessão 67, 2026-07-01):** tela `/login-social`, badges de provedor em MeusDados, Ajustes Segurança com item "Login Social", `unlinkIdentityAdmin` via `manage-google-identity` edge function (workaround para `manual_linking_enabled` indisponível no Lovable Cloud). Apple: pendente (requer Apple Developer Account pago). |
| BK-11 | Zod schemas para formulários com PHI | 🟡 | Criar `src/lib/schemas/` (auth, medication, consultation, surgery). Usar `zodResolver` com React Hook Form. Cadastro, Login, AddMedicationDrawer, AddConsultationDrawer, AddSurgeryDrawer. Estimativa: 8h+. (ver ID-016 em TECH_DEBT.md) |
| BK-05 | ~~Dashboard de Adesão Medicamentosa~~ | ✅ | Implementado. Bug "Parcial" corrigido (2026-06-19): virtual doses agora cobrindo specific_times e specific_days. "Melhor sequência" (recorde) também adicionado. |
| BK-07 | ~~Importação de receitas via foto (câmera)~~ | ✅ | Implementado (2026-06-19, sessão 27): card "Ler Receita com IA" na Home → FamilySelectDrawer → AiMedicationUpload → AddMedicationDrawer |
| BK-08 | ~~Compartilhamento de histórico com médico~~ | ✅ | Implementado (2026-06-19, sessão 21): PDFs gerados para aderência, consultas, exames, vacinas — individual ou família inteira — via jsPDF + botão Share2 |

---

## Features — Baixa Prioridade

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| BK-04 | Lembretes por e-mail | 🟢 | E-mails transacionais via PGMQ para usuários sem push ativo |
| BK-09 | Widget iOS / Android | 🟢 | Próxima dose na tela inicial sem abrir o app |
| BK-10 | Relatório mensal automático | 🟢 | PDF por e-mail com resumo de saúde familiar |

---

## Upgrades de Dependências Pendentes

| Pacote | Versão atual | Versão alvo | Risco | Notas |
|--------|-------------|-------------|-------|-------|
| `recharts` | 2.x | 3.x | 🟡 Médio | API de componentes mudou; revisar charts existentes |
| `react-day-picker` | 8.x | 9.x | 🟡 Médio | API de props mudou; `CustomDateTimePicker` pode precisar ajuste |
| `date-fns` | 3.x | 4.x | 🟢 Baixo | Leve; testar funções de parse/format |
| `zod` | 3.x | 4.x | 🟡 Médio | API mudou; revisar schemas de validação |

---

## Concluído (movido do Backlog)

| ID | Item | Sprint | Data |
|----|------|--------|------|
| BK-04 | WebAuthn passkeys (Face ID / Touch ID) | Sprint 10 | 2026-06 |
| BK-06 | Signed URLs para arquivos clínicos (LGPD) | Sprint 11 | 2026-06 |
| BK-Asaas | Refactor motor financeiro → Cobrança Avulsa + tokenização | Sprint 13 | 2026-06-19 |
| BK-01 | Push notifications multi-dispositivo — implementação (VAPID + pg_cron + SW) | Sprint 35 | 2026-06-21 |
| BK-01-E2E | Push notifications — E2E validado no iPhone (fix par VAPID + contagem APNs) | Sprint 36 | 2026-06-21 |
| A7-E2E | Testes E2E Playwright — 8/8 passando (fix dispatchEvent/Vaul + AlertDialog gate) | Sprint 53 | 2026-06-30 |
| BUG-∞ | Bug ∞ Dipirona (Fase 401) — alias `"interval"` normalizado em `calculateNextDose` | Sprint 37 | 2026-06-21 |
| CC-01 | Fix reset de senha CC: `resetPasswordForEmail` (SMTP Supabase) → Edge Function `manage-admins` action `reset` com `generateLink` + Resend API | Sprint 45 | 2026-06-29 |
| CC-02 | CC Clientes: ação "Alterar Plano Grátis" + paginação 20/página + `staleTime: 5min` nos 3 tabs do Command Center | Sprint 44 | 2026-06-29 |
| SEC-LGPD | Diagnóstico LGPD: 3 achados críticos — PHI em console.log (7 logs), error.message em HTTP, IDs Asaas em localStorage | Sprint 38 | 2026-06-28 |
| SEC-ID003 | [ID-003] staleTime: 0 nos 7 hooks PHI clínicos (LGPD art. 11) — dados de saúde nunca servidos de cache de sessão anterior | Sprint 39 | 2026-06-28 |
| PROD-01 | CPF real em `creditCardHolderInfo` (busca de `family_members`) | Sprint 33 | 2026-06-20 |
| PROD-02 | Endereço/telefone real em `creditCardHolderInfo` (busca de `family_members`) | Sprint 33 | 2026-06-20 |
| SEC-RLS | Fix subscriptions 42501 — column-level grants quebraram select("*") | Hotfix | 2026-06-20 |
| BK-07 | Importação de receitas via foto (câmera) | Sprint 27 | 2026-06-19 |
| BK-08 | Compartilhamento de histórico com médico (Export PDF) | Sprint 21 | 2026-06-19 |

---

*Mantido pelo Claude (Cowork). Atualizar após cada sprint ou decisão de produto.*
