
CREATE POLICY "Users can upload exam files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own exam files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own exam files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read access for exam files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'exam-files');
