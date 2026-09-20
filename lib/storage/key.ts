/**
 * Storage Key Generation
 *
 * Shared by every storage provider so the object-key layout (prefix +
 * date-partitioned folders + a collision-safe upload directory) is identical
 * no matter where the bytes actually land — Cloudflare R2, AWS S3, or local.
 */

import type { UploadOptions } from "./types";

/**
 * Build the storage object key for an upload.
 */
export function generateStorageKey(
  pathPrefix: string | undefined,
  options: UploadOptions,
): string {
  const prefix = pathPrefix || "";
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  // Keep the original basename visible at the end of the public URL. Only
  // characters that are unsafe in an object key are replaced; casing and the
  // extension are preserved. A unique parent directory prevents same-name
  // uploads from overwriting one another without changing the filename.
  const originalBaseName = options.fileName.split(/[\\/]/).pop() || "upload";
  const sanitizedName =
    originalBaseName
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "") || "upload";
  const uploadDirectory = `${timestamp}-${randomSuffix}`;

  if (options.customPath) {
    // A trailing slash marks customPath as a target directory rather than a
    // full object key. Append a collision-safe directory and the original
    // filename so callers passing only a folder (e.g. "ai-generated/") don't
    // all write to the same key and silently overwrite one another.
    if (options.customPath.endsWith("/")) {
      return `${prefix}${options.customPath}${uploadDirectory}/${sanitizedName}`;
    }
    return `${prefix}${options.customPath}`;
  }

  // Generate path: uploads/2024/01/timestamp-random/filename.ext
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${prefix}${year}/${month}/${uploadDirectory}/${sanitizedName}`;
}
