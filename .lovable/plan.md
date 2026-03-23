

## Plan: Corrigir Swipe-to-Delete nas Notificações

### Diagnóstico
Analisando o session replay, o card está voando para -1043px (muito além dos constraints), indicando que o `animate()` do framer-motion v12 não está controlando o `useMotionValue` corretamente — ou o `onDragEnd` não está disparando como esperado.

O framer-motion v12 mudou a assinatura de `animate` para motion values. A abordagem mais robusta é usar `useAnimationControls` ou simplesmente controlar via `x.set()` com transição manual.

### Alterações em `src/pages/Notificacoes.tsx`

**1. Substituir `animate()` por controle direto do motion value**

Em vez de `animate(x, -400, ...)`, usar a API `useAnimate` do framer-motion v12 ou fallback com `x.set()` + `requestAnimationFrame` para animar a saída.

Alternativa mais estável: usar `useState` para controlar se o card está "dismissed" e aplicar `variants` do framer-motion para a animação de saída.

**2. Abordagem com `AnimatePresence` + `variants`**

- Envolver a lista com `<AnimatePresence>`
- Cada `NotificationCard` usa `motion.div` com `exit={{ x: -400, opacity: 0 }}`
- O swipe apenas seta um estado `dismissed` → chama `onDelete` → o `AnimatePresence` cuida da animação de saída
- O drag usa `onDragEnd` com `info.offset.x` (API v12) em vez de `x.get()` para detecção de threshold

**3. Corrigir detecção de threshold**

```tsx
const handleDragEnd = (_: any, info: PanInfo) => {
  if (info.offset.x < SWIPE_THRESHOLD) {
    onDelete(notification.id);
  }
};
```

Usar `info.offset.x` (fornecido pelo framer-motion no callback) é mais confiável que `x.get()`.

**4. Estrutura final do NotificationCard**

- Container `relative overflow-hidden` com fundo vermelho + lixeira
- `motion.div` frontal com `drag="x"`, `dragConstraints={{ left: 0, right: 0 }}`, `dragElastic={{ left: 0.5, right: 0 }}`
- `onDragEnd` usa `info.offset.x` para decidir delete vs snap-back
- Lista envolta em `AnimatePresence` para animação de saída suave

### Resultado
Swipe fluido para a esquerda, snap-back quando solto antes do limiar, animação de saída suave ao deletar.

