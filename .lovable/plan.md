# Contexto: Locus Vita (Fase 153 - Execução do Raio-X de Performance PWA / Cold Start)

O Stakeholder APROVOU INTEGRALMENTE o Diagnóstico e o Plano de Ação (6 correções) para o First Contentful Paint e Thread Blocking. A execução deve ser cirúrgica, focando na percepção de velocidade (Progressive Rendering) e liberação da Main Thread.

## Autorização de Execução (Siga os 6 passos do seu relatório)

Execute as correções rigorosamente conforme o seu plano:

1. **Deferir Cálculo Pesado (Unblock Main Thread):** Em `useMedicationAlarms`, envolva a chamada síncrona `checkAlarms()` e a preparação do catch-up em um `setTimeout` (ex: 100ms a 500ms) para permitir que o navegador faça o "First Paint" da UI antes de travar a thread com cálculos do `date-fns`.

2. **Cold Start Prefetch:** No `AppLayout` (ou onde o state do usuário autenticado é recuperado no mount), dispare o `queryClient.prefetchQuery` para as 3 chaves principais `medications`, `family_members`, `notifications`) caso o cache esteja vazio.

3. **Home Progressive Rendering:** Quebre o `isLoading` unificado. Renderize os "Próximos Compromissos" e "Ações de Hoje" independentemente, permitindo que a seção mais rápida apareça primeiro. O Carrossel deve renderizar sua "casca/shell" imediatamente.

4. **Cache Reuse `FamiliarProfile`):** Em `MinhaSaude` / Perfil do Familiar, altere o fetch individual. Use `queryClient.getQueryData(['family_members', user.id])` para encontrar o familiar. Faça o fetch de rede OBRIGATORIAMENTE apenas como fallback se não achar no cache.

5. **UI Skeleton Isolado `FamiliarProfile`):** Remova o `return <Skeleton>` que bloqueia a página inteira. Renderize a TopBar, o Header e os grids (Alergias, Consultas, etc.) imediatamente. Coloque o Skeleton APENAS no Card de Identidade do familiar caso o dado ainda esteja carregando.

6. **StaleTime Faltante:** Aplique `staleTime: 5 * 60 * 1000` na query `health_measurements`.

## Regras de Execução (Vibe Coding)

 *O objetivo desta refatoração é zerar o tempo de tela branca (First Contentful Paint). A "casca" do aplicativo deve aparecer em menos de 300ms, preenchendo os dados gradativamente sem congelar o scroll do usuário.*  
  
********************************  
  
Diagnóstico Raio-X: First Contentful Paint e Thread Blocking

## Achados Críticos

### 1. Main Thread Blocking — CONFIRMADO (Impacto: Alto)

O `useMedicationAlarms` executa `checkAlarms()` **sincronamente no mount** (linha 200), ANTES do setTimeout de 60s. Esse loop itera sobre TODOS os medicamentos ativos, chamando `calculateNextDose()` (que faz manipulação de Date com while-loop) para cada um. Com 20+ medicamentos, isso bloqueia a thread principal por dezenas de milissegundos durante o primeiro render.

O catch-up de doses perdidas (linhas 98-150) também roda no mount — ele itera todos os medicamentos, faz cálculos de `Date` e dispara RPCs `decrement_stock` em paralelo. Embora assíncrono, o loop síncrono de preparação dos decrements bloqueia antes do `await`.

### 2. Waterfall de Auth → Queries — CONFIRMADO (Impacto: Alto)

O `useAuth` faz duas chamadas sequenciais ao Supabase Auth (`onAuthStateChange` + `getSession`). Enquanto `loading === true`, nenhum hook com `enabled: !!user` dispara. Isso cria um **waterfall de ~300-500ms** antes de qualquer query de dados começar.

Sequência real no Cold Start do PWA:

```text
[0ms]   App monta → AuthProvider.getSession() inicia
[300ms] getSession resolve → user disponível
[300ms] AppLayout monta → useMedications() dispara
[300ms] Home monta → useFamilyMembers(), useNotifications(), pending-counts, upcoming
[600ms] Medications resolve → useMedicationAlarms.checkAlarms() BLOQUEIA thread
[600ms] useMedicationAlarms catch-up → N RPCs decrement_stock
[800ms] useStockAlerts → 1 query notifications (batch)
[800ms] useMenstrualAlerts → 1 query menstrual_cycles + 1 query notifications
[~1200ms] Dados chegam → Home renderiza conteúdo
```

### 3. Falha do Prefetch no Cold Start — CONFIRMADO (Impacto: Alto)

O prefetch no `Login.tsx` só roda quando o usuário faz login interativo. No **Cold Start do PWA** (usuário já logado, abre o app), o fluxo vai direto para `/home` via sessão persistida — o prefetch do Login **nunca executa**. Resultado: cache vazio, todas as queries disparam do zero.

### 4. FamiliarProfile sem staleTime — CONFIRMADO (Impacto: Médio)

A query `["family_member", id]` no `FamiliarProfile.tsx` (linha 85) **não tem `staleTime**`. Cada navegação para um perfil refaz a query, mesmo que os dados do familiar já existam no cache de `["family_members", user.id]`. Além disso, essa query busca um membro individual em vez de reutilizar a lista já cacheada.

### 5. Skeleton Bloqueado por `isLoading` Combinado — CONFIRMADO (Impacto: Médio)

Na Home (linha 170): `const isLoading = medsLoading || upcomingLoading;`. Isso faz com que as seções de "Ações de Hoje" e "Próximos Compromissos" mostrem skeleton até que AMBAS as queries resolvam. Se medications resolver em 400ms mas upcoming demorar 800ms, a seção de medicamentos fica presa no skeleton por 400ms extras desnecessários.

### 6. FamiliarProfile bloqueia render inteiro no isLoading — CONFIRMADO (Impacto: Médio)

Linha 99: `if (isLoading) { return <Skeleton ...> }`. O componente inteiro é substituído por 3 skeletons genéricos. O header, os grids de navegação e o layout poderiam ser renderizados imediatamente (são estáticos) enquanto apenas o "Identity Card" mostra skeleton.

---

## Plano de Ação (6 correções)

### Correção 1: Defer `checkAlarms` do primeiro tick

Envolver a chamada `checkAlarms()` na linha 200 do `useMedicationAlarms` em um `setTimeout(checkAlarms, 100)` para liberar a thread principal para o primeiro paint.

### Correção 2: Prefetch no AppLayout para Cold Start

Adicionar lógica no `AppLayout` (ou `AuthProvider`) que detecte sessão já existente e dispare `queryClient.prefetchQuery` para `medications`, `family_members` e `notifications` imediatamente quando `user` ficar disponível — cobrindo o cenário de Cold Start que o prefetch do Login não cobre.

### Correção 3: Separar `isLoading` por seção na Home

Substituir `const isLoading = medsLoading || upcomingLoading` por verificações independentes:

- Seção "Ações de Hoje" → usa `medsLoading`
- Seção "Próximos Compromissos" → usa `upcomingLoading`
- Carrossel → renderiza imediatamente com dados do cache ou zeros

### Correção 4: FamiliarProfile — usar cache da lista de membros

Em vez de fazer uma query individual `["family_member", id]`, usar `queryClient.getQueryData(["family_members", user.id])` para buscar o membro no cache existente, com fallback para query individual. Adicionar `staleTime: 5 * 60 * 1000`.

### Correção 5: FamiliarProfile — Progressive Rendering

Substituir o `if (isLoading) return <Skeleton>` por um layout que renderize o header e os grids de navegação imediatamente (são estáticos/conhecidos), mostrando skeleton apenas no Identity Card.

### Correção 6: MinhaSaude — Adicionar staleTime

A query `["health_measurements", id]` não tem `staleTime`. Adicionar `staleTime: 5 * 60 * 1000`.

---

## Resultado Esperado


| Métrica                               | Antes    | Depois         |
| ------------------------------------- | -------- | -------------- |
| Time to First Content (Home)          | 1.2-2s   | < 500ms        |
| Time to Interactive (FamiliarProfile) | 1-1.5s   | < 300ms        |
| Main Thread Block (checkAlarms)       | 50-100ms | 0ms (deferred) |
| Cold Start penalty (sem prefetch)     | +500ms   | Eliminado      |
