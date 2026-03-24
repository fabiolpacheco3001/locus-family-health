

## Plan: Alterar fundo da Home para #f2f0eb

**Arquivo:** `src/pages/Home.tsx`

**Mudança (linha 183):**

Substituir `bg-background` por `bg-[#f2f0eb]` no container principal fixo.

```
// De:
<div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-background overflow-hidden z-10">

// Para:
<div className="fixed top-0 left-0 right-0 bottom-[72px] flex flex-col bg-[#f2f0eb] overflow-hidden z-10">
```

Apenas a tela Início é afetada. Nenhuma outra página ou variável CSS é alterada.

