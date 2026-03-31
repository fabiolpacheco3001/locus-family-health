

## Fix: Standardize "Começar Agora" button to match siblings

**File:** `src/pages/Landing.tsx` (line 421)

**Change:** Update the Teste/Grátis button classes from:
```
font-semibold shadow-md hover:shadow-lg
```
to:
```
font-bold shadow-lg hover:shadow-xl
```

This single-line edit brings all three pricing buttons to identical elevation and weight, completing the visual consistency fix from Fase 284.

