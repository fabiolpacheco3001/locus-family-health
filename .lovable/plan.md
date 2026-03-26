

# Diagnóstico: Coroa Ausente no EditMemberDrawer

## Causa Raiz

A coroa e a badge "Admin"/"Convidado" foram implementadas apenas em dois lugares:
1. **Lista de familiares** (`GerenciarFamilia.tsx`, linha 110-111) — ✅ funciona
2. **Tela Meus Dados** (`MeusDados.tsx`) — ✅ funciona

Porém, o **EditMemberDrawer** (o drawer que abre ao clicar num membro) não recebe nenhuma informação de role e não exibe nenhuma badge. É o drawer da screenshot.

## Plano de Correção

### Arquivo: `src/components/EditMemberDrawer.tsx`

1. Importar `Crown`, `User` do lucide-react e o hook `useFamilyGroup`
2. Fazer uma query pontual em `family_group_members` para buscar o role vinculado ao `member.id` (via `family_member_id`)
3. Abaixo do avatar (após `renderAvatar()`), exibir uma badge:
   - **Admin**: `Crown` amber-500 + tag escura "Admin"
   - **Convidado**: `User` icon + tag cinza "Usuário Convidado"  
   - **Sem vínculo** (pet, criança): nenhuma badge

### Alternativa mais simples

Passar o `roleMap` já calculado em `GerenciarFamilia.tsx` como prop para o `EditMemberDrawer`, evitando uma query extra. O drawer receberia uma prop `memberRole?: string` e renderizaria a badge condicionalmente.

### Implementação preferida (prop drilling — zero queries extras)

- `GerenciarFamilia.tsx`: ao chamar `setEditMember(m)`, também guardar o role: `setEditMemberRole(roleMap.get(m.id))`
- `EditMemberDrawer`: nova prop `memberRole?: string`, renderizar badge abaixo do nome no header

