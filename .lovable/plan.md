

## Plan: Alterar cor dos ícones de seção para Verde Sálvia (#6A978F)

**Arquivo:** `src/pages/Home.tsx`

**Mudanças:**

Substituir as classes de cor dos 4 ícones de título de seção por `style={{ color: '#6A978F' }}`:

| Seção | Ícone | Linha | De | Para |
|---|---|---|---|---|
| Visão Geral | `LayoutDashboard` | ~229 | `className="text-primary"` | `style={{ color: '#6A978F' }}` |
| Acesso Rápido | `Zap` | ~331 | `className="text-primary"` | `style={{ color: '#6A978F' }}` |
| Ações de Hoje | `Activity` | ~363 | `className="text-primary"` | `style={{ color: '#6A978F' }}` |
| Próximos Compromissos | `Calendar` | ~437 | `className="text-secondary"` | `style={{ color: '#6A978F' }}` |

Resultado: os 4 ícones passarão a usar Verde Sálvia (#6A978F), a mesma cor de fundo do carrossel.

