

## Plan: Propagar MemberAvatar no Drawer do BottomNav

### Alteração em `src/components/BottomNav.tsx`

**Linhas 78-82:** Substituir a div circular com inicial estática pelo componente `<MemberAvatar>`:

```tsx
// De:
<div className="w-10 h-10 rounded-full bg-secondary/20 border-2 border-secondary ...">
  <span>{member.name.charAt(0).toUpperCase()}</span>
</div>

// Para:
<MemberAvatar avatarUrl={member.avatar_url} name={member.name} size="sm" />
```

Adicionar o import de `MemberAvatar` no topo do arquivo.

