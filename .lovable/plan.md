Antes de executar qualquer mudança, faça `git pull origin main` para garantir 

que você está na versão mais recente do repositório.

Os itens A4 (webauthn-challenge), A5 (webauthn-verify) e A6 (asaas-webhook) 

já foram corrigidos em commits anteriores (sessões 22-24). Verifique o estado 

atual desses arquivos antes de tocar neles. Se já estiverem com mensagens 

genéricas sem detalhes internos, marque como fixed sem editar o código.

Proceda com as correções dos itens genuinamente novos:

- A1: create-asaas-checkout/index.ts ~144 — remover userError?.message da resposta HTTP

- A2: manage-admins/index.ts ~226 — substituir (err as Error).message por mensagem genérica + log interno

- A3: publish-changelog/index.ts ~137 — substituir err.message por mensagem genérica

- B: pet_routines — ler policies atuais em pg_policies antes de criar migration para INSERT com ownership check

- C: email_unsubscribe_tokens e suppressed_emails — trocar TO public por TO service_role

Após deploy, marcar os internal_ids dos 6 findings como fixed via manage_security_finding.

Não alterar: helpers RLS (is_super_admin, is_group_admin, is_group_member, 

check_group_access, get_admin_clients, decrement_stock) — documentados como 

falso-positivos aceitos na @security-memory. Não alterar /seguranca trust page.