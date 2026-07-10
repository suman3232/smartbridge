import { supabase } from "@/integrations/supabase/client";

export type UploadResult = {
  /** Path stored inside the bucket, e.g. `<userId>/169..._file.png`. */
  path: string;
  /** Public URL — only meaningful for public buckets (e.g. order-screenshots). */
  publicUrl: string;
};

function sanitizeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "file";
  return `${base}${ext}`;
}

/**
 * Upload a file to a Supabase Storage bucket under a per-user folder
 * (`<userId>/<timestamp>-<name>`), which the RLS policies key off of.
 */
export async function uploadFile(
  bucket: string,
  userId: string,
  file: File,
): Promise<UploadResult> {
  const path = `${userId}/${Date.now()}-${sanitizeName(file.name)}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/** Create a short-lived signed URL for a private bucket object (e.g. KYC docs). */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export const KYC_BUCKET = "kyc-documents";
export const ORDER_SCREENSHOT_BUCKET = "order-screenshots";
