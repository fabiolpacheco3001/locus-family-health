# Deploy — Correções de Segurança (Lovable Scanner)

> **Data:** junho/2026  
> **Itens corrigidos:**
> - 🔴 **Critical:** `family_group_members` INSERT policy — auto-assign de admin / adição de terceiros
> - 🟡 **Warning:** `system_configs` SELECT policy — exposição de configurações a todos os usuários

> ✅ Migrations já aplicadas no Supabase SQL Editor (confirmado).

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

---

## Passo 1 — Testar o fluxo de convite

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

**1.4 — Verificar no banco (opcional, mais rigoroso)**

No Supabase Dashboard → Table Editor → `family_group_members`:
```sql
SELECT auth_user_id, role, accepted_at
FROM family_group_members
ORDER BY accepted_at DESC
LIMIT 5;
```
O novo membro deve aparecer com `role = 'user'`.

### O que NÃO deve funcionar (teste de regressão de segurança)

> Estes testes confirmam que a vulnerabilidade foi fechada. São opcionais mas recomendados.

**Teste A — Self-assign de admin via SQL direto:**
No Supabase Dashboard → SQL Editor, conectado como usuário comum (não admin), tente:
```sql
INSERT INTO family_group_members (group_id, auth_user_id, role)
VALUES ('<id_do_grupo>', auth.uid(), 'admin');
```
**Resultado esperado:** `new row violates row-level security policy` (erro RLS).

**Teste B — Adicionar terceiro:**
```sql
INSERT INTO family_group_members (group_id, auth_user_id, role)
VALUES ('<id_do_grupo>', '<uuid_de_outra_pessoa>', 'user');
```
**Resultado esperado:** erro RLS — `auth_user_id` deve ser o próprio `auth.uid()`.

---

## Passo 2 — Commit e push

```bash
cd /Users/fabio/locus-family-health

git add \
  supabase/migrations/20260616000011_security_family_group_members_insert_policy.sql \
  supabase/migrations/20260616000012_security_system_configs_select_policy.sql \
  src/components/InviteAcceptInterceptor.tsx \
  src/pages/GestaoAcessos.tsx \
  DEPLOY_SEGURANCA_LOVABLE.md

git commit -m "Security: fix family_group_members INSERT policy + system_configs SELECT policy

Critical: policy 'Allow invitees to join group' reescrita com WITH CHECK
  - auth_user_id = auth.uid() (impede adicionar terceiros)
  - role = 'user' (impede auto-assign de admin)
Frontend: InviteAcceptInterceptor sempre insere role='user'
Frontend: GestaoAcessos remove seletor Admin/User do formulário de convite

Warning: system_configs SELECT policy substituída por duas:
  - Admins: acesso total
  - Usuários: apenas support_url e support_email"

git push origin main
```

---

## Passo 3 — Verificar que o Lovable scanner não reporta mais os itens

Após o push, abra o Lovable e aguarde o re-deploy automático. Então:

1. No Lovable, acesse **Database → Security Advisor** (ou onde o scanner está).
2. Reexecute o scan.
3. ✅ O item **Critical** sobre `family_group_members` não deve mais aparecer.
4. ✅ O item **Warning** sobre `system_configs` não deve mais aparecer.

> Se o scanner continuar reportando o Critical: confirme no SQL Editor que a migration 000011 foi aplicada. Execute:
> ```sql
> SELECT policyname, cmd, qual, with_check
> FROM pg_policies
> WHERE tablename = 'family_group_members' AND cmd = 'INSERT';
> ```
> A coluna `with_check` deve conter `auth_user_id = uid()` e `role = 'user'`.

---

## Resumo das migrations aplicadas nesta sessão

| Migration | Tabela | Tipo de fix |
|-----------|--------|-------------|
| `20260616000011` | `family_group_members` | INSERT policy: + `auth_user_id = auth.uid()` + `role = 'user'` |
| `20260616000012` | `system_configs` | SELECT policy: whitelist de chaves para usuários comuns |

---

*Gerado automaticamente pelo Claude (Cowork).*
