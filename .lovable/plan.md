

## Plan: Remover barra de rolagem lateral na Home

### Problema
O container de scroll na Home (`flex-1 overflow-y-auto`) não possui a classe `no-scrollbar`, que é o padrão global do app para ocultar scrollbars visíveis.

### Alteração em `src/pages/Home.tsx`

**Linha 184:** Adicionar `no-scrollbar` ao container de scroll:

```tsx
// De:
<div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">

// Para:
<div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-4">
```

