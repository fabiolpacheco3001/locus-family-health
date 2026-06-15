-- =============================================================================
-- Migrate exam file_url and medication receita_url from full public URLs to
-- storage paths. Both columns point to the "exam-files" bucket.
--
-- Legacy format:
--   https://<project>.supabase.co/storage/v1/object/public/exam-files/<path>
-- New format (path only):
--   <uid>/<filename>
--
-- Safe to re-run: the WHERE clause skips rows that are already paths.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- exams.file_url
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE exams
SET file_url = regexp_replace(
  file_url,
  '^.*/storage/v1/object/public/exam-files/',
  ''
)
WHERE file_url IS NOT NULL
  AND file_url LIKE '%/storage/v1/object/public/exam-files/%';

-- ─────────────────────────────────────────────────────────────────────────────
-- medications.receita_url
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE medications
SET receita_url = regexp_replace(
  receita_url,
  '^.*/storage/v1/object/public/exam-files/',
  ''
)
WHERE receita_url IS NOT NULL
  AND receita_url LIKE '%/storage/v1/object/public/exam-files/%';
