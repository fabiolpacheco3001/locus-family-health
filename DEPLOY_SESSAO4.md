# Deploy — Sessão 4 (Sprint 3 completo)

> **Data:** junho/2026  
> **Sprint:** 3 — Go-live readiness  
> **Itens implementados:** A1 (CORS restrito), A4 (Rate limiting IA), C10 (Preços centralizados)

---

## 1. Commit e push

```bash
cd /caminho/para/locus-family-health

git add \
  supabase/functions/_shared/cors.ts \
  supabase/functions/_shared/rate-limit.ts \
  supabase/functions/analyze-prescription/index.ts \
  supabase/functions/analyze-exam/index.ts \
  supabase/functions/cancel-asaas-subscription/index.ts \
  supabase/functions/create-asaas-checkout/index.ts \
  supabase/functions/asaas-webhook/index.ts \
  supabase/functions/delete-user-account/index.ts \
  supabase/functions/manage-admins/index.ts \
  supabase/functions/publish-changelog/index.ts \
  supabase/functions/search-meds/index.ts \
  src/lib/planConfig.ts \
  src/components/PaywallModal.tsx \
  src/pages/MeuPlano.tsx \
  src/pages/Ajustes.tsx \
  src/pages/Landing.tsx \
  src/hooks/useAiStatus.ts \
  TECH_DEBT.md \
  DEPLOY_SESSAO4.md

git commit -m "Sprint 3: CORS restrito (A1) + Rate limiting IA (A4) + Preços centralizados (C10)

A1: _shared/cors.ts com APP_ORIGIN env var; asaas-webhook sem CORS (server-to-server)
A4: _shared/rate-limit.ts fail-closed; 10 calls/hora por usuário; useAiStatus fail-closed
C10: planConfig.ts SSOT frontend; PLAN_MONTHLY/ANNUAL_PRICE/THRESHOLD env vars backend"

git push origin main
```

---

## 2. Secrets a configurar no Supabase Dashboard

> **Supabase Dashboard → Project → Edge Functions → Secrets**

### Novos secrets (adicionar se ainda não existirem)

| Secret | Valor | Descrição |
|--------|-------|-----------|
| `APP_ORIGIN` | `https://seu-dominio.com` | CORS whitelist — substituir pelo domínio real de produção |
| `AI_CALLS_PER_HOUR` | `10` | Limite de chamadas de IA por usuário/hora (ajustar conforme custo) |
| `PLAN_MONTHLY_PRICE` | `19.90` | Preço mensal em decimal (sem R$) |
| `PLAN_ANNUAL_PRICE` | `191.00` | Preço anual em decimal (sem R$) |
| `PLAN_ANNUAL_THRESHOLD` | `150` | Valor mínimo para classificar pagamento como plano anual no webhook |

> ⚠️ Se `APP_ORIGIN` não for configurado, o CORS mantém o fallback `"*"` (compatível com previews Lovable). Configure antes do go-live em produção.

---

## 3. Re-deploy das Edge Functions

Após configurar os secrets, faça re-deploy de todas as funções para que as novas variáveis de ambiente sejam carregadas:

```bash
# Via Supabase CLI (se configurado localmente)
supabase functions deploy

# Ou via Lovable: Supabase → Edge Functions → Deploy each function
```

Funções que precisam de re-deploy obrigatório (novas dependências de env var):
- `analyze-prescription` — usa `_shared/rate-limit.ts` e `_shared/cors.ts`
- `analyze-exam` — usa `_shared/rate-limit.ts` e `_shared/cors.ts`
- `create-asaas-checkout` — usa `PLAN_MONTHLY_PRICE` e `PLAN_ANNUAL_PRICE`
- `asaas-webhook` — usa `PLAN_ANNUAL_THRESHOLD`
- Demais funções (atualização de import do `_shared/cors.ts`)

---

## 4. Checklist de testes manuais

### A1 — CORS restrito

- [ ] **Teste de origin bloqueada:** No DevTools (Postman ou curl), fazer request para uma Edge Function com header `Origin: https://site-malicioso.com`. Deve retornar `Access-Control-Allow-Origin: <APP_ORIGIN>` (não o site malicioso).
- [ ] **Teste de origin permitida:** Request da app em produção deve funcionar normalmente.
- [ ] **Lovable preview:** Confirmar que previews do Lovable continuam funcionando (enquanto `APP_ORIGIN` não estiver configurado, o fallback `"*"` garante isso).
- [ ] **asaas-webhook:** Confirmar que webhook do Asaas continua funcionando (não tem CORS — server-to-server).

### A4 — Rate limiting IA

- [ ] **Teste de limite atingido:** Fazer 11 análises de receita/exame seguidas com o mesmo usuário. A 11ª deve retornar HTTP 429 com mensagem em português.
- [ ] **Teste de recuperação:** Aguardar 1h ou consultar tabela `ai_usage_logs` e verificar que o contador reseta após 1 hora.
- [ ] **Teste fail-closed:** Simular erro de DB (ex: revogar acesso à `ai_usage_logs` temporariamente) — a IA deve bloquear, não deixar passar.
- [ ] **`useAiStatus`:** Simular erro na tabela `system_settings` — confirmar que a UI bloqueia o botão de IA (não libera).

### C10 — Preços centralizados

- [ ] **PaywallModal:** Abrir o Paywall (testar com conta trial expirado) — preços exibidos: `R$ 19,90` (mensal) e `R$ 191,00` (anual).
- [ ] **Landing page:** Seção de preços mostra `R$ 19,90/mês` e `R$ 191,00/ano` com desconto calculado dinamicamente.
- [ ] **Meu Plano:** Tela de plano ativo exibe o valor correto para plano mensal e anual.
- [ ] **Ajustes:** Cards de plano exibem os preços corretos.
- [ ] **Checkout Asaas:** Criar nova assinatura de teste — confirmar que o valor cobrado no Asaas bate com o env var (não com hardcoded).
- [ ] **Webhook Asaas:** Verificar em produção que pagamentos anuais (≥ R$150) continuam sendo classificados como `plan_type = "annual"`.

---

## 5. Tabelas / migrations desta sessão

**Nenhuma migration nova nesta sessão.** Apenas código (Edge Functions e frontend).

> ⚠️ Migration da sessão 3 ainda pendente se não foi aplicada:
> `supabase/migrations/20260616000010_lgpd_consent_log_revoke.sql`  
> Aplique no Supabase SQL Editor antes do go-live.

---

## 6. Resumo do estado do projeto

| Sprint | Status | Itens |
|--------|--------|-------|
| Sprint 1 — Segurança e integridade | ✅ CONCLUÍDO | C1, C2+C9, C4, C5, C6, C11, A10, A11, M15, M16, B7 |
| Sprint 2 — Compliance LGPD | ✅ CONCLUÍDO | C8, C7+A14, C3, A2, M14, A15 |
| Sprint 3 — Go-live readiness | ✅ CONCLUÍDO | A1, A4, C10 |
| Sprint 4 — Qualidade e performance | ⬜ Backlog | A5 Fase 2, A6, A7, A13, M5, M6, M7, B5 |

**O projeto está tecnicamente pronto para go-live** após configuração dos secrets e aplicação da migration 000010 (se pendente).

---

*Gerado automaticamente pelo Claude (Cowork) ao final da sessão 4.*
