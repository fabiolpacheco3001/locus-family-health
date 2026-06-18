## Objetivo
Re-deploy das Edge Functions `webauthn-challenge` e `webauthn-verify` no Lovable Cloud, sem qualquer alteração de código. Caso o deploy falhe, diagnosticar a causa raiz e propor (não aplicar) a solução.

---

## Passos

### 1. Deploy direcionado
Executar `supabase--deploy_edge_functions` para as duas funções, em paralelo:
- `webauthn-challenge`
- `webauthn-verify`

### 2. Validação pós-deploy
- `supabase--edge_function_logs` em cada função para confirmar boot limpo (sem erros de import, sem `BootError`).
- `supabase--curl_edge_functions` com `OPTIONS` em `webauthn-challenge` para validar CORS (status 200 + headers).
- `supabase--curl_edge_functions` com `POST` mínimo em `webauthn-challenge` (sem auth → esperar 401 controlado, confirmando que o handler rodou).

### 3. Em caso de falha (diagnóstico, sem corrigir)
Investigar nas seguintes camadas, nesta ordem:
1. **Imports** — confirmar que `npm:@simplewebauthn/server@9.0.3`, `npm:@supabase/supabase-js@2.49.4` e `https://deno.land/std@0.224.0/http/server.ts` resolvem no edge-runtime.
2. **Shared modules** — `_shared/cors.ts` e `_shared/logger.ts` existem e exportam os símbolos usados.
3. **import_map.json** — verificar se há conflito entre o import_map declarado em `config.toml` e os imports diretos via URL/`npm:` no código.
4. **deno.lock** — se presente na pasta da função, pode estar incompatível com o edge-runtime (causa conhecida de 500 no deploy).
5. **Secrets** — `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` presentes.
6. **config.toml** — blocos `[functions.webauthn-challenge]` e `[functions.webauthn-verify]` com `verify_jwt = true` (já presentes).

Cada hipótese descartada será reportada com a evidência (log/arquivo). Ao isolar a causa raiz, apresentarei uma proposta de correção textual — **sem aplicar** — para sua aprovação.

---

## Não-escopo
- Nenhuma edição de código.
- Nenhuma alteração nas outras 10 Edge Functions.
- Nenhuma alteração em `config.toml`, `import_map.json` ou frontend.
