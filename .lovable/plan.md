

# Diagnóstico: Coroa Ausente na Lista de Familiares

## Causa Raiz

O registro do Admin na tabela `family_group_members` tem `family_member_id = NULL`. O código atual constrói um mapa `family_member_id → role`, mas como o valor é nulo, o Admin nunca é encontrado no mapa e a coroa não aparece.

## Solução

Precisamos de uma segunda via de correspondência: cruzar pelo `auth_user_id` do grupo com o `user_id` dos membros da família.

### Arquivo: `src/pages/GerenciarFamilia.tsx`

1. Expandir a query de `family_group_members` para também retornar `auth_user_id`
2. Construir o `roleMap` com **duas chaves**: `family_member_id` (quando existe) e `auth_user_id` (sempre)
3. Na hora de buscar o role de cada membro, tentar primeiro por `m.id` (family_member_id) e depois por `m.user_id` (auth_user_id)

```text
Lookup logic:
roleMap.get(m.id)              ← match por family_member_id (convidados)
  || roleMap.get(m.user_id)    ← match por auth_user_id (admin titular)
```

### Impacto nos outros pontos que usam roleMap

- `EditMemberDrawer`: recebe `memberRole` como prop do pai, então será corrigido automaticamente
- Nenhum outro arquivo precisa mudar

