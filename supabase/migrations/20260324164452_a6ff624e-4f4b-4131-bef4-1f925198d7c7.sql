
-- AVATARS: INSERT
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- AVATARS: SELECT
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

-- RECEITAS: SELECT
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
