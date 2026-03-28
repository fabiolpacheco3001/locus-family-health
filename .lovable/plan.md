

## Diagnóstico: Medicamentos = 0 para Admin Lívia

### Causa Raiz

O hook `useMedications` tem uma **race condition** entre o carregamento dos dados do grupo (`useFamilyGroup`) e a execução da query.

1. `useFamilyGroup` inicia com defaults: `groupId: null`, `isAdmin: true`
2. `useMedications` executa imediatamente. Como `isAdmin && groupId` = `true && null` = `false`, cai no `else` (linha 92): `.eq("user_id", user.id)`
3. Lívia não criou nenhum medicamento, então retorna `[]`
4. A `queryKey` é `["medications", "all"]` -- **não inclui `groupId` nem `isAdmin`**
5. Quando `useFamilyGroup` resolve com o `groupId` correto, o React Query **não refaz a query** porque a key não mudou e `staleTime` é 5 minutos

A request capturada na rede confirma: `&user_id=eq.0e81b4b9...` retornando `[]`.

### Correção

**Arquivo: `src/hooks/useMedications.tsx`**

1. Incluir `groupId`, `isAdmin`, `linkedMemberId` na `queryKey` para que a query seja re-executada quando o contexto do grupo carregar
2. Condicionar `enabled` para aguardar o carregamento do grupo (`!isLoading` do `useFamilyGroup`)

```typescript
// Antes
queryKey: ["medications", familyMemberId ?? "all"],
enabled: !!user && (!!familyMemberId || true),

// Depois
queryKey: ["medications", familyMemberId ?? "all", groupId, isAdmin, linkedMemberId],
enabled: !!user && !groupLoading,
```

Onde `groupLoading` vem de `useFamilyGroup()` (campo `isLoading`).

Isso garante que a query só executa após o RBAC resolver, e que qualquer mudança no contexto do grupo dispara uma nova busca.

### Impacto

Correção cirúrgica em um único arquivo. Nenhuma alteração visual. O carrossel e a lista de medicamentos passarão a refletir os dados corretos para admins que não criaram os registros.

