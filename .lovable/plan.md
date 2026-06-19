
# Plano: `test_mode` por usuário no fluxo Asaas

Permite que cada usuário seja roteado para **sandbox** ou **produção** do Asaas de forma independente, sem derrubar o ambiente produtivo.

---

## 1. Pré-requisito manual (você precisa fazer antes)

Adicionar as 4 secrets no Cloud → Secrets (eu **não** consigo criar — só você):

| Secret | Valor |
|---|---|
| `ASAAS_API_KEY_SANDBOX` | chave do sandbox |
| `ASAAS_API_URL_SANDBOX` | `https://sandbox.asaas.com/api/v3` |
| `ASAAS_API_KEY_PROD` | chave de produção |
| `ASAAS_API_URL_PROD` | `https://api.asaas.com/api/v3` |

As secrets atuais (`ASAAS_API_KEY`, `ASAAS_API_URL`) ficam intactas como fallback durante a transição. Nada quebra se as novas ainda não existirem — o helper de resolução cai no legado.

---

## 2. Migration (banco)

```sql
ALTER TABLE public.subscriptions
  ADD COLUMN test_mode boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_subscriptions_test_mode
  ON public.subscriptions(test_mode) WHERE test_mode = true;
```

Sem mudanças de RLS (coluna herda as políticas existentes). Trigger não é necessário.

---

## 3. Helper compartilhado novo

**`supabase/functions/_shared/asaas-env.ts`** (novo arquivo)

Exporta:
- `resolveAsaasEnv(testMode: boolean): { apiKey: string; apiUrl: string; env: "sandbox" | "prod" }`
- Lê primeiro `*_SANDBOX`/`*_PROD`; se ausente, cai em `ASAAS_API_KEY`/`ASAAS_API_URL` (compat).
- Lança erro genérico se nada estiver configurado.

Centraliza a lógica para evitar drift entre as 3 functions.

---

## 4. Edge functions

### `create-asaas-checkout/index.ts`
- Após `auth.getUser()`, ler `test_mode` via `adminClient.from("subscriptions").select("test_mode").eq("user_id", userId).maybeSingle()` (default `false` se row não existir).
- Substituir as leituras diretas de `ASAAS_API_KEY` / `ASAAS_API_URL` (incluindo `ASAAS_API_URL` no topo do módulo e `asaasFetch`) por chamada ao helper.
- `log("info", "asaas_env_selected", { env, userId, testMode })` antes da primeira chamada Asaas.
- Cuidado: `ASAAS_API_URL` hoje é constante de módulo lida no boot. Vai virar resolução por-request.

### `cancel-asaas-subscription/index.ts`
- Mesma leitura de `test_mode` da row da subscription do `userId`.
- Substituir `ASAAS_API_KEY` / `ASAAS_API_URL` pelo helper.
- Log idêntico de `asaas_env_selected`.

### `asaas-webhook/index.ts`
- **Não dá para inferir ambiente de forma 100% segura** a partir do payload do Asaas (não há flag oficial).
- Estratégia: usar `externalReference` (que é o `user_id`) → buscar `test_mode` da subscription e resolver credenciais com o helper para chamadas de leitura/confirmação.
- Para validação do token de webhook: manter `ASAAS_WEBHOOK_TOKEN` único (Asaas permite mesmo token nos dois ambientes; documentar).
- Se o webhook chegar sem `externalReference` mapeável → fallback para credenciais legadas + log `warn` `asaas_webhook_env_unknown`. Documentar como limitação conhecida.

---

## 5. Command Center — toggle admin

**`src/pages/command-center/Clientes.tsx`** (e/ou hook de listagem):
- Incluir `test_mode` no `SELECT` de clientes.
- Adicionar coluna/ação com `<Switch>` "Modo Teste".
- Ao alternar: `UPDATE subscriptions SET test_mode = $novo WHERE user_id = $id` via supabase client (RLS já permite admin via `get_admin_clients` / políticas existentes — confirmo na implementação; se não permitir, criar RPC `set_user_test_mode` `SECURITY DEFINER` com checagem `is_super_admin`).
- Badge visual `SANDBOX` (amarelo/laranja) ao lado do nome quando `test_mode = true`.
- Invalidar React Query cache do admin após toggle.

**Decisão a confirmar:** se RLS atual não permite UPDATE direto de admin em `subscriptions` de outro usuário, prefiro criar a RPC `set_user_test_mode(target_user_id uuid, enabled boolean)` para manter a regra de privilégio explícita.

---

## 6. Tela "Meu Plano"

**`src/pages/MeuPlano.tsx`**:
- Incluir `test_mode` no tipo `Subscription` (`src/hooks/useSubscription.ts`) — já vem do `select("*")`.
- Se `subscription?.test_mode === true`, renderizar `<Alert variant="warning">` discreto no topo: *"Conta em modo de teste (sandbox) — pagamentos não são reais."*

---

## 7. Tipos

Após a migration ser aprovada, o `src/integrations/supabase/types.ts` regenera automaticamente com `test_mode`. Só depois eu mexo no código TS que depende do campo.

---

## 8. Ordem de execução (build mode)

1. Migration (aguarda aprovação).
2. Helper `_shared/asaas-env.ts`.
3. Patch das 3 edge functions.
4. Toggle no Command Center (+ RPC se necessário).
5. Aviso na Meu Plano.
6. Validação: ler logs `asaas_env_selected` após você ativar `test_mode` num usuário de teste.

---

## Pontos que quero confirmar antes de codar

1. **RPC vs UPDATE direto** no toggle do admin — ok criar `set_user_test_mode` SECURITY DEFINER se RLS bloquear? (recomendo sim).
2. **Webhook**: aceito tratar como limitação documentada (resolver via `externalReference` quando possível, senão fallback legado)?
3. **Default `test_mode = false`** para todos os usuários existentes — confirmado? (qualquer usuário que já estava pagando continua em produção).
