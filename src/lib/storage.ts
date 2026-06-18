/**
 * Storage utilities for private bucket access (LGPD — BK-06).
 *
 * Both clinical buckets are PRIVATE — files are NEVER accessible via public URL.
 * All access goes through signed URLs with a short TTL, preventing link sharing.
 *
 * Buckets:
 *   exam-files  — exam result files + prescription images (current)
 *   receitas    — legacy prescription bucket (private, kept for historical data)
 */
import { supabase } from "@/integrations/supabase/client";

export const EXAM_FILES_BUCKET = "exam-files";
export const PRESCRIPTIONS_BUCKET = "receitas";

/** TTL for display/viewer signed URLs — 15 minutes (LGPD: short-lived, no permanent links) */
export const DISPLAY_EXPIRY_SECONDS = 900;

/** TTL for edge-function signed URLs — 2 minutes (enough for OCR round-trip) */
export const EDGE_EXPIRY_SECONDS = 120;

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the value is a full URL (legacy rows stored URLs, not paths). */
export function isLegacyPublicUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

/**
 * Converts a legacy full URL back to a storage path for a given bucket.
 * e.g. "https://xxx.supabase.co/.../exam-files/uid/file.jpg" → "uid/file.jpg"
 */
export function extractPathFromUrl(url: string, bucket = EXAM_FILES_BUCKET): string {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : url;
}

/** Normalises a stored value to a storage path (handles both legacy URLs and paths). */
export function normalisePath(
  value: string | null | undefined,
  bucket = EXAM_FILES_BUCKET,
): string | null {
  if (!value) return null;
  return isLegacyPublicUrl(value) ? extractPathFromUrl(value, bucket) : value;
}

// ── core signed-URL generator ─────────────────────────────────────────────────

/**
 * Low-level: create a signed URL for any private bucket and path.
 * Prefer the typed wrappers below (getDisplaySignedUrl, getEdgeSignedUrl).
 */
export async function getSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn: number,
): Promise<string | null> {
  const normPath = normalisePath(path, bucket);
  if (!normPath) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(normPath, expiresIn);
  if (error || !data?.signedUrl) {
    console.error(`storage.getSignedUrl [${bucket}] error:`, error);
    return null;
  }
  return data.signedUrl;
}

// ── typed wrappers ────────────────────────────────────────────────────────────

/**
 * Signed URL for displaying a file in the UI (img / iframe / viewer).
 * TTL: 15 minutes. Returns null if path is empty or generation fails.
 *
 * @param path  Storage path or legacy public URL.
 * @param bucket  Defaults to exam-files. Pass PRESCRIPTIONS_BUCKET for legacy receitas.
 */
export async function getDisplaySignedUrl(
  path: string | null | undefined,
  bucket = EXAM_FILES_BUCKET,
): Promise<string | null> {
  return getSignedUrl(bucket, path, DISPLAY_EXPIRY_SECONDS);
}

/**
 * Short-lived signed URL for passing to an Edge Function (OCR / analysis).
 * TTL: 2 minutes.
 *
 * @param path  Storage path or legacy public URL.
 * @param bucket  Defaults to exam-files.
 */
export async function getEdgeSignedUrl(
  path: string | null | undefined,
  bucket = EXAM_FILES_BUCKET,
): Promise<string | null> {
  return getSignedUrl(bucket, path, EDGE_EXPIRY_SECONDS);
}
