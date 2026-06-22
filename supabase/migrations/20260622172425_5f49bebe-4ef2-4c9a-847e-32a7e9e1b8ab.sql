
CREATE POLICY "Users can upload to surgery-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'surgery-documents' AND owner = auth.uid());

CREATE POLICY "Users can view own surgery-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'surgery-documents' AND owner = auth.uid());

CREATE POLICY "Users can delete own surgery-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'surgery-documents' AND owner = auth.uid());
