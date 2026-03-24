

## Plan: Aplicar fundo #f2f0eb em todas as telas

**Estrategia:** Mesma abordagem da Home — substituir `bg-background` por `bg-[#f2f0eb]` no container principal fixo de cada página. Para sub-páginas sem container próprio, o fundo vem do `AppLayout`/`MobileShell`, que também será atualizado.

### Alterações

**1. Container global — `src/components/MobileShell.tsx`**
- Trocar `bg-background` por `bg-[#f2f0eb]` (afeta todas as sub-páginas que herdam o fundo do layout)

**2. Páginas com Caixa Rígida (container fixo próprio) — substituir `bg-background` por `bg-[#f2f0eb]` no div principal:**

| Arquivo | Linha aprox. |
|---|---|
| `src/pages/Agenda.tsx` | ~123 |
| `src/pages/Familia.tsx` | ~11 |
| `src/pages/Ajustes.tsx` | ~35 |
| `src/pages/FamiliarProfile.tsx` | ~175 |
| `src/pages/MinhaSaude.tsx` | ~121 |
| `src/pages/Notificacoes.tsx` | ~133 |
| `src/pages/MeusDados.tsx` | ~87 |
| `src/pages/Seguranca.tsx` | ~66 |
| `src/pages/GerenciarFamilia.tsx` | ~41 |

**3. Página sem Caixa Rígida:**
- `src/pages/Metricas.tsx` (~122): trocar `bg-background` por `bg-[#f2f0eb]` no container e no header sticky

**4. Tela de Login — `src/pages/Login.tsx` (~43):**
- Trocar `bg-background` por `bg-[#f2f0eb]`

**Escopo excluído:** inputs, drawers, footers e headers internos (`bg-card`, `bg-background` em campos de formulário) permanecem inalterados — a mudança é apenas no fundo principal de cada tela.

