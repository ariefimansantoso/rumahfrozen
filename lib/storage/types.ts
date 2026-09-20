/**
 * Storage Types
 * TypeScript interfaces for storage providers
 */

export type StorageProvider = "cloudflare_r2" | "s3" | "local";

export interface StorageConfig {
  provider: StorageProvider;
  accountId?: string; // Cloudflare R2 Account ID
  endpoint?: string;
  region?: string;
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  maxFileSizeMB: number;
  // Per-media-type limits, Shopify-style. When set, the type-specific
  // limit takes precedence over maxFileSizeMB for that kind of file.
  maxImageSizeMB?: number;
  maxVideoSizeMB?: number;
  maxModelSizeMB?: number;
  allowedMimeTypes: string[];
  pathPrefix?: string;
}

export interface UploadOptions {
  // File details
  fileName: string;
  contentType: string;
  fileSize: number;

  // Optional metadata
  metadata?: Record<string, string>;

  // Custom path (overrides default)
  customPath?: string;
}

export interface UploadResult {
  success: boolean;
  key: string; // Storage key/path
  url: string; // Public URL
  size: number;
  contentType: string;
}

export interface PresignedUrlResult {
  success: boolean;
  uploadUrl: string; // Presigned PUT URL
  publicUrl: string; // Final public URL after upload
  key: string; // Storage key
  expiresIn: number; // Seconds until expiration
}

export interface DeleteResult {
  success: boolean;
  key: string;
}

export interface StorageObject {
  key: string;
  url: string;
  size: number;
  lastModified?: string; // ISO timestamp
}

export interface ListFilesOptions {
  /** Provider-specific continuation token from a previous page. */
  cursor?: string;
  /** Max objects per page (default 50). */
  limit?: number;
}

export interface ListFilesResult {
  success: boolean;
  files: StorageObject[];
  /** Present when more pages exist; pass back as `cursor`. */
  nextCursor?: string;
}

export interface StorageService {
  /**
   * Generate a presigned URL for direct upload
   */
  getPresignedUploadUrl(options: UploadOptions): Promise<PresignedUrlResult>;

  /**
   * Upload a file directly (server-side)
   */
  uploadFile(file: Buffer, options: UploadOptions): Promise<UploadResult>;

  /**
   * Delete a file from storage
   */
  deleteFile(key: string): Promise<DeleteResult>;

  /**
   * List stored files under the configured path prefix (paginated).
   * Powers the admin Media Library for every provider.
   */
  listFiles(options?: ListFilesOptions): Promise<ListFilesResult>;

  /**
   * A URL the browser can actually load for this key right now. Equals the
   * public URL normally; S3/R2 buckets with no public URL configured get a
   * short-lived presigned GET URL instead (used by the admin Media Library).
   */
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Get public URL for a stored file
   */
  getPublicUrl(key: string): string;

  /**
   * Check if storage is configured and accessible
   */
  testConnection(): Promise<{ success: boolean; message: string }>;
}
