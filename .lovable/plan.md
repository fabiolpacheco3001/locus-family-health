

## Diagnóstico: Diferença no Botão de Swipe "Realizado"

### Diferenças Encontradas

| Propriedade | Consultas (padrão correto) | PetRotinas (divergente) |
|---|---|---|
| **Ícone** | `CheckCircle` (círculo com check) | `Check` (check simples) |
| **Label** | `"Realizada"` | `"Realizado"` |
| **textColor** | `#1a1a1a` | `#1e293b` |

A cor de fundo (`#F2A97F`) é a mesma. A diferença visual principal é o **ícone**: `CheckCircle` vs `Check`.

### Correção

**Arquivo:** `src/pages/PetRotinas.tsx`

1. Trocar o import de `Check` por `CheckCircle` (de `lucide-react`)
2. Alterar o ícone no `leadingAction` de `<Check>` para `<CheckCircle>`
3. Ajustar `textColor` de `"#1e293b"` para `"#1a1a1a"`
4. O label permanece `"Realizado"` (masculino, correto para "registro")

