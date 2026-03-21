

## Diagnosis

The error occurs because the `exam-files` storage bucket has no RLS policies on `storage.objects`. The bucket exists and is public (allowing reads), but authenticated users cannot upload files because there's no INSERT/UPDATE/DELETE policy granting them access.

The flow in `AddExamDrawer.tsx` is:
1. Insert exam record (succeeds - exam appears in list)
2. Upload file to storage (FAILS - no RLS policy)
3. Update exam with file URL (never reached)
4. Catches error, shows "Erro ao salvar"

The exam record is created but the file never uploads, and the user sees a duplicate entry because the error doesn't roll back the insert.

## Fix

**Single database migration** to add RLS policies on `storage.objects` for the `exam-files` bucket:

```sql
-- Allow authenticated users to upload files to exam-files bucket
CREATE POLICY "Users can upload exam files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own exam files
CREATE POLICY "Users can update own exam files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own exam files
CREATE POLICY "Users can delete own exam files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exam-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access (bucket is already public)
CREATE POLICY "Public read access for exam files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'exam-files');
```

The policies use `storage.foldername(name)[1] = auth.uid()::text` because the upload path in `useExams.tsx` is `${user.id}/${examId}.${ext}`, meaning the first folder is the user's ID. This ensures users can only manage their own files.

No code changes needed -- only this migration.

