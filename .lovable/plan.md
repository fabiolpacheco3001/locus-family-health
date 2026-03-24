

## Diagnóstico: Erro de Upload de Avatar

**Causa raiz:** O bucket `avatars` existe e é público para leitura, mas a tabela `storage.objects` não possui políticas de RLS que permitam INSERT/UPDATE/DELETE para esse bucket. Resultado: qualquer tentativa de upload falha com "new row violates row-level security policy".

O mesmo problema afeta o bucket `receitas`.

## Plano de Correção

### Passo único: Criar políticas de RLS para os buckets `avatars` e `receitas`

Executar uma migration SQL com as seguintes políticas:

```sql
-- AVATARS: INSERT
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- AVATARS: SELECT (público)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- AVATARS: UPDATE
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars');

-- AVATARS: DELETE
CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars');

-- RECEITAS: INSERT
CREATE POLICY "Authenticated users can upload receitas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receitas');

-- RECEITAS: SELECT (público)
CREATE POLICY "Anyone can view receitas"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'receitas');

-- RECEITAS: UPDATE
CREATE POLICY "Authenticated users can update receitas"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receitas');

-- RECEITAS: DELETE
CREATE POLICY "Authenticated users can delete receitas"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receitas');
```

**Nenhum arquivo de código precisa ser alterado** — o `AvatarSelector.tsx` já usa a lógica correta de upload para o bucket `avatars`. O problema é exclusivamente de permissão no banco.

