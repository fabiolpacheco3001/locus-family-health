# LOCUS VITA — Backlog de Features e Melhorias

> **Versão:** 1.0 | **Criado em:** 2026-06-19
> Arquivo de controle de backlog. Atualizar após cada sprint.
> Débito técnico (bugs, código, arquitetura) → ver `TECH_DEBT.md`

---

## Legenda

| Símbolo | Significado |
|---------|------------|
| 🔴 | Alta prioridade — impacto direto no usuário ou receita |
| 🟡 | Média prioridade — melhoria significativa |
| 🟢 | Baixa prioridade — nice-to-have |
| ✅ | Concluído |
| ⬜ | Pendente |
| 🔄 | Em progresso |

---

## Produção — Itens Urgentes

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| PROD-01 | CPF real do usuário em `creditCardHolderInfo` | 🔴 | `create-asaas-checkout` usa fallback `"00000000191"`. Precisa buscar CPF real do perfil ou capturar no onboarding |
| PROD-02 | Endereço/telefone real em `creditCardHolderInfo` | 🔴 | Campos hardcoded na edge function. Asaas exige para antifraude em produção |
| PROD-03 | Validar tokenização em conta Asaas de produção | 🔴 | Tokenização testada apenas em sandbox. Confirmar que `credit_card_token` vem corretamente em prod |

---

## Features — Alta Prioridade

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| BK-01 | Push notifications multi-dispositivo | 🔄 | **Em progresso (2026-06-21, sessão 35):** Web Push VAPID implementado. Arquivos criados: `public/sw.js`, `src/lib/pushConfig.ts`, `src/hooks/usePushSubscription.ts`, 3 Edge Functions (`send-push-notification`, `send-medication-reminders`, `send-appointment-reminders`), migration `20260621120000_push_notifications.sql`. **Pendente:** configurar Secrets VAPID + CRON_SECRET no Supabase Dashboard, aplicar migration, ativar pg_cron jobs (ver instruções no SQL da migration). |
| A7-E2E | Testes E2E Playwright | 🔴 | Fluxos críticos: login, cadastro de medicamento, marcação de dose, pagamento |

---

## Features — Média Prioridade

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| BK-02 | Ciclos posológicos complexos | 🟡 | Anticoncepcional 21+7, pausa programada, reinício automático |
| BK-03 | OAuth Google / Apple | 🟡 | Login social para reduzir fricção no cadastro |
| BK-05 | ~~Dashboard de Adesão Medicamentosa~~ | ✅ | Implementado. Bug "Parcial" corrigido (2026-06-19): virtual doses agora cobrindo specific_times e specific_days. "Melhor sequência" (recorde) também adicionado. |
| BK-07 | ~~Importação de receitas via foto (câmera)~~ | ✅ | Implementado (2026-06-19, sessão 27): card "Ler Receita com IA" na Home → FamilySelectDrawer → AiMedicationUpload → AddMedicationDrawer |
| BK-08 | ~~Compartilhamento de histórico com médico~~ | ✅ | Implementado (2026-06-19, sessão 21): PDFs gerados para aderência, consultas, exames, vacinas — individual ou família inteira — via jsPDF + botão Share2 |

---

## Features — Baixa Prioridade

| ID | Item | Prioridade | Detalhe |
|----|------|-----------|---------|
| BK-04 | Lembretes por e-mail | 🟢 | E-mails transacionais via PGMQ para usuários sem push ativo |
| BK-09 | Widget iOS / Android | 🟢 | Próxima dose na tela inicial sem abrir o app |
| BK-10 | Relatório mensal automático | 🟢 | PDF por e-mail com resumo de saúde familiar |

---

## Upgrades de Dependências Pendentes

| Pacote | Versão atual | Versão alvo | Risco | Notas |
|--------|-------------|-------------|-------|-------|
| `recharts` | 2.x | 3.x | 🟡 Médio | API de componentes mudou; revisar charts existentes |
| `react-day-picker` | 8.x | 9.x | 🟡 Médio | API de props mudou; `CustomDateTimePicker` pode precisar ajuste |
| `date-fns` | 3.x | 4.x | 🟢 Baixo | Leve; testar funções de parse/format |
| `zod` | 3.x | 4.x | 🟡 Médio | API mudou; revisar schemas de validação |

---

## Concluído (movido do Backlog)

| ID | Item | Sprint | Data |
|----|------|--------|------|
| BK-04 | WebAuthn passkeys (Face ID / Touch ID) | Sprint 10 | 2026-06 |
| BK-06 | Signed URLs para arquivos clínicos (LGPD) | Sprint 11 | 2026-06 |
| BK-Asaas | Refactor motor financeiro → Cobrança Avulsa + tokenização | Sprint 13 | 2026-06-19 |
| BK-07 | Importação de receitas via foto (câmera) | Sprint 27 | 2026-06-19 |
| BK-08 | Compartilhamento de histórico com médico (Export PDF) | Sprint 21 | 2026-06-19 |
| SEC-RLS | Fix subscriptions 42501 — column-level grants quebraram select("*") | Hotfix | 2026-06-20 |

---

*Mantido pelo Claude (Cowork). Atualizar após cada sprint ou decisão de produto.*
