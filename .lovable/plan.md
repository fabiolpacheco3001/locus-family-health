

## Plano: Ajuste de Espaçamento "Acesso Rápido" na Home

### Problema
O título "Acesso Rápido" (linha 329) tem `mt-6 mb-3` e o container flutuante (linha 336) tem `-mt-24`, criando gap excessivo entre título e cards.

### Alterações em `src/pages/Home.tsx`

**1. Linha 329** — Reduzir margens do título:
- De: `mt-6 mb-3`
- Para: `mt-4 mb-1`

**2. Linha 336** — Aumentar margem negativa do container flutuante:
- De: `-mt-24`
- Para: `-mt-28`

Estas duas mudanças puxam os cards para mais perto do título, igualando o padrão de espaçamento da seção "Visão Geral".

