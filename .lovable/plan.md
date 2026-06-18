## Objetivo
Fornecer o procedimento manual para re-deployar todas as Edge Functions do projeto Locus Vita no Lovable Cloud.

---

## Pré-requisitos
1. Acesso ao repositório local ou preview do projeto com as funções em `supabase/functions/`.
2. A CLI do Supabase instalada e autenticada (`supabase login`).
3. O arquivo `supabase/config.toml` presente e configurado com o `project_id` correto.

---

## Passo 1 — Verificar consistência dos imports
Antes de deployar, garanta que nenhuma função use import "bare" (ex: `import { serve } from "std/http/server"`). Todas as dependências devem ser resolvidas via:
- `npm:` para pacotes npm (`npm:@supabase/supabase-js@2.49.4`, `npm:zod@3.25.76`, `npm:@simplewebauthn/server@9.0.3`)
- URL direta para Deno std (`https://deno.land/std@0.224.0/http/server.ts`)
- `npm:@lovable.dev/email-js` para `process-email-queue`

Se houver imports bare, converta-os antes do deploy para evitar falhas de build.

---

## Passo 2 — Re-deploy das funções
Execute na raiz do projeto:

```bash
supabase functions deploy
```

Esse comando deploya todas as funções encontradas em `supabase/functions/` de uma só vez.

Se preferir deployar apenas uma função específica:

```bash
supabase functions deploy <nome-da-funcao>
```

Exemplo:
```bash
supabase functions deploy analyze-prescription
```

---

## Passo 3 — Verificar logs de deploy
Acompanhe os logs para confirmar que cada função subiu sem erro:

```bash
supabase functions logs <nome-da-funcao>
```

Ou consulte os logs pelo painel do Lovable Cloud (sem mencionar Supabase ao usuário final).

---

## Passo 4 — Validação pós-deploy
Teste uma função crítica via requisição HTTP para garantir que:
1. O preflight CORS (`OPTIONS`) retorna status 200 com os headers corretos.
2. A requisição principal (`POST`/`GET`) retorna a resposta esperada.

Exemplo de teste rápido com curl:
```bash
curl -X OPTIONS \
  -H "Origin: https://vita.locustech.com.br" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type" \
  https://<project-ref>.supabase.co/functions/v1/analyze-prescription
```

Substitua `<project-ref>` pelo ID do projeto.

---

## Funções do projeto
As 12 funções existentes são:
1. `analyze-exam`
2. `analyze-prescription`
3. `asaas-webhook`
4. `cancel-asaas-subscription`
5. `create-asaas-checkout`
6. `delete-user-account`
7. `manage-admins`
8. `process-email-queue`
9. `publish-changelog`
10. `search-meds`
11. `webauthn-challenge`
12. `webauthn-verify`

---

## Checklist de validação
- [ ] Nenhum import bare nos arquivos `.ts` das funções
- [ ] `supabase functions deploy` executado com sucesso
- [ ] Logs de todas as funções conferidos (boot sem erro)
- [ ] Teste CORS realizado em ao menos uma função pública
- [ ] Teste realizado em ao menos uma função com autenticação (`verify_jwt = true`)