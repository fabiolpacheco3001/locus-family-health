-- =============================================================================
-- Security Fix: Drop broad Storage policies + add scoped SELECT/INSERT
-- Resolve 4 critical errors from new security scan:
--   1. receitas SELECT público (anon/role public lê prescrições)
--   2. exam-files SELECT público (anon/role public lê exames)
--   3. receitas DELETE/UPDATE amplos (qualquer auth sobrescreve arquivos alheios)
--   4. avatars DELETE/UPDATE amplos (idem)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: receitas (PRIVATE)
-- Dropar: SELECT público + DELETE/UPDATE/INSERT amplos (qualquer autenticado)
-- Manter: policies scoped "Users can delete/update own receitas" (migration 000001)
-- Adicionar: SELECT e INSERT scoped por auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop SELECT público (anon lê receitas de qualquer usuário)
DROP POLICY IF EXISTS "Anyone can view receitas" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for receitas" ON storage.objects;

-- Drop DELETE/UPDATE amplos (qualquer autenticado apaga/sobrescreve receitas alheias)
DROP POLICY IF EXISTS "Authenticated users can delete receitas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receitas" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete receitas" ON storage.objects;
DROP POLICY IF EXISTS "Users can update receitas" ON storage.objects;

-- Drop INSERT amplo (qualquer autenticado sobe em qualquer path)
DROP POLICY IF EXISTS "Authenticated users can upload receitas" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload receitas" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receitas" ON storage.objects;

-- SELECT scoped: somente dono do arquivo pode visualizar
DROP POLICY IF EXISTS "Users can view own receitas" ON storage.objects;
CREATE POLICY "Users can view own receitas"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receitas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT scoped: usuário só faz upload dentro de sua própria pasta (uid/)
DROP POLICY IF EXISTS "Users can upload own receitas" ON storage.objects;
CREATE POLICY "Users can upload own receitas"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receitas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: exam-files (PRIVATE)
-- Dropar: SELECT público + qualquer policy ampla legada
-- Adicionar: SELECT, INSERT, DELETE, UPDATE scoped por auth.uid()
-- (O bucket está privado desde a sessão anterior — mas sem policies SELECT/INSERT
--  autenticados não conseguem mais acessar seus próprios arquivos)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop SELECT público
DROP POLICY IF EXISTS "Public read access for exam files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view exam files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Drop qualquer policy ampla de escrita legada
DROP POLICY IF EXISTS "Authenticated users can upload exam files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete exam files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update exam files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload exam files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete exam files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update exam files" ON storage.objects;

-- SELECT scoped
DROP POLICY IF EXISTS "Users can view own exam files" ON storage.objects;
CREATE POLICY "Users can view own exam files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT scoped
DROP POLICY IF EXISTS "Users can upload own exam files" ON storage.objects;
CREATE POLICY "Users can upload own exam files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exam-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE scoped
DROP POLICY IF EXISTS "Users can delete own exam files" ON storage.objects;
CREATE POLICY "Users can delete own exam files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exam-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE scoped
DROP POLICY IF EXISTS "Users can update own exam files" ON storage.objects;
CREATE POLICY "Users can update own exam files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'exam-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'exam-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: avatars (PÚBLICO por design — renderização de foto de perfil)
-- Dropar: DELETE/UPDATE amplos (qualquer autenticado apaga/sobrescreve avatar alheio)
-- Manter: SELECT público (intencional)
-- Manter: policies scoped "Users can delete/update own avatars" (migration 000001)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop DELETE/UPDATE amplos
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;

-- Garantir que a policy de INSERT para avatars existe e é scoped
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
