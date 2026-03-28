

## Diagnóstico: Erro ao Salvar no Editar Familiar

### Causa Raiz: RLS Policy de UPDATE incompleta

O problema está nas políticas de RLS (Row Level Security) da tabela `family_members`. Atualmente existem duas políticas de UPDATE:

1. **"Users can update own family members"** - `auth.uid() = user_id`
2. **"Users can update permitted profiles"** - `auth.uid() = user_id OR id IN (managed_profiles)`

**O bug:** Quando um Admin (ex: Fábio, `auth_user_id = 9a9b0b31`) tenta editar um membro criado por outro usuário (ex: "Teste de Usuário", `user_id = c3bf7aa8`), **nenhuma das duas políticas é satisfeita** porque:
- `auth.uid()` (admin) ≠ `user_id` do membro (convidado criou o próprio perfil)
- O admin não tem `managed_profiles` (campo vazio), e a segunda policy exige `auth.uid() = user_id` como OR

Ou seja, **admins não conseguem editar membros cujo `user_id` difere do deles**. Isso afeta qualquer membro que foi criado por um convidado ou por outro admin no grupo.

### Solução

**Passo 1 - Migração SQL:** Substituir as duas políticas de UPDATE por uma única policy consolidada que cubra os 3 cenários:

```sql
-- Drop the two existing UPDATE policies
DROP POLICY "Users can update own family members" ON public.family_members;
DROP POLICY "Users can update permitted profiles" ON public.family_members;

-- Create a single consolidated UPDATE policy
CREATE POLICY "Group members can update family members"
ON public.family_members FOR UPDATE
TO authenticated
USING (
  -- Case 1: Admin can update ANY member in their group
  EXISTS (
    SELECT 1 FROM public.family_group_members
    WHERE auth_user_id = auth.uid()
      AND group_id = family_members.group_id
      AND role = 'admin'
  )
  OR
  -- Case 2: User updating their own linked profile
  id = (
    SELECT family_member_id FROM public.family_group_members
    WHERE auth_user_id = auth.uid() LIMIT 1
  )
  OR
  -- Case 3: User updating a profile in their managed_profiles
  id IN (
    SELECT unnest(managed_profiles) FROM public.family_group_members
    WHERE auth_user_id = auth.uid()
  )
);
```

**Passo 2 - Nenhuma alteração de código necessária.** O `EditMemberDrawer.tsx` já funciona corretamente; o erro vem exclusivamente do banco rejeitando o UPDATE por RLS.

### Impacto

- Admins poderão editar todos os membros do grupo (incluindo convidados e pets de outros admins)
- Convidados poderão editar seu próprio perfil + perfis em `managed_profiles`
- A segurança é mantida: ninguém edita membros fora do seu grupo

