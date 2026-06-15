/**
 * Storage utilities for private bucket access.
 * All medical files (exam-files) are stored in a private bucket.
 * Use these helpers to generate short-lived signed URLs for display and edge functions.
 */
import { supabase } from "@/integrations/supabase/client";

export const EXAM_FILES_BUCKET = "exam-files";

/** Expiry for display/viewer signed URLs (10 minutes) */
const DISPLAY_EXPIRY_SECONDS = 600;

/** Expiry for edge-function signed URLs (2 minutes — enough for OCR round-trip) */
const EDGE_EXPIRY_SECONDS = 120;

/**
 * Returns true if the value looks like a full public URL (legacy rows).
 * After migration all stored values are paths, but we keep this for safety.
 */
export function isLegacyPublicUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

/**
 * Converts a legacy full public URL back to a storage path.
 * e.g. "https://xxx.supabase.co/.../exam-files/uid/file.jpg" → "uid/file.jpg"
 */
export function extractPathFromUrl(url: string): string {
  const marker = `/${EXAM_FILES_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length) : url;
}

/**
 * Normalises a stored value to a path regardless of whether it's a legacy URL or already a path.
 */
export function normalisePath(value: string | null | undefined): string | null {
  if (!value) return null;
  return isLegacyPublicUrl(value) ? extractPathFromUrl(value) : value;
}

/**
 * Creates a signed URL for displaying a file in the UI (img/iframe).
 * Returns null if the path is empty or the call fails.
 */
export async function getDisplaySignedUrl(path: string | null | undefined): Promise<string | null> {
  const normPath = normalisePath(path);
  if (!normPath) return null;
  const { data, error } = await supabase.storage
    .from(EXAM_FILES_BUCKET)
    .createSignedUrl(normPath, DISPLAY_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("storage.getDisplaySignedUrl error:", error);
    return null;
  }
  return data.signedUrl;
}

/**
 * Creates a short-lived signed URL to pass to an Edge Function for OCR/analysis.
 */
export async function getEdgeSignedUrl(path: string | null | undefined): Promise<string | null> {
  const normPath = normalisePath(path);
  if (!normPath) return null;
  const { data, error } = await supabase.storage
    .from(EXAM_FILES_BUCKET)
    .createSignedUrl(normPath, EDGE_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("storage.getEdgeSignedUrl error:", error);
    return null;
  }
  return data.signedUrl;
}
