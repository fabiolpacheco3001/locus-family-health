# Locus Vita — Infraestrutura: Secrets & Edge Functions

> **Versão:** 1.2 | **Atualizado em:** 2026-07-01  
> Referência operacional para configuração do ambiente e manutenção das Edge Functions Supabase.  
> ⚠️ **Nunca** versionar valores reais de secrets. Use o painel Lovable Cloud → Settings → Secrets.

---

## 1. Secrets (Variáveis de Ambiente)

Configuradas em **Lovable Cloud → Settings → Secrets** (propagadas automaticamente para todas as Edge Functions via `Deno.env.get()`).

### 1.1 Pagamentos — Asaas

| Secret | Descrição | Onde obter |
|--------|-----------|-----------|
| `ASAAS_API_KEY_PROD` | Chave de API do Asaas em **produção** | Asaas → Configurações → API → Chaves |
| `ASAAS_API_URL_PROD` | URL base da API Asaas produção | `https://api.asaas.com/v3` |
| `ASAAS_API_KEY_SANDBOX` | Chave de API do Asaas em **sandbox** (testes) | Asaas → Sandbox → Configurações → API |
| `ASAAS_API_URL_SANDBOX` | URL base da API Asaas sandbox | `https://api-sandbox.asaas.com/v3` |
| `ASAAS_WEBHOOK_TOKEN` | Token de autenticação do webhook Asaas | Asaas → Configurações → Webhooks → Token (definir valor único e seguro) |

> **Seleção automática de ambiente:** A Edge Function `asaas-webhook` detecta o modo (prod/sandbox) pela coluna `subscriptions.test_mode`. As outras funções usam `ASAAS_API_KEY_PROD` / `ASAAS_API_URL_PROD` por padrão, com fallback para sandbox quando `test_mode = true`.

---

### 1.2 E-mail Transacional — Resend

| Secret | Descrição | Onde obter |
|--------|-----------|-----------|
| `RESEND_API_KEY` | Chave de API do Resend para envio de e-mails transacionais | resend.com → API Keys → Create API Key |

> **Pré-requisito:** O domínio `locustech.com.br` deve estar **verificado** no Resend (DNS SPF/DKIM configurados). Atualmente verificado com remetente `noreply@locustech.com.br`.

---

### 1.3 IA & OCR — Gemini

| Secret | Descrição | Onde obter |
|--------|-----------|-----------|
| `GEMINI_API_KEY` | Chave de API do Google Gemini para OCR de receitas e laudos | console.cloud.google.com → APIs & Services → Credentials |

---

### 1.4 Observabilidade — Sentry

| Secret | Descrição | Onde obter |
|--------|-----------|-----------|
| `SENTRY_DSN` | DSN do projeto Sentry para captura de erros em Edge Functions | sentry.io → Settings → Projects → [projeto] → Client Keys (DSN) |

> **Frontend:** O DSN do frontend é configurado via variável de ambiente Vite (`VITE_SENTRY_DSN`) no painel Lovable → Environment Variables (não Secrets).

---

### 1.5 Plataforma Lovable

| Secret | Descrição | Onde obter |
|--------|-----------|-----------|
| `LOVABLE_API_KEY` | Chave interna da Lovable (gerenciada automaticamente) | **Não editar** — provisionado pelo sistema Lovable |

---

### 1.6 Configuração da Aplicação

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `APP_URL` | URL pública completa do app incluindo path de entrada | `https://vita.locustech.com.br/home` |
| `APP_ORIGIN` | Origem do app sem path (para CORS e OCR) | `https://vita.locustech.com.br` |
| `EMAIL_HASH_SALT` | Salt para hashing de e-mails em `email_unsubscribe_tokens` | String aleatória ≥ 32 chars |

---

### 1.7 Precificação (lidos pelas Edge Functions de checkout)

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `PLAN_MONTHLY_PRICE` | Valor em reais do plano mensal | `19.90` |
| `PLAN_ANNUAL_PRICE` | Valor em reais do plano anual | `191.00` |
| `PLAN_ANNUAL_THRESHOLD` | Mínimo de meses para considerar plano anual vantajoso | `12` |

---

### 1.8 Rate Limiting de IA

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `AI_CALLS_PER_HOUR` | Limite de chamadas IA por usuário por hora | `10` |

---

### 1.9 Web Push — VAPID (BK-01) ✅ CONFIGURADO E VALIDADO EM PRODUÇÃO

| Secret | Descrição | Valor / Como obter |
|--------|-----------|-------------------|
| `VAPID_PUBLIC_KEY` | Chave pública VAPID (P-256). **⚠️ Deve bater exatamente com `pushConfig.ts`** | Ver `src/lib/pushConfig.ts` — não versionar em docs |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID (P-256, base64url raw). **⚠️ Nunca versionar** | Apenas no Supabase Dashboard → Secrets |
| `VAPID_SUBJECT` | Identificador do remetente (mailto) exigido pelo Web Push Protocol | `mailto:suporte@locustech.com.br` |
| `CRON_SECRET` | Token de autenticação para pg_cron chamar Edge Functions sem JWT. Gerar com `openssl rand -hex 32` | Apenas no Supabase Dashboard → Secrets |

> **⚠️ Consistência do par VAPID é crítica.** `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no Supabase Secrets **devem ser do MESMO par P-256 gerado em uma única execução**. Se as chaves forem de pares distintos (erro silencioso comum ao fazer rotação parcial), o APNs retorna `BadJwtToken (403)` ou `VapidPkHashMismatch (400)` — nenhuma notificação chega. Incidentes: 2026-06-21 (sessão 36) e 2026-07-01 (sessão 69).
>
> **Rotação de chaves — procedimento obrigatório:**
> ```
> 1. Gerar novo par completo: npx web-push generate-vapid-keys
>    (⚠️ NÃO usar Node.js WebCrypto manual — gera tipo ECDH, não ECDSA VAPID-compatível)
> 2. Atualizar VAPID_PUBLIC_KEY nos Supabase Secrets com a nova public key
> 3. Atualizar VAPID_PRIVATE_KEY nos Supabase Secrets com a nova private key
>    (⚠️ Ambas na MESMA operação — não atualizar uma sem a outra)
> 4. Atualizar src/lib/pushConfig.ts com a nova public key
> 5. Commit + push
> 6. Limpar subscriptions inativas do banco (is_active = false)
> 7. Aguardar usuários reabrirem o app — usePushSubscription detecta mismatch e re-subscreve automaticamente
> ```
> Guardar backup em cofre seguro (1Password, Bitwarden). Edge Function `send-push-notification` lê os Secrets em runtime — nenhum redeploy necessário.

> **CRON_SECRET:** Após configurar o secret no Supabase Dashboard, executar no SQL Editor:
> ```sql
> ALTER DATABASE postgres SET app.settings.cron_secret = '<valor>';
> SELECT pg_reload_conf();
> ```
> Em seguida ativar os pg_cron jobs (SQL comentado em `supabase/migrations/20260621120000_push_notifications.sql`).

---

## 2. Edge Functions

Todas as funções estão em `supabase/functions/` e deployadas via Lovable Cloud. JWT verificado por padrão (`verify_jwt = true`) salvo exceção explícita.

---

### 2.1 Financeiro — Asaas

#### `create-asaas-checkout`
- **Propósito:** Cria um pagamento avulso no Asaas (modelo "Spotify" — sem objeto de assinatura recorrente). Retorna URL de checkout Asaas.
- **Chamado por:** `asaasService.createSubscription()` no frontend (MeuPlano, Ajustes, Cadastro)
- **Secrets necessários:** `ASAAS_API_KEY_PROD`, `ASAAS_API_URL_PROD`, `ASAAS_API_KEY_SANDBOX`, `ASAAS_API_URL_SANDBOX`
- **Observações:** Busca CPF, telefone, CEP e número do endereço do perfil familiar para preencher `creditCardHolderInfo` no Asaas. Cria ou reutiliza cliente Asaas via `asaas_customer_id` na tabela `subscriptions`.

#### `cancel-asaas-subscription`
- **Propósito:** Cancela a assinatura do usuário. Para assinaturas legadas (com `asaas_subscription_id`), deleta o objeto no Asaas. Para assinaturas novas (pagamento avulso), apenas atualiza o status local.
- **Chamado por:** `MeuPlano.tsx → handleCancelSubscription()`
- **Secrets necessários:** `ASAAS_API_KEY_PROD`, `ASAAS_API_URL_PROD`, `ASAAS_API_KEY_SANDBOX`, `ASAAS_API_URL_SANDBOX`
- **Segurança:** `verify_jwt = true`. Usa `user_id` do JWT — só o dono da assinatura pode cancelar.

#### `asaas-webhook`
- **Propósito:** Recebe notificações de pagamento do Asaas (PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, etc.) e atualiza a tabela `subscriptions` (status, `next_billing_date`, `credit_card_token`).
- **URL configurada no Asaas:** `https://[supabase-project].supabase.co/functions/v1/asaas-webhook`
- **Secrets necessários:** `ASAAS_WEBHOOK_TOKEN`, `ASAAS_API_KEY_PROD`, `ASAAS_API_URL_PROD`
- **⚠️ Segurança:** `verify_jwt = false` (webhook público). Valida `ASAAS_WEBHOOK_TOKEN` manualmente no header `asaas-access-token`.

#### `generate-renewal-charge`
- **Propósito:** Cron job que verifica assinaturas com `next_billing_date` próxima e gera nova cobrança avulsa no Asaas para renovação automática.
- **Trigger:** `pg_cron` (tabela `cron_job_log`)
- **Secrets necessários:** `ASAAS_API_KEY_PROD`, `ASAAS_API_URL_PROD`, `ASAAS_API_KEY_SANDBOX`, `ASAAS_API_URL_SANDBOX`

#### `retry-renewal-failures`
- **Propósito:** Reprocessa cobranças de renovação que falharam (tabela `renewal_failures`). Tenta até 3 vezes em intervalos de 4h.
- **Trigger:** `pg_cron` (a cada 4h)
- **Secrets necessários:** `ASAAS_API_KEY_PROD`, `ASAAS_API_URL_PROD`

---

### 2.2 E-mail Transacional

#### `send-invite-email`
- **Propósito:** Envia e-mail de convite para novo membro do grupo familiar via **Resend API**. Chamado automaticamente após INSERT em `group_invites` ou via reenvio manual.
- **Chamado por:** `GestaoAcessos.tsx → sendInviteEmail()` e `handleResendInviteEmail()`
- **Body:** `{ invite_id: string }`
- **Secrets necessários:** `RESEND_API_KEY`, `APP_URL`
- **Segurança:** `verify_jwt = true`. Valida que o caller é o `invited_by` do convite ou admin do grupo.
- **Remetente:** `noreply@locustech.com.br` (domínio verificado no Resend)

#### `process-email-queue`
- **Propósito:** Processa a fila PGMQ `transactional_emails` para envio de e-mails gerais (legado). Atualmente em standby — fluxo de convite usa `send-invite-email` diretamente.
- **Trigger:** `pg_cron`
- **Secrets necessários:** `LOVABLE_API_KEY`
- **⚠️ Nota:** O sistema de e-mail Lovable (`sendLovableEmail`) retorna 403 para o domínio `locustech.com.br`. Qualquer novo envio transacional deve usar Resend via `send-invite-email` como template.

---

### 2.3 IA & OCR

#### `analyze-prescription`
- **Propósito:** Recebe imagem de receita médica, chama Gemini (via Lovable AI Gateway) para extrair medicamentos, posologia e instruções em JSON estruturado.
- **Chamado por:** `AiMedicationUpload.tsx`
- **Secrets necessários:** `GEMINI_API_KEY`, `APP_ORIGIN`, `AI_CALLS_PER_HOUR`
- **Rate limiting:** Verifica `ai_usage_logs` para limitar chamadas por usuário/hora.

#### `analyze-exam`
- **Propósito:** Recebe imagem/PDF de exame laboratorial e extrai resultados em JSON via Gemini.
- **Chamado por:** `AddExamDrawer.tsx`
- **Secrets necessários:** `GEMINI_API_KEY`, `APP_ORIGIN`, `AI_CALLS_PER_HOUR`

#### `search-meds`
- **Propósito:** Busca medicamentos por nome em base de dados pública para autocompletar o campo de medicamento no cadastro.
- **Chamado por:** `AddMedicationDrawer.tsx`
- **Secrets necessários:** nenhum secret externo (query no banco local)

---

### 2.4 Autenticação — WebAuthn / Passkeys

#### `webauthn-challenge`
- **Propósito:** Gera desafio WebAuthn para registro ou autenticação de passkey (FIDO2). Armazena challenge temporário em `webauthn_challenges`.
- **Chamado por:** `usePasskeys.tsx → registerPasskey()` e `authenticatePasskey()`
- **Secrets necessários:** nenhum externo (usa `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` automáticos)
- **Libs:** `@simplewebauthn/server@9.0.3`

#### `webauthn-verify`
- **Propósito:** Verifica a resposta WebAuthn do dispositivo e registra ou valida a passkey do usuário.
- **Chamado por:** `usePasskeys.tsx` e `authenticatePasskey()`
- **Secrets necessários:** nenhum externo
- **Libs:** `@simplewebauthn/server@9.0.3`

---

### 2.5 Push Notifications — Web Push VAPID (BK-01)

#### `send-push-notification`
- **Propósito:** Sender genérico VAPID. Recebe `user_id + payload`, busca todos os dispositivos ativos em `push_subscriptions` e envia via `npm:web-push`. Auto-desativa endpoints expirados (HTTP 410/404).
- **Chamado por:** `send-medication-reminders`, `send-appointment-reminders`, e futuramente qualquer feature que precise enviar push
- **Body:** `{ user_id, title, body, url?, type?, tag?, icon?, data? }`
- **Secrets necessários:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`
- **⚠️ Segurança:** `verify_jwt = false`. Aceita JWT de usuário autenticado **ou** `Bearer <CRON_SECRET>`. Chamadas externas sem um dos dois retornam 401.

#### `send-medication-reminders`
- **Propósito:** Verifica medicamentos ativos com horários `specific_times` / `specific_days` / `fixed_interval` que coincidem com a janela de ±3 minutos do momento atual (horário de Brasília) e aciona `send-push-notification` para cada responsável.
- **Trigger:** `pg_cron` a cada 5 minutos via `net.http_post`
- **Secrets necessários:** `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **⚠️ Segurança:** `verify_jwt = false`. Valida `Bearer <CRON_SECRET>` manualmente.

#### `send-appointment-reminders`
- **Propósito:** Dispara push para consultas, exames e vacinas do dia atual (D-0) e do dia seguinte (D-1). Roda uma vez ao dia às 8h BRT (11h UTC).
- **Trigger:** `pg_cron` `0 11 * * *` via `net.http_post`
- **Secrets necessários:** `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **⚠️ Segurança:** `verify_jwt = false`. Valida `Bearer <CRON_SECRET>` manualmente.

---

### 2.6 Administração

#### `manage-admins`
- **Propósito:** Promove ou rebaixa usuários para `super_admin` / `admin` na tabela `user_roles`. Restrito a `super_admin`.
- **Chamado por:** Command Center → `/command-center/admins`
- **Secrets necessários:** nenhum externo

#### `publish-changelog`
- **Propósito:** Insere ou atualiza entradas de changelog na tabela `changelogs`. Restrito a `super_admin`.
- **Chamado por:** Command Center → `/command-center/changelog`
- **Secrets necessários:** nenhum externo

#### `delete-user-account`
- **Propósito:** Deleta permanentemente a conta do usuário autenticado: remove dados de `family_members`, `family_group_members`, `subscriptions` e o usuário em `auth.users`.
- **Chamado por:** `Ajustes.tsx → handleDeleteAccount()` (após reautenticação obrigatória)
- **Secrets necessários:** nenhum externo (usa `SUPABASE_SERVICE_ROLE_KEY` automático)
- **⚠️ Ação irreversível:** Exige reautenticação por senha ou passkey antes de executar.

---

## 3. Checklist de Configuração de Novo Ambiente

Para configurar um ambiente do zero (fork, staging, etc.):

```
[ ] 1. Criar projeto no Supabase (via Lovable Cloud)
[ ] 2. Rodar todas as migrations (supabase/migrations/)
[ ] 3. Configurar secrets no Lovable Cloud → Settings → Secrets:
       - ASAAS_API_KEY_SANDBOX + ASAAS_API_URL_SANDBOX
       - ASAAS_API_KEY_PROD + ASAAS_API_URL_PROD
       - ASAAS_WEBHOOK_TOKEN (gerar valor único)
       - RESEND_API_KEY (criar em resend.com)
       - GEMINI_API_KEY
       - SENTRY_DSN
       - APP_URL (ex: https://vita.locustech.com.br/home)
       - APP_ORIGIN (ex: https://vita.locustech.com.br)
       - EMAIL_HASH_SALT (string aleatória ≥ 32 chars)
       - PLAN_MONTHLY_PRICE / PLAN_ANNUAL_PRICE / PLAN_ANNUAL_THRESHOLD
       - AI_CALLS_PER_HOUR
       - VAPID_PUBLIC_KEY (ver seção 1.9)
       - VAPID_PRIVATE_KEY (ver seção 1.9 — ⚠️ nunca versionar)
       - VAPID_SUBJECT = mailto:suporte@locustech.com.br
       - CRON_SECRET (gerar com: openssl rand -hex 32)
[ ] 4. Verificar domínio locustech.com.br no Resend (DNS SPF/DKIM)
[ ] 5. Configurar webhook no Asaas apontando para a URL da Edge Function
[ ] 6. Deploy de todas as Edge Functions via Lovable MCP
[ ] 7. Ativar pg_cron jobs de push (SQL em 20260621120000_push_notifications.sql):
       - send-medication-reminders (a cada 5 min)
       - send-appointment-reminders (diário às 8h BRT)
       - push_subscriptions TTL cleanup (semanal, domingo)
[ ] 8. Testar fluxo de pagamento em modo sandbox
[ ] 9. Testar envio de e-mail de convite
[ ] 10. Testar opt-in de push em iOS PWA + confirmar chegada da notificação
```

---

## 4. Variáveis de Ambiente Vite (Frontend)

Configuradas em **Lovable Cloud → Settings → Environment Variables** (prefixo `VITE_` obrigatório para exposição no bundle):

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL pública do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/public key do Supabase (segura para expor no frontend) |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto Supabase |
| `VITE_SENTRY_DSN` | DSN Sentry para captura de erros no frontend |

> **Nota de segurança:** Variáveis `VITE_*` são embarcadas no bundle e visíveis no navegador. Nunca colocar chaves privadas (service_role, API keys) com prefixo VITE_.

---

*Documento mantido pelo Claude (Cowork). Atualizar sempre que uma nova Edge Function for criada ou um secret for adicionado/removido.*
