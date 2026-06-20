# Locus Vita

Family Health Hub — SaaS mobile-first para gestão de saúde familiar.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions) via Lovable Cloud
- **Pagamentos:** Asaas
- **IA:** Gemini (OCR de receitas)
- **Erros:** Sentry (frontend + Edge Functions)

## Setup Local

### Pré-requisitos

- [Bun](https://bun.sh) >= 1.0
- Conta no [Lovable](https://lovable.dev) (Cloud habilitado)

### Instalação

```bash
cp .env.example .env.local
# Preencha as variáveis em .env.local com os valores do projeto
bun install
bun run dev
```

### Variáveis de Ambiente

Veja `.env.example` para todas as variáveis do frontend.

Para **Edge Functions**, os secrets ficam em **Project Settings → Secrets** no Lovable:

- `SUPABASE_SERVICE_ROLE_KEY` (auto-gerenciada)
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `LOVABLE_API_KEY` (auto-gerenciada)
- `GEMINI_API_KEY`
- `SENTRY_DSN`
- `APP_ORIGIN` (ex.: `https://vita.locustech.com.br`)

## Arquitetura

Ver `docs/` para runbooks e decisões arquiteturais (ADRs).

## Deploy

Deploy gerenciado pelo Lovable com sync bidirecional ao GitHub.
PWA standalone publicado em `https://vita.locustech.com.br`.
