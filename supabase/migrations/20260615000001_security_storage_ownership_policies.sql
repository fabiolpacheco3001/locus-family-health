-- =============================================================================
-- Security Fix: Storage Ownership Policies
-- Issues: #4 (receitas + avatars DELETE/UPDATE sem ownership check)
--         #8 (vaccine_documents sem UPDATE policy)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: receitas
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing permissive DELETE/UPDATE policies (if any)
DROP POLICY IF EXISTS "Users can delete own receitas" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own receitas" ON storage.objects;

-- DELETE: only the file owner can delete
CREATE POLICY "Users can delete own receitas"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'receitas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: only the file owner can overwrite
CREATE POLICY "Users can update own receitas"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'receitas'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'receitas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: avatars
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing permissive DELETE/UPDATE policies (if any)
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;

-- DELETE: only the file owner can delete
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: only the file owner can overwrite
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET: vaccine_documents
-- ─────────────────────────────────────────────────────────────────────────────

-- Add missing UPDATE policy (INSERT/SELECT/DELETE already exist)
DROP POLICY IF EXISTS "Users can update own vaccine documents" ON storage.objects;

CREATE POLICY "Users can update own vaccine documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vaccine_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'vaccine_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
