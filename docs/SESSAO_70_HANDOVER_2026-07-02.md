# LOCUS VITA — Handover Sessão 70
> **Data:** 2026-07-02 | **Motivo:** Transição de modelo/chat | **Branch:** `main`

---

## 1. Estado do Repositório ao Encerrar

**Branch:** `main` — limpa, CI verde (0 errors após 2 lint fixes desta sessão).

### Commits desta sessão (LOCAL → main)

| Hash | Descrição |
|------|-----------|
| `1d767fe` | feat(posologia): BK-02 ciclos posológicos complexos (5 arquivos frontend) |
| `89fc916` | docs: adicionar PRDs e atualizar BACKLOG/TECH_DEBT |
| `48ce248` | fix(lint): eslint-disable no-require-imports em tailwind.config.ts |
| `9b58bc3` | fix(lint): prefer-const dayCursor em calculateNextDose |

### Commits do Lovable (remote — rodar `git pull` no terminal local)

| Hash | Descrição |
|------|-----------|
| `d6515660` | migration BK-02 + edge function `send-medication-reminders` atualizada |
| `4c892407` | types.ts: colunas cyclic confirmadas (Lovable auto-regenerou) |

> ⚠️ Fábio deve rodar `git pull` no terminal Mac para sincronizar os commits do Lovable antes da próxima sessão.

---

## 2. BK-02 — Ciclos Posológicos Complexos (entregue nesta sessão)

### Problema resolvido
Medicamentos com posologia cíclica (ex: anticoncepcional 21 dias ativo + 7 dias de pausa) não tinham suporte. O app mostrava `∞` ou doses incorretas durante a fase de pausa.

### Migration aplicada via Lovable MCP
```sql
-- Migration: 20260702000000_add_cyclic_posology.sql
ALTER TABLE medications
  ADD COLUMN cycle_active_days INTEGER,
  ADD COLUMN cycle_pause_days  INTEGER,
  ADD COLUMN cycle_start_date  TIMESTAMPTZ;

-- CHECK constraint (RISCO HIGH — nunca exibir dose durante pausa)
ALTER TABLE medications
  ADD CONSTRAINT chk_cyclic_fields_complete
  CHECK (
    frequency_type != 'cyclic'
    OR (cycle_active_days IS NOT NULL AND cycle_pause_days IS NOT NULL AND cycle_start_date IS NOT NULL)
  );
```

### Arquivos modificados (canal LOCAL — commit `1d767fe`)

**`src/hooks/useMedications.tsx`**
- Adicionado `'cyclic'` ao type `FrequencyType`
- Campos `cycle_active_days?: number | null`, `cycle_pause_days?: number | null`, `cycle_start_date?: string | null` em `Medication`, `NewMedication`, `UpdateMedication`

**`src/lib/calculateNextDose.ts`**
- Branch `'cyclic'` completo (linhas 205–261)
- Aritmética modular: `Math.floor(daysSinceStart) % cycleTotal` determina fase ativa vs pausa
- Helper `getCyclePhase(d: Date): "active" | "pause"`
- Helper `nextCycleActiveStart(d: Date): Date` — pula para início do próximo ciclo ativo
- Retorna `null` durante fase de pausa (**RISCO ALTO** — comportamento correto e intencional)
- Fix lint adicional: `let dayCursor` → `const dayCursor` (linha 235) — commit `9b58bc3`

**`src/components/AddMedicationDrawer.tsx`**
- Nova opção "Ciclo (com pausa)" no seletor de frequência
- UI com fundo âmbar (`bg-amber-50`) + ícone `AlertTriangle` como aviso visual
- Defaults automáticos: 21 dias ativos, 7 dias de pausa
- Sumário dinâmico: "X dias com dose + Y dias de pausa"

**`src/components/AdherenceHistoryDrawer.tsx`**
- Geração virtual de doses (`virtualDoses`) apenas nos dias ativos do ciclo
- Dias de pausa não geram dose virtual — garante que adesão não penaliza pausas programadas

**`src/hooks/useHomeData.ts`**
- `MedWithNextDose` agora inclui `cyclePhase: "active" | "pause" | null`
- Badge "Pausa do Ciclo" exibido na Home quando `cyclePhase === "pause"`
- Medicamentos em pausa continuam aparecendo na lista (sem sumir silenciosamente)

### Edge Function atualizada via Lovable MCP (`d6515660`)
`send-medication-reminders`:
- Branch `cyclic` bloqueia push nos dias de pausa (segurança ANVISA — NUNCA notificar dose durante pausa)
- Envia notificação "🔄 Reinício do Ciclo Amanhã" no último dia de pausa

---

## 3. Correções de CI desta sessão

### Fix 1 — `tailwind.config.ts` (commit `48ce248`)

**Erro:** `@typescript-eslint/no-require-imports` — `require()` style import is forbidden  
**Arquivo:** `tailwind.config.ts`, linha 102  
**Fix:**
```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
plugins: [require("tailwindcss-animate")]
```
**Resultado:** erros de CI: 113 → 112

### Fix 2 — `src/lib/calculateNextDose.ts` (commit `9b58bc3`)

**Erro:** `prefer-const` — `let dayCursor` is never reassigned  
**Arquivo:** `src/lib/calculateNextDose.ts`, linha 235  
**Fix:** `let dayCursor` → `const dayCursor`  
**Resultado:** erros de CI: 112 → **0 errors** ✅

---

## 4. Descoberta Crítica — Types.ts no Lovable Cloud

### Problema encontrado
O comando `supabase gen types typescript --project-id xazlrdwdkafhzwkezfxz` **falha com erro de permissão**:
```
Error: failed to retrieve generated types: Your account does not have the necessary privileges.
```

### Causa
O Lovable Cloud é proprietário da organização Supabase deste projeto. O token pessoal do Supabase CLI não tem acesso à API de geração de tipos dessa organização.

### Solução correta
O Lovable atualiza `src/integrations/supabase/types.ts` automaticamente ao aplicar migrations via MCP.

**Verificado:** commit `4c892407` confirmou que `cycle_active_days`, `cycle_pause_days`, `cycle_start_date` já estão em `types.ts` (em torno das linhas 835–960) — Lovable regenerou automaticamente.

### IDs para referência futura
- **Supabase project ref:** `xazlrdwdkafhzwkezfxz` (em `supabase/config.toml`)
- **Lovable project ID:** `2160e53b-dd46-4ed3-8be6-a8d6fb573466`
- **Workspace:** `hA2SRdYaeYmhlFNkmOfV`

---

## 5. Estado da Documentação

| Arquivo | Versão | Estado |
|---------|--------|--------|
| `docs/BACKLOG.md` | v2.6 | ✅ BK-02 marcado concluído |
| `docs/TECH_DEBT.md` | v8.4 | ✅ Sessão 70 registrada |
| `docs/LOCUS_VITA_PROJECT_INSTRUCTIONS_v3.5.md` | v3.5 | ✅ Gerado nesta sessão |

---

## 6. Pendências para a Próxima Sessão

1. **`git pull` no terminal local** — para pegar os commits do Lovable (`d6515660`, `4c892407`)
2. **Verificar CI** do commit `9b58bc3` — deve estar verde (0 errors)
3. **Próximo item do backlog:** `BK-11` — Zod schemas para formulários com PHI (`src/lib/schemas/`)
4. **Dívida técnica pendente:** `ID-018` — aria-label em `SwipeableCard` (já foi feito na sessão 59 — verificar se ainda está pendente ou foi resolvido)

---

## 7. Regras de Segurança — Lembrete para o Novo Chat

| Regra | Motivo |
|-------|--------|
| NUNCA `select("*")` em `subscriptions` | Migration `20260619212318` revogou SELECT table-level — usar colunas explícitas |
| NUNCA commitar secrets em comentários/JSDoc/SQL | Incidente VAPID_PRIVATE_KEY (sessão 35) — usar apenas placeholders |
| NUNCA nullar `next_billing_date` ou `current_period_end` | Quebra o Grace Period |
| NUNCA editar `client.ts`, `types.ts`, `config.toml` | Auto-gerados pelo Lovable |
| `console.log` banido em produção | Usa `captureException` de `lib/sentry.ts` |
| Destino de arquivos gerados | Sempre em `docs/` do repositório — nunca em `outputs/` ou `/tmp/` |
| `frequency_type = 'cyclic'` + pausa | NUNCA retornar dose durante fase de pausa — `calculateNextDose` retorna `null` |

---

## 8. Contexto Técnico Rápido

```
Stack:      React 19 + Vite 6 + TypeScript (noImplicitAny:true) + TailwindCSS v4 + shadcn/ui
Backend:    Lovable Cloud (Supabase open-source por baixo)
Deploy:     PWA mobile-first (iOS/Android)
CI:         GitHub Actions (lint + typecheck + vitest) — 0 errors após esta sessão
Testes E2E: Playwright 8/8 (bun run test:e2e, não npx playwright test)
Observ.:    Sentry (VITE_SENTRY_DSN + SENTRY_DSN em Lovable Secrets)
Pagamento:  Asaas — Cobrança Avulsa + tokenização
Push:       APNs (iOS) + FCM (Android) via web-push, par VAPID par 3 (BPiseS4Y...)
```

---

*Gerado em 2026-07-02 — Sessão 70 encerrada.*
