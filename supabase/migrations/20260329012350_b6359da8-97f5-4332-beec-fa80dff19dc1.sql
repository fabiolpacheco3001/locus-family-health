
-- Create vaccine_documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vaccine_documents', 'vaccine_documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload vaccine documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vaccine_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Allow authenticated users to read their own files
CREATE POLICY "Users can read own vaccine documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vaccine_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own vaccine documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vaccine_documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
