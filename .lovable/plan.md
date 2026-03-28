

## Análise: Filtro de Privacidade no Dashboard para `role === 'user'`

### Resultado da Verificação

| Tela / Hook | Filtro RBAC | Status |
|---|---|---|
| **Home.tsx** - Pending Counts | ✅ `.in("family_member_id", allowedIds)` | OK |
| **Home.tsx** - Upcoming Appointments | ✅ `.in("family_member_id", allowedIds)` | OK |
| **useMedications.tsx** | ✅ `.in("family_member_id", allowedIds)` | OK |
| **MedicamentosGeral.tsx** | ✅ Usa `useMedications()` (já filtrado) | OK |
| **useNotifications.tsx** | ✅ Filtra por `user_id` (notificações são pessoais) | OK |
| **Agenda.tsx** | ❌ **BUG** - Filtra apenas por `linkedMemberId`, ignora `managed_profiles` | **FALHA** |

### Bug Encontrado: `Agenda.tsx` (linhas 64-73)

O código atual para usuários `role === 'user'`:
```typescript
} else if (linkedMemberId) {
  cq = cq.eq("family_member_id", linkedMemberId);  // ← só o próprio perfil
  eq = eq.eq("family_member_id", linkedMemberId);   // ← ignora managed_profiles
}
```

Deveria ser:
```typescript
} else if (linkedMemberId) {
  const allowedIds = [linkedMemberId, ...(managedProfiles ?? [])];
  cq = cq.in("family_member_id", allowedIds);
  eq = eq.in("family_member_id", allowedIds);
}
```

### Plano de Correção

1. **`Agenda.tsx`**: Importar `managedProfiles` do `useFamilyGroup()`, construir o array `allowedIds` e substituir `.eq()` por `.in()` para consultas e exames. Adicionar `managedProfiles` ao `queryKey` para cache correto.

Essa é a única correção necessária — todas as demais telas do Dashboard já aplicam o filtro corretamente.

