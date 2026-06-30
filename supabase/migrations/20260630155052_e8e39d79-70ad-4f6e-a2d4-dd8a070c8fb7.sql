CREATE POLICY "Users can update own surgery-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'surgery-documents' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'surgery-documents' AND owner = auth.uid());