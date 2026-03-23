

## Plan: Persistir Avatar no Banco de Dados

### Problema
O avatar selecionado (emoji ou imagem Base64) existe apenas em memória (React state). Ao recarregar a página ou navegar, ele volta para as iniciais porque nunca é salvo no banco.

### Solução

**1. Migration: adicionar coluna `avatar_url` na tabela `family_members`**

```sql
ALTER TABLE public.family_members ADD COLUMN avatar_url text;
```

**2. Atualizar `useFamilyMembers.tsx`**
- Adicionar `avatar_url` ao tipo `FamilyMember`
- Adicionar `avatar_url` ao tipo `NewFamilyMember`

**3. Atualizar `MeusDados.tsx`**
- No `useEffect`, carregar `avatarUrl` do `titular.avatar_url`
- No `handleSave`, incluir `avatar_url: avatarUrl || null` no payload de update

**4. Atualizar `EditMemberDrawer.tsx`**
- No `useEffect`, carregar `avatarUrl` do `member.avatar_url`
- No `handleSave`, incluir `avatar_url: avatarUrl || null`

**5. Exibição global do avatar**
- Nos locais que renderizam membros da família (Home, GerenciarFamilia, FamiliarProfile, seletores), usar `member.avatar_url` para renderizar emoji/imagem ao invés de apenas iniciais

### Nota sobre imagens Base64
Strings Base64 de fotos podem ser muito grandes para uma coluna `text` no banco. Para o MVP isso funciona, mas no futuro deve-se migrar para Storage (bucket) com URL pública.

