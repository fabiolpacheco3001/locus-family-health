-- =============================================================================
-- Security Fix: Trocar role public → authenticated em todas as storage policies
-- Previne acesso anônimo via pasta "null" (auth.uid() retorna NULL para anon,
-- permitindo que usuário não-logado operasse em bucket_id/null/)
-- =============================================================================

-- ─── BUCKET: receitas (PRIVATE) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own receitas"   ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own receitas"  ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receitas"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update own receitas"  ON storage.objects;

CREATE POLICY "Users can view own receitas"
ON storage.objects FOR SELECT TO authenticated
USING ( bucket_id = 'receitas' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can upload own receitas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'receitas' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can delete own receitas"
ON storage.objects FOR DELETE TO authenticated
USING ( bucket_id = 'receitas' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can update own receitas"
ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'receitas' AND (storage.foldername(name))[1] = auth.uid()::text )
WITH CHECK ( bucket_id = 'receitas' AND (storage.foldername(name))[1] = auth.uid()::text );

-- ─── BUCKET: exam-files (PRIVATE) ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own exam files"   ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own exam files"  ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own exam files"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update own exam files"  ON storage.objects;

CREATE POLICY "Users can view own exam files"
ON storage.objects FOR SELECT TO authenticated
USING ( bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can upload own exam files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can delete own exam files"
ON storage.objects FOR DELETE TO authenticated
USING ( bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can update own exam files"
ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text )
WITH CHECK ( bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text );

-- ─── BUCKET: avatars (PUBLIC por design — SELECT mantido público) ─────────────
DROP POLICY IF EXISTS "Users can upload own avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars"  ON storage.objects;

CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE TO authenticated
USING ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text )
WITH CHECK ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );

-- ─── BUCKET: vaccine_documents ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own vaccine documents" ON storage.objects;

CREATE POLICY "Users can update own vaccine documents"
ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'vaccine_documents' AND (storage.foldername(name))[1] = auth.uid()::text )
WITH CHECK ( bucket_id = 'vaccine_documents' AND (storage.foldername(name))[1] = auth.uid()::text );
