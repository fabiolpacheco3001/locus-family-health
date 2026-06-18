/**
 * useSignedUrl
 *
 * React Query hook that generates and caches a signed URL for a private
 * storage file (exam-files or receitas bucket).
 *
 * The URL is cached in React Query with a staleTime of (TTL - 60 s), so it
 * auto-refreshes before expiry while the component stays mounted — no manual
 * refresh needed.
 *
 * Usage:
 *   const { signedUrl, isLoading } = useSignedUrl(exam.file_url);
 *   const { signedUrl } = useSignedUrl(path, { bucket: PRESCRIPTIONS_BUCKET });
 */

import { useQuery } from "@tanstack/react-query";
import {
  EXAM_FILES_BUCKET,
  DISPLAY_EXPIRY_SECONDS,
  getSignedUrl,
} from "@/lib/storage";

interface UseSignedUrlOptions {
  /** Storage bucket name. Defaults to exam-files. */
  bucket?: string;
  /** URL TTL in seconds. Defaults to DISPLAY_EXPIRY_SECONDS (900 s). */
  expiresIn?: number;
  /** Set false to disable the query (e.g. when path is not yet known). */
  enabled?: boolean;
}

interface UseSignedUrlResult {
  signedUrl: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useSignedUrl(
  path: string | null | undefined,
  {
    bucket = EXAM_FILES_BUCKET,
    expiresIn = DISPLAY_EXPIRY_SECONDS,
    enabled = true,
  }: UseSignedUrlOptions = {},
): UseSignedUrlResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ["signed-url", bucket, path, expiresIn],
    queryFn: () => getSignedUrl(bucket, path, expiresIn),
    enabled: enabled && !!path,
    // Refresh 60 s before the URL expires so the UI never shows a broken link
    staleTime: Math.max((expiresIn - 60) * 1000, 0),
    gcTime: expiresIn * 1000,
    // Don't retry on failure — a missing file shouldn't block the UI
    retry: false,
  });

  return {
    signedUrl: data ?? null,
    isLoading,
    error: error as Error | null,
  };
}
