

## Plan: Corrigir ícones na lista de Medicamentos Ativos (`MedicamentosGeral.tsx`)

### Problema
Os ícones circulares do `<Pill>` nos cards estão usando `bg-primary/10` e `text-primary` (verde translúcido), quando deveriam seguir o Design System: fundo Verde Menta sólido (`bg-[#A7D3CB]`) com ícone preto (`text-black`). O mesmo se aplica ao estado vazio e ao ChevronRight.

### Alterações em `src/pages/MedicamentosGeral.tsx`

1. **Ícone nos cards da lista (linha 74):** Trocar `bg-primary/10` → `bg-[#A7D3CB]` e `text-primary` → `text-black`

2. **Ícone do estado vazio (linha 47-48):** Trocar `bg-primary/10` → `bg-[#A7D3CB]` e `text-primary` → `text-black`

3. **Badge "Ativo" (linha 83):** Trocar classes de outline/secondary para `bg-[#F2A97F] text-black border-none` (padrão Pêssego para status Ativo, conforme Design System)

4. **ChevronRight (linha 109):** Trocar `text-muted-foreground` → `text-black`

