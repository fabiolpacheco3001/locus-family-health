# Orientações de Deploy — Sessão 3

> Gerado por Claude (Cowork) · junho/2026  
> Execute na ordem abaixo ao acordar.

---

## 1. Puxar as atualizações do Git

```bash
cd /Users/fabio/locus-family-health
git pull origin main
```

---

## 2. Commitar e publicar o código desta sessão

```bash
cd /Users/fabio/locus-family-health
git add \
  src/pages/Seguranca.tsx \
  src/pages/Ajustes.tsx \
  src/pages/TermosUso.tsx \
  src/pages/Landing.tsx \
  src/App.tsx \
  supabase/migrations/20260616000010_lgpd_consent_log_revoke.sql \
  TECH_DEBT.md \
  DEPLOY_SESSAO3.md

git commit -m "feat: C3/A2 segurança; A15/M14 portabilidade e revogação LGPD; Termos de Uso"
git push origin main
```

---

## 3. Migration obrigatória no Supabase

> ⚠️ Sem esta migration, o botão "Revogar Consentimento" vai retornar erro ao tentar salvar.

**Supabase Dashboard → SQL Editor → New Query → cole e execute:**

```sql
-- Migration: 20260616000010_lgpd_consent_log_revoke

ALTER TABLE public.consent_log
  DROP CONSTRAINT IF EXISTS consent_log_consent_type_check;

ALTER TABLE public.consent_log
  ADD CONSTRAINT consent_log_consent_type_check
    CHECK (consent_type IN ('privacy_policy', 'health_data', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_consent_log_user_type
  ON public.consent_log (user_id, consent_type, granted_at DESC);

DO $$
BEGIN
  RAISE NOTICE 'Migration 000010 aplicada com sucesso.';
END $$;
```

---

## 4. Publicar no Lovable

Após o `git push`, o Lovable vai detectar as mudanças automaticamente.  
- Clique em **Publish** no Lovable para atualizar o preview.
- Aguarde o build concluir (normalmente 1–2 min).

---

## 5. Testes manuais — checklist rápido

### Segurança (`/seguranca`)
- [ ] Card de biometria mostra **"Em breve"** (sem toggle)
- [ ] Alterar senha com **senha atual errada** → toast "Senha atual incorreta"
- [ ] Alterar senha com **senha atual correta** → toast "Senha atualizada com sucesso"
- [ ] Regra de senha fraca exibida corretamente (maiúscula + número + especial)

### Ajustes (`/ajustes`)
- [ ] Botão **"Exportar Meus Dados"** aparece (ícone verde)
- [ ] Ao clicar → loading → download do arquivo `.json`
- [ ] Abrir o JSON baixado → verificar campos: `familyMembers`, `clinicalData`, `consentHistory`
- [ ] Botão **"Revogar Consentimento"** aparece (ícone âmbar)
- [ ] Ao clicar → AlertDialog aparece com aviso de que não apaga dados
- [ ] Confirmar revogação → toast "Consentimento revogado e registrado"
- [ ] Verificar em Supabase → `consent_log` → novo registro com `consent_type = 'revoked'`

### Landing Page (`/`)
- [ ] Footer: link **"Termos de Uso"** → abre `/termos-de-uso`
- [ ] Footer: link **"Privacidade (LGPD)"** → abre `/politica-de-privacidade`

### Termos de Uso (`/termos-de-uso`)
- [ ] Página abre sem login
- [ ] 12 seções renderizadas corretamente
- [ ] Link interno para Política de Privacidade funciona
- [ ] Botão Voltar funciona

---

## 6. Resumo do que foi feito nesta sessão

| Item | O que foi feito |
|------|----------------|
| **C3** | Toggle de biometria fake removido de `Seguranca.tsx`. Card "em breve" no lugar. |
| **A2** | Campo "Senha Atual" agora validado via `signInWithPassword` antes de atualizar. |
| **M14** | Botão "Revogar Consentimento" em Ajustes + AlertDialog + migration 000010. |
| **A15** | Botão "Exportar Meus Dados" em Ajustes → download JSON com todos os dados clínicos. |
| **Footer** | Links Termos de Uso e Privacidade (LGPD) consertados na Landing Page. |
| **Termos de Uso** | Nova página `/termos-de-uso` com 12 cláusulas legais + rota em App.tsx. |

---

## 7. Próximos itens (Sprint 3)

Quando estiver pronto para a próxima sessão:

1. **A1** — CORS wildcard → restringir a `APP_ORIGIN` env var em todas as 7 Edge Functions
2. **A4** — Rate limiting IA → verificar `ai_usage_logs` antes de chamar Gemini + fail-closed em `useAiStatus`
3. **C10** — Preços hardcoded → centralizar em `plan_configs` ou env vars `PLAN_MONTHLY_PRICE` / `PLAN_ANNUAL_PRICE`

Bom descanso! 🌙
