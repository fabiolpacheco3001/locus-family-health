## Objetivo
Re-deploy de `webauthn-challenge` e `webauthn-verify`. Diagnosticar (sem corrigir) se falhar.

## Passos
1. `supabase--deploy_edge_functions(["webauthn-challenge","webauthn-verify"])`
2. `supabase--edge_function_logs` em ambas para confirmar boot limpo
3. `supabase--curl_edge_functions` POST sem auth em `webauthn-challenge` (esperar 401 controlado)
4. Se falhar: investigar imports (`npm:@simplewebauthn/server@9.0.3`, `npm:@supabase/supabase-js@2.49.4`, `std@0.224.0`), `_shared/cors.ts` e `_shared/logger.ts`, `import_map.json`, `deno.lock`, secrets (APP_ORIGIN, SUPABASE_*). Reportar evidência e propor correção textual sem aplicar.

## Não-escopo
Nenhuma edição de código. Nenhuma alteração nas outras 10 functions.
