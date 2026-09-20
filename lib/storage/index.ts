/**
 * Storage Service
 * Unified interface for file storage with provider abstraction
 */

import {
  StorageConfig,
  StorageService,
  UploadOptions,
  UploadResult,
  PresignedUrlResult,
  DeleteResult,
} from "./types";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import { resolveStorageCredentials } from "@/lib/credentials";
import { S3CompatibleProvider } from "./providers/s3-compatible";
import { LocalStorageProvider } from "./providers/local";

// Re-export types for convenience
export * from "./types";

/**
 * Get storage configuration from database settings
 */
// Default allowed MIME types for file uploads
const DEFAULT_ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
  "image/x-icon",
  // Videos
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  // 3D Models
  "model/gltf-binary",
  "model/gltf+json",
  "application/octet-stream",
  // Documents
  "application/pdf",
];

const STORAGE_CONFIG_CACHE_TTL_MS = 60_000;
let storageConfigCache:
  | {
      value: StorageConfig;
      expiresAt: number;
    }
  | null = null;

export function clearStorageConfigCache() {
  storageConfigCache = null;
}

export async function getStorageConfig(): Promise<StorageConfig> {
  const now = Date.now();
  if (storageConfigCache && storageConfigCache.expiresAt > now) {
    return storageConfigCache.value;
  }

  await connectDB();
  const settings = await getSettings();

  const storage = settings.storage || {};

  // Use defaults if allowedMimeTypes is empty or not set
  // Always merge with essential types to prevent complete blocking
  const ESSENTIAL_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  let allowedMimeTypes =
    storage.allowedMimeTypes && storage.allowedMimeTypes.length > 0
      ? storage.allowedMimeTypes
      : DEFAULT_ALLOWED_MIME_TYPES;

  // Ensure essential image types are always allowed
  ESSENTIAL_TYPES.forEach((type) => {
    if (!allowedMimeTypes.includes(type)) {
      allowedMimeTypes = [...allowedMimeTypes, type];
    }
  });

  const provider: StorageConfig["provider"] =
    storage.provider === "s3"
      ? "s3"
      : storage.provider === "local"
        ? "local"
        : "cloudflare_r2";

  // Resolve credentials from two sources: DB settings win, .env is the
  // per-field fallback (STORAGE_* / CLOUDFLARE_R2_PUBLIC_URL).
  const creds = resolveStorageCredentials(storage);

  // Per-type size limits — Shopify defaults: 20MB image, 1024MB video, 500MB model.
  // Falls back to maxFileSizeMB if a type-specific value isn't configured.
  const fallback = storage.maxFileSizeMB || 20;
  const maxImageSizeMB = storage.maxImageSizeMB || fallback || 20;
  const maxVideoSizeMB = storage.maxVideoSizeMB || fallback || 1024;
  const maxModelSizeMB = storage.maxModelSizeMB || fallback || 500;

  if (process.env.NODE_ENV !== "production") {
    console.log("[Storage] Config loaded:", {
      provider,
      maxImageSizeMB,
      maxVideoSizeMB,
      maxModelSizeMB,
      allowedTypesCount: allowedMimeTypes.length,
      hasImageTypes: allowedMimeTypes.some((t: string) =>
        t.startsWith("image/"),
      ),
    });
  }

  const config = {
    provider,
    accountId: creds.accountId,
    endpoint: creds.endpoint,
    region: creds.region || "auto",
    bucketName: creds.bucketName,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    // publicUrl applies to R2/S3 only. Local storage always serves same-site
    // relative URLs — a leftover R2 public URL (in the DB or via
    // STORAGE_PUBLIC_URL / CLOUDFLARE_R2_PUBLIC_URL env fallback) must not
    // prefix local file paths, or every stored URL would 404.
    publicUrl: provider === "local" ? undefined : creds.publicUrl,
    maxFileSizeMB: fallback,
    maxImageSizeMB,
    maxVideoSizeMB,
    maxModelSizeMB,
    allowedMimeTypes,
    pathPrefix: storage.pathPrefix || "uploads/",
  };

  storageConfigCache = {
    value: config,
    expiresAt: now + STORAGE_CONFIG_CACHE_TTL_MS,
  };

  return config;
}

/**
 * Create storage service instance based on configuration
 */
export function createStorageService(config: StorageConfig): StorageService {
  if (config.provider === "local") {
    return new LocalStorageProvider(config);
  }
  return new S3CompatibleProvider(config);
}

/**
 * Get storage service with configuration from database
 */
export async function getStorageService(): Promise<StorageService> {
  const config = await getStorageConfig();
  return createStorageService(config);
}

/**
 * Normalize MIME type for comparison
 */
function normalizeMimeType(contentType: string): string {
  // Handle empty or undefined
  if (!contentType) return "";

  // Lowercase and trim
  let normalized = contentType.toLowerCase().trim();

  // Remove charset and other parameters (e.g., "image/png; charset=utf-8" -> "image/png")
  const semicolonIndex = normalized.indexOf(";");
  if (semicolonIndex !== -1) {
    normalized = normalized.substring(0, semicolonIndex).trim();
  }

  // Handle common variations
  if (normalized === "image/jpg") return "image/jpeg";

  return normalized;
}

/**
 * Pick the size limit (in MB) for a file based on its content type. Mirrors
 * the client-side per-type limits: image / video / 3D model each get their
 * own ceiling. Falls back to maxFileSizeMB for unknown types.
 */
function limitForContentType(
  config: StorageConfig,
  contentType: string,
): { maxMB: number; kind: "image" | "video" | "model" | "other" } {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("image/")) {
    return {
      maxMB: config.maxImageSizeMB ?? config.maxFileSizeMB,
      kind: "image",
    };
  }
  if (ct.startsWith("video/")) {
    return {
      maxMB: config.maxVideoSizeMB ?? config.maxFileSizeMB,
      kind: "video",
    };
  }
  if (
    ct.includes("model/gltf") ||
    ct === "application/octet-stream" ||
    ct.endsWith(".glb") ||
    ct.endsWith(".gltf")
  ) {
    return {
      maxMB: config.maxModelSizeMB ?? config.maxFileSizeMB,
      kind: "model",
    };
  }
  return { maxMB: config.maxFileSizeMB, kind: "other" };
}

/**
 * Validate file upload against storage configuration
 */
export function validateUpload(
  config: StorageConfig,
  fileSize: number,
  contentType: string,
): { valid: boolean; error?: string } {
  // Check file size — picks the right limit based on media type.
  const { maxMB, kind } = limitForContentType(config, contentType);
  const maxBytes = maxMB * 1024 * 1024;
  if (fileSize > maxBytes) {
    const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `${kind === "other" ? "File" : kind.charAt(0).toUpperCase() + kind.slice(1)} too large (${sizeMB}MB > ${maxMB}MB limit)`,
    };
  }

  // Check content type
  if (config.allowedMimeTypes.length > 0) {
    const normalizedContentType = normalizeMimeType(contentType);
    const normalizedAllowed = config.allowedMimeTypes.map(normalizeMimeType);

    // Check for exact match
    if (normalizedAllowed.includes(normalizedContentType)) {
      return { valid: true };
    }

    // Check for wildcard match (e.g., "image/*")
    const typePrefix = normalizedContentType.split("/")[0];
    if (normalizedAllowed.includes(`${typePrefix}/*`)) {
      return { valid: true };
    }

    // Check if it's a known media type even if not in allowed list
    // This helps with browsers that report different MIME types
    const isKnownImage = normalizedContentType.startsWith("image/");
    const isKnownVideo = normalizedContentType.startsWith("video/");
    const isKnownModel =
      normalizedContentType.includes("gltf") ||
      normalizedContentType === "application/octet-stream";

    // Allow known media types if their category is in allowed list
    if (isKnownImage && normalizedAllowed.some((m) => m.startsWith("image/"))) {
      return { valid: true };
    }
    if (isKnownVideo && normalizedAllowed.some((m) => m.startsWith("video/"))) {
      return { valid: true };
    }
    if (
      isKnownModel &&
      normalizedAllowed.some(
        (m) => m.includes("gltf") || m === "application/octet-stream"
      )
    ) {
      return { valid: true };
    }

    return {
      valid: false,
      error: `File type "${contentType}" is not allowed. Allowed types: ${config.allowedMimeTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Test storage connection with provided config (for testing from admin panel)
 * @param config Storage configuration
 * @param testPublicUrl When true, also verifies the public URL is reachable (used by "Test Connection" button)
 */
export async function testStorageConnection(
  config: StorageConfig,
  testPublicUrl = false,
): Promise<{ success: boolean; message: string }> {
  try {
    const service = createStorageService(config);
    const apiResult = await service.testConnection();

    if (!apiResult.success) return apiResult;

    // Optionally verify the public URL is actually accessible. Skipped for
    // local storage: files are served by this same app (writability is already
    // checked above) and a self-directed HEAD during setup may not resolve.
    if (testPublicUrl && config.publicUrl && config.provider !== "local") {
      try {
        // Upload a tiny test file via S3 API
        const uploaded = await service.uploadFile(Buffer.from("_"), {
          fileName: `_pub_test_${Date.now()}.txt`,
          contentType: "text/plain",
          fileSize: 1,
        });

        // Try to HEAD the file via the public URL
        let publicOk = false;
        try {
          const res = await fetch(uploaded.url, { method: "HEAD" });
          publicOk = res.ok;
        } catch {
          publicOk = false;
        }

        // Always clean up the test file
        await service.deleteFile(uploaded.key).catch(() => null);

        if (!publicOk) {
          return {
            success: false,
            message:
              'API credentials are correct, but the public URL is not accessible. ' +
              'Enable "Allow Access" in Cloudflare Dashboard → R2 → ' +
              `${config.bucketName} → Settings → Public access.`,
          };
        }

        return {
          success: true,
          message: `${config.provider === "cloudflare_r2" ? "Cloudflare R2" : "AWS S3"} connected and public URL verified`,
        };
      } catch (pubError: any) {
        return {
          success: false,
          message: `API connected but public URL test failed: ${pubError.message}`,
        };
      }
    }

    return apiResult;
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to initialize storage service",
    };
  }
}
