

# Diagnóstico Raio-X: Performance de Carregamento Inicial

## Resumo Executivo

O app sofre de **waterfall de queries sequenciais** e **queries redundantes** que se acumulam no momento da entrada. A cada navegação para uma tela autenticada, o sistema dispara entre **7 e 12 chamadas HTTP ao backend** antes de renderizar conteúdo útil.

---

## Mapa de Queries por Tela

### Login -> Home (Pior Caso: ~10 requests paralelos/sequenciais)

```text
┌─ AppLayout monta ─────────────────────────────────────────┐
│  1. useMedications()     → GET medications (ALL)          │
│  2. useMedicationAlarms  → catch-up RPC (N decrements)    │
│  3. useStockAlerts       → GET notifications (N queries)  │
│  4. useMenstrualAlerts   → GET menstrual_cycles           │
│                            GET notifications (N queries)  │
└───────────────────────────────────────────────────────────┘
         ↓ (em paralelo)
┌─ Home monta ──────────────────────────────────────────────┐
│  5. useMedications()     → GET medications (DUPLICADA!)   │
│  6. useFamilyMembers()   → GET family_members             │
│  7. useNotifications()   → GET notifications (ALL)        │
│  8. pending-counts       → GET consultations (count)      │
│                            GET exams (count)              │
│  9. upcoming-appointments→ GET consultations (top 5)      │
│                            GET exams (top 5)              │
└───────────────────────────────────────────────────────────┘
```

### Home -> Minha Saúde (FamiliarProfile) (~3 requests adicionais)
```text
│  10. GET family_member (single)                           │
│  (AppLayout hooks continuam rodando em background)        │
```

### Home -> Exames (~2 requests adicionais)
```text
│  11. GET exams (by family_member_id)                      │
│  12. GET consultations (by family_member_id)              │
```

---

## Problemas Identificados (por gravidade)

### 1. Query de Medicamentos DUPLICADA (Impacto: Alto)
- `AppLayout` chama `useMedications()` → query key `["medications", "all"]`
- `Home` chama `useMedications()` novamente → **mesma query key**, mas React Query pode disparar 2x se o timing for ruim
- **Economia potencial**: 1 request eliminado

### 2. useStockAlerts faz N+1 queries (Impacto: Alto)
- Para cada medicamento com estoque baixo, faz uma query individual ao `notifications` para verificar se já notificou hoje
- Com 5 medicamentos ativos de uso contínuo = 5 queries extras ao `notifications`
- **Solução**: Batch query única filtrando por `type = 'stock'` e `created_at >= today`

### 3. useMenstrualAlerts faz N+1 queries (Impacto: Médio)
- Busca todos os ciclos, depois para cada familiar faz query individual ao `notifications`
- **Solução**: Mesma abordagem batch

### 4. useMedicationAlarms catch-up faz N RPCs (Impacto: Médio)
- Na montagem, para cada medicamento com doses perdidas, faz um RPC `decrement_stock` individual
- Já usa `Promise.all` (bom), mas cada RPC é um request HTTP separado
- **Solução possível**: Criar um RPC batch `decrement_stock_batch` que aceita array

### 5. Home faz 4 queries para o dashboard (Impacto: Médio)
- `pending-counts`: 2 queries (consultations count + exams count)
- `upcoming-appointments`: 2 queries (consultations top 5 + exams top 5)
- Total: 4 requests só para o dashboard
- **Solução**: Consolidar em 1-2 queries ou criar uma view/function no backend

### 6. Nenhum prefetch de dados (Impacto: Médio)
- Ao fazer login, não há prefetch. O usuário vê skeleton por 1-3 segundos
- **Solução**: Após `signIn` bem-sucedido, prefetch as queries principais antes de navegar

### 7. useExams sem staleTime (Impacto: Baixo)
- `useExams` não define `staleTime`, então refetcha a cada mount/unmount
- `useConsultations` também não define `staleTime`
- **Solução**: Adicionar `staleTime: 5 * 60 * 1000` como nos outros hooks

---

## Plano de Otimização (6 passos)

### Passo 1: Eliminar query duplicada de medicamentos na Home
- A Home já recebe os dados do `AppLayout` via React Query cache (mesma query key `["medications", "all"]`)
- Confirmar que o `staleTime: 5min` está impedindo refetch desnecessário
- Se não, o problema é timing — garantir que a Home use o cache

### Passo 2: Batch das verificações de notificação (Stock + Menstrual)
- Em `useStockAlerts`: fazer UMA query `notifications WHERE type='stock' AND created_at >= today` e filtrar localmente
- Em `useMenstrualAlerts`: fazer UMA query `notifications WHERE type='menstrual' AND created_at >= today` e filtrar localmente
- **Economia**: de N+1 queries para 1 query cada

### Passo 3: Adicionar staleTime aos hooks faltantes
- `useExams`: adicionar `staleTime: 5 * 60 * 1000`
- `useConsultations`: adicionar `staleTime: 5 * 60 * 1000`
- Previne refetch desnecessário ao navegar entre telas

### Passo 4: Consolidar queries do dashboard da Home
- Unificar `pending-counts` e `upcoming-appointments` em uma única query que busca ambos
- Ou ao menos usar `Promise.all` dentro de uma única `queryFn`

### Passo 5: Prefetch após login
- No `handleSubmit` do Login, após `signIn` bem-sucedido, chamar `queryClient.prefetchQuery` para `medications`, `family_members` e `notifications` antes de navegar para `/home`

### Passo 6: Manter delay de 2s nos alertas de background
- Já implementado (bom), garantir que não regrediu

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Requests na entrada (Home) | 10-12 | 5-6 |
| Tempo até First Paint | 2-3s | < 1s |
| Requests redundantes | 3-5 | 0 |
| N+1 queries (alertas) | Sim | Não |

