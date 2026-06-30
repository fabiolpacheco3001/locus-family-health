# LOCUS VITA — Backlog de Features e Melhorias

> **Versão:** 2.0 | **Atualizado em:** 2026-06-29 (sessão 48)
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
| PROD-05 | ~~Pagamentos duplicados / pendentes no Asaas~~ | ✅ | **Resolvido (sessão 43) + Regressão 1 (sessão 44) + Regressão 2 (sessão 46) + Regressão 3 (sessão 47).** Problema original: cada clique em "Assinar" criava novo payment. Fix sessão 43: check idempotente via `GET /payments/{asaas_payment_id}`. **Regressão 1:** `select` incompleto tornava blocos dead code — corrigido sessão 44. **Regressão 2:** `status === "pending_payment"` na idempotência bloqueava usuários retornantes — removido sessão 46 (commit `13384422`). **Regressão 3 (sessão 47):** o mesmo `status === "pending_payment"` existia no bloco de cancelamento ao trocar de plano — ao alternar annual↔monthly o payment antigo nunca era cancelado → acúmulo infinito de PENDING no Asaas. Fix: condição de DB status removida; agora verifica status real do payment via `GET /payments/{id}` antes de cancelar (commit `8e3b212`). |

---

## Features — Alta Prioridade

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| BK-01 | ~~Push notifications multi-dispositivo~~ | ✅ | **E2E validado em produção (sessão 36, 2026-06-21).** Implementação completa: SW, PushManager, `send-push-notification`, `send-medication-reminders` (±3 min), `send-appointment-reminders` (D-0/D-1 às 8h BRT), migration com pg_cron. Incidente de segurança (sessão 35): VAPID_PRIVATE_KEY exposta em JSDoc → chaves rotacionadas. E2E fix (sessão 36): par VAPID inconsistente pós-rotação → par regenerado via Node.js WebCrypto; contagem `sent` corrigida para ler APNs response body, não HTTP 200. Notificação "💊 Hora do Remédio!" chegando no iPhone com PWA fechado ✅. |
| A7-E2E | Testes E2E Playwright | 🔴 | Fluxos críticos: login, cadastro de medicamento, marcação de dose, pagamento |

---

## Features — Média Prioridade

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| BK-02 | Ciclos posológicos complexos | 🟡 | Anticoncepcional 21+7, pausa programada, reinício automático |
| BK-03 | OAuth Google / Apple | 🟡 | Login social para reduzir fricção no cadastro |
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
