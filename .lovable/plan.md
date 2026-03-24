

## Plan: Corrigir rota do Menu Família

**Problema:** O botão "Família" na barra inferior leva para `/familia`, onde clicar num membro abre o perfil de saúde (`/familiar/:id`). O usuário quer que leve para `/gerenciar-familia`, onde clicar num membro abre o drawer de edição.

### Alteração

**Arquivo:** `src/components/BottomNav.tsx`

- Trocar o `path` do item "Família" de `"/familia"` para `"/gerenciar-familia"`

```tsx
// De:
{ icon: Users, label: "Família", path: "/familia" },

// Para:
{ icon: Users, label: "Família", path: "/gerenciar-familia" },
```

Isso faz com que a aba "Família" na navegação inferior abra diretamente a tela de gerenciamento, onde selecionar um familiar abre o drawer de edição (e não o hub de saúde).

