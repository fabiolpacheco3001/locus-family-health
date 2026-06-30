-- SEC-004: Permitir que membros do grupo familiar vejam documentos de cirurgia
-- cujo uploader pertence ao mesmo grupo.
DROP POLICY IF EXISTS "Users can view own surgery-documents" ON storage.objects;

CREATE POLICY "Group members can view surgery-documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'surgery-documents'
  AND (
    owner = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.family_group_members my_fgm
      JOIN public.family_group_members their_fgm
        ON my_fgm.group_id = their_fgm.group_id
      WHERE my_fgm.auth_user_id = (select auth.uid())
        AND their_fgm.auth_user_id = storage.objects.owner
    )
  )
);