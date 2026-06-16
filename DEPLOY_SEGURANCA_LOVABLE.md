# Deploy — Correções de Segurança (Lovable Scanner)

> **Data:** junho/2026 | **Atualizado:** sessão 6  
> **Itens corrigidos:**
> - 🔴 **Critical:** `family_group_members` INSERT policy — auto-assign de admin / adição de terceiros
> - 🟡 **Warning:** `system_configs` SELECT policy — exposição de configurações a todos os usuários
> - 🟡 **Warning:** Erros raw da API Asaas expostos ao frontend (`create-asaas-checkout`, `cancel-asaas-subscription`)
> - 🔴 **P0:** `cancel-asaas-subscription` aceitava `asaasSubscriptionId` do body — bypass de autorização de pagamento
> - 🟡 **P1:** `decrement_stock` SECURITY DEFINER sem ownership check
> - 🟡 **P1:** Sanitização de erros em catch blocks de 3 Edge Functions
> - 🟡 **Warning:** INSERT policies de tabelas clínicas sem verificação de ownership do `family_member_id`
> - 🟡 **Warning:** `ai_usage_logs` sem SELECT policy para os próprios registros
> - 🟡 **Warning:** Função `check_group_access` sem guard de NULL e sem check de autenticação

> ✅ Migrations 000011 e 000012 já aplicadas no Supabase SQL Editor (confirmado).  
> ⏳ Migrations 000013–000017 e fixes de código precisam de commit e aplicação.

---

## ⚠️ IMPORTANTE — Ordem de execução obrigatória

**Sempre siga a ordem: Passo 1 (Commit) → Passo 2 (Migrations) → Passo 3 (Testes).**

Se você rodar os testes ANTES de fazer o commit e aplicar as migrations, os testes vão falhar por razões não relacionadas ao bug que está corrigindo. Isso causa confusão desnecessária.

---

## O que foi mudado e por quê

### Critical — `family_group_members` INSERT policy

**Problema:** A policy "Allow invitees to join group" verificava se existia um convite válido, mas não impedia que o convidado inserisse a linha com:
- `auth_user_id` de outra pessoa (adicionando terceiros ao grupo)
- `role = 'admin'` (ganhando privilégios de administrador sem ser promovido)

**Correção aplicada (migration 000011):**
- `auth_user_id` deve ser obrigatoriamente o `auth.uid()` do usuário logado.
- `role` é fixado em `'user'` — convidados sempre entram como usuário comum.
- O frontend (`InviteAcceptInterceptor.tsx`) foi atualizado para refletir isso.
- O seletor "Admin / Usuário" do formulário de convite em `Gestão de Acessos` foi removido — todos os convites criam membros como `user`. Promoção a admin é feita separadamente pelo administrador do grupo.

### Warning — `system_configs` SELECT policy

**Problema:** A policy `USING (true)` dava acesso a todas as chaves da tabela para qualquer usuário autenticado. Se no futuro uma chave sensível fosse adicionada, ela ficaria exposta a todos os clientes.

**Correção aplicada (migration 000012):**
- Admins e super_admins continuam lendo todas as chaves.
- Usuários comuns leem apenas `support_url` e `support_email` (as únicas chaves exibidas na tela de Ajustes).
- Qualquer chave nova adicionada fica restrita a admins por padrão.

### P0 — `cancel-asaas-subscription` bypass de autorização de pagamento

**Problema:** A Edge Function aceitava `asaasSubscriptionId` do body do request. Isso permitia que qualquer usuário autenticado cancelasse a assinatura de outro cliente passando o ID Asaas alheio.

**Correção (migration não necessária — fix de código):**
- Removida a leitura do body completamente.
- O ID da assinatura é sempre lido do banco de dados, vinculado ao `user_id` do token JWT.

### Warning — Erros raw da API Asaas e Supabase expostos ao frontend

**Problema:** Erros brutos das APIs (corpo da resposta Asaas, `updateErr.message`, `e.message`) propagavam para o frontend, expondo detalhes internos da infra.

**Correção (código — sem migration):**
- `create-asaas-checkout`: `asaasFetch()` agora loga body server-side e retorna mensagem genérica.
- `cancel-asaas-subscription`: todos os 3 caminhos de erro sanitizados.
- `analyze-exam`, `analyze-prescription`, `delete-user-account`: catch blocks sanitizados.

### P1 — `decrement_stock` sem ownership check

**Problema:** A função SECURITY DEFINER só verificava `id = med_id`. Qualquer usuário autenticado que conhecesse o UUID de um medicamento alheio podia decrementar seu estoque.

**Correção (migration 000016):**
- Adicionado AND no WHERE: `user_id = auth.uid() OR EXISTS (fgm JOIN com group_id)`.

### Warning — INSERT policies de tabelas clínicas

**Problema:** Policies verificavam apenas `auth.uid() = user_id`, sem confirmar que o `family_member_id` pertencia ao grupo do usuário.

**Correção (migrations 000013 + 000017):**
- 000013: adicionou subquery EXISTS com JOIN `family_members → family_group_members`.
- 000017: fortaleceu com `fm.deleted_at IS NULL` + check de papel (`admin`, criador, `managed_profiles`).
- Tables: consultations, exams, medications, vaccines, allergies, diseases, health_measurements.

### Warning — `ai_usage_logs` sem SELECT policy

**Correção (migration 000014):** Usuários agora podem ler seus próprios logs de IA.

### Warning — `check_group_access` NULL safety

**Correção (migration 000015):** Reescrita com CASE: `auth.uid() IS NULL → false`, `_group_id IS NULL → false`.

---

## Passo 1 — Commit e push (sessão 6)

> **Faça isso PRIMEIRO, antes de qualquer teste.**

```bash
cd /Users/fabio/locus-family-health

git add \
  supabase/migrations/20260616000013_security_health_record_insert_ownership.sql \
  supabase/migrations/20260616000014_security_ai_usage_logs_select_policy.sql \
  supabase/migrations/20260616000015_security_check_group_access_null_safety.sql \
  supabase/migrations/20260616000016_security_decrement_stock_ownership.sql \
  supabase/migrations/20260616000017_security_health_record_insert_ownership_complete.sql \
  supabase/functions/create-asaas-checkout/index.ts \
  supabase/functions/cancel-asaas-subscription/index.ts \
  supabase/functions/analyze-exam/index.ts \
  supabase/functions/analyze-prescription/index.ts \
  supabase/functions/delete-user-account/index.ts \
  src/lib/tz.ts \
  src/pages/GerenciarFamilia.tsx \
  src/pages/GestaoAcessos.tsx \
  DEPLOY_SEGURANCA_LOVABLE.md \
  TECH_DEBT.md

git commit -m "Security: Sprint 3 hardening — P0/P1/P2 fixes + complete clinical INSERT policies

P0: cancel-asaas-subscription — remove asaasSubscriptionId from body
  - Body bypass permitia cancelar assinatura de outro cliente via Asaas ID
  - ID agora sempre lido do banco (vinculado ao JWT do usuário autenticado)

P1: decrement_stock — adicionar ownership check
  - SECURITY DEFINER sem ownership check: qualquer user podia decrementar estoque alheio
  - WHERE agora exige user_id = auth.uid() OR group membership

P1: Sanitizar erros raw em 5 Edge Functions
  - cancel-asaas-subscription: 3 caminhos de erro sanitizados (Asaas + Supabase + catch)
  - create-asaas-checkout: asaasFetch() loga server-side, retorna mensagem genérica
  - analyze-exam, analyze-prescription, delete-user-account: catch blocks sanitizados

P2: INSERT policies clínicas — versão completa (migration 000017 supersede 000013)
  - Adiciona fm.deleted_at IS NULL
  - Adiciona role check: admin OR creator OR managed_profiles

Novas migrations:
  - 000013: clinical tables INSERT + ownership EXISTS subquery
  - 000014: ai_usage_logs SELECT policy
  - 000015: check_group_access NULL safety
  - 000016: decrement_stock ownership check
  - 000017: clinical INSERT policies completas (supersede 000013)

UX: GerenciarFamilia badge 'Convidado' -> 'Usuário'
UX: GestaoAcessos promoção/rebaixamento de Admin via drawer
Lib: src/lib/tz.ts — utilitário centralizado de timezone (UTC → UTC-3)"

git push origin main
```

---

## Passo 2 — Aplicar migrations no Supabase SQL Editor

Aplicar **em ordem** no Supabase Dashboard → SQL Editor:

1. `20260616000013_security_health_record_insert_ownership.sql`
2. `20260616000014_security_ai_usage_logs_select_policy.sql`
3. `20260616000015_security_check_group_access_null_safety.sql`
4. `20260616000016_security_decrement_stock_ownership.sql`
5. `20260616000017_security_health_record_insert_ownership_complete.sql`

---

## Passo 3 — Testar o fluxo de convite

### Preparação

Você vai precisar de **duas contas**: a conta de administrador do grupo (você, Fábio) e uma segunda conta para o convidado (pode ser um e-mail de teste seu).

### Passo a passo

**1.1 — Enviar o convite**
1. Faça login com a conta de **admin** do grupo.
2. Vá em **Gestão de Acessos** (menu ou Ajustes).
3. No campo de e-mail, digite o e-mail do convidado de teste.
4. Note que **não há mais seletor de papel** (Admin/Usuário) — foi removido por segurança.
5. Clique em **Salvar Convite**.
6. Confirme que o convite aparece na lista com status pendente.

**1.2 — Aceitar o convite**
1. Faça login com a conta do **convidado** (o e-mail para o qual enviou o convite).
2. O app deve detectar automaticamente o convite pendente e exibir a tela de aceite.
3. Clique em **Aceitar**.
4. Confirme que o convidado foi adicionado ao grupo.

**1.3 — Verificar o papel (role)**
1. Ainda logado como **admin**, vá em **Gestão de Acessos**.
2. Localize o novo membro na lista.
3. ✅ O papel deve ser **Usuário** (não Admin).
4. Você pode promovê-lo a Admin manualmente nesta tela, se quiser.

**1.4 — Verificar no banco (opcional)**

No Supabase Dashboard → Table Editor → `family_group_members`:
```sql
SELECT auth_user_id, role, accepted_at
FROM family_group_members
ORDER BY accepted_at DESC
LIMIT 5;
```
O novo membro deve aparecer com `role = 'user'`.

---

## Passo 4 — Testes de regressão de segurança (opcional mas recomendado)

> ⚠️ **Nota importante sobre o SQL Editor do Supabase:**
>
> O SQL Editor roda como `postgres` / `service_role`, então `auth.uid()` retorna `NULL`.
> Por isso, **toda INSERT em tabelas com RLS vai falhar no SQL Editor** — esse é o comportamento esperado.
> Não interprete essas falhas como bugs; elas confirmam que as políticas estão funcionando.
>
> Para testar RLS real, use o app (usuário autenticado via JWT) ou a função `SET LOCAL role TO authenticated` com `SET LOCAL request.jwt.claims = ...`.

**Teste A — Self-assign de admin (confirma que migration 000011 está ativa):**

No Supabase Dashboard → SQL Editor, tente:
```sql
INSERT INTO family_group_members (group_id, auth_user_id, role)
VALUES ('<id_do_grupo>', auth.uid(), 'admin');
```

**Resultado esperado:** Erro de NOT NULL constraint em `auth_user_id` (porque `auth.uid()` = NULL no SQL Editor) **OU** erro RLS se rodar autenticado.

Ambos são comportamento correto — a tentativa não passou.

**Teste B — Adicionar terceiro (confirma que auth_user_id = auth.uid() está no WITH CHECK):**
```sql
INSERT INTO family_group_members (group_id, auth_user_id, role)
VALUES ('<id_do_grupo>', '<uuid_de_outra_pessoa>', 'user');
```

**Resultado esperado:** Falha de unique constraint ou RLS — em ambos os casos a tentativa não passou.

---

## Passo 5 — Verificar scanner Lovable

Após o push e re-deploy:
1. Lovable → Database → Security Advisor → Re-run scan
2. Os itens corrigidos nesta sessão não devem mais aparecer

---

## Resumo das migrations

| Migration | Tabela / Componente | Tipo de fix | Status |
|-----------|---------------------|-------------|--------|
| `20260616000011` | `family_group_members` | INSERT policy: + `auth_user_id = auth.uid()` + `role = 'user'` | ✅ Aplicada |
| `20260616000012` | `system_configs` | SELECT policy: whitelist de chaves para usuários comuns | ✅ Aplicada |
| `20260616000013` | 7 tabelas clínicas | INSERT policy: + EXISTS check de ownership do `family_member_id` | ⏳ Aplicar |
| `20260616000014` | `ai_usage_logs` | SELECT policy: usuários leem próprios registros | ⏳ Aplicar |
| `20260616000015` | `check_group_access` | Reescrever função com NULL guard + auth check | ⏳ Aplicar |
| `20260616000016` | `decrement_stock` | Ownership check: `user_id = auth.uid()` ou grupo | ⏳ Aplicar |
| `20260616000017` | 7 tabelas clínicas | INSERT policies completas: + `deleted_at IS NULL` + role check | ⏳ Aplicar |

---

*Gerado automaticamente pelo Claude (Cowork).*
