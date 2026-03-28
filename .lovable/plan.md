
## Diagnóstico confirmado

Sim, o problema ainda pode acontecer mesmo com `stopPropagation()` no `NotificationCard`.

A causa real não está no `Chevron` em si, mas no componente global de swipe:

- Em `SwipeableActionCard.tsx`, a camada de ação vermelha fica **por cima** do card (`z-[15]`), enquanto o conteúdo principal fica em `z-10`.
- O container da ação usa `pointer-events-none`, mas o botão interno de excluir continua com `pointer-events-auto` o tempo todo.
- Como esse botão invisível ocupa a faixa direita de `72px`, um toque no `Chevron`/seta pode acertar essa área invisível e disparar `onDelete()` em vez de expandir.
- O mesmo padrão existe também em `ExamSwipeableCard.tsx`, então a correção precisa ser global, não só nas notificações.

## Plano de correção

### 1. Corrigir a captura de clique nas ações ocultas
Atualizar `SwipeableActionCard.tsx` e `ExamSwipeableCard.tsx` para que os botões de ação só aceitem clique quando o card estiver realmente aberto no lado correspondente.

Implementação prevista:
- calcular se a ação está “ativa” com base em `x` / `sideRef`
- aplicar `pointer-events-none` no botão quando a ação estiver fechada
- opcionalmente esconder também via `aria-hidden`/`tabIndex` quando fechado

Resultado esperado:
- toque no `Chevron` expande/recolhe
- delete só acontece após swipe left real ou clique no botão revelado

### 2. Preservar a física atual do swipe
Não alterar:
- threshold
- snap em `-72 / +72`
- single-open state
- comportamento premium de voltar ao centro

Ou seja: corrigir apenas a interação de ponteiro, sem mexer na UX do arraste.

### 3. Validar os pontos impactados
Revisar o uso do componente compartilhado nas telas:
- `Notificacoes.tsx`
- `Consultas.tsx`
- `Medicamentos.tsx`
- `PetRotinas.tsx`
- `Exames.tsx` (via `ExamSwipeableCard`)

### 4. Validação funcional após ajuste
Vou considerar como correto quando:
- tocar no header/seta da notificação apenas expande
- tocar no card aberto apenas fecha/resetta o swipe
- excluir só dispara por swipe left + botão revelado
- nenhuma regressão acontece em consultas, medicamentos, exames e rotinas pet

## Arquivos-alvo
- `src/components/SwipeableActionCard.tsx`
- `src/components/ExamSwipeableCard.tsx`
- validação de integração em:
  - `src/components/NotificationCard.tsx`
  - `src/pages/Notificacoes.tsx`
  - `src/pages/Consultas.tsx`
  - `src/pages/Medicamentos.tsx`
  - `src/pages/PetRotinas.tsx`
  - `src/pages/Exames.tsx`

## Observação importante
O ajuste anterior atacou o sintoma (`stopPropagation`), mas não a causa estrutural: o botão destrutivo invisível continua clicável por cima do card. A correção certa é bloquear interação nas ações ocultas até o swipe abrir de verdade.
