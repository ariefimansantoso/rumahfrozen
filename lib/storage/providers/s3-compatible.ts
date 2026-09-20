/**
 * S3-Compatible Storage Provider
 * Works with AWS S3 and Cloudflare R2
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  StorageConfig,
  StorageService,
  UploadOptions,
  UploadResult,
  PresignedUrlResult,
  DeleteResult,
  ListFilesOptions,
  ListFilesResult,
  StorageObject,
} from "../types";
import { generateStorageKey } from "../key";

const PRESIGNED_URL_EXPIRES_IN = 300; // 5 minutes

/**
 * Resolve a usable AWS region for provider "s3". The storage settings default
 * region to "auto" (an R2-only value that also lingers after switching
 * providers) — AWS rejects it, so treat "auto"/empty as us-east-1.
 */
function awsRegion(region: string | undefined): string {
  return region && region !== "auto" ? region : "us-east-1";
}

export class S3CompatibleProvider implements StorageService {
  private client: S3Client;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;

    // Validate required fields
    if (!config.bucketName) {
      throw new Error("Bucket name is required for S3-compatible storage");
    }
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error(
        "Access credentials are required for S3-compatible storage",
      );
    }

    // Construct endpoint based on provider
    let endpoint = config.endpoint;
    if (config.provider === "cloudflare_r2") {
      if (!config.accountId) {
        throw new Error("Account ID is required for Cloudflare R2");
      }
      endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    }
    this.config.endpoint = endpoint;

    // Initialize S3 client
    // R2 always requires "auto" region — ignore any stored region value
    const region =
      config.provider === "cloudflare_r2" ? "auto" : awsRegion(config.region);
    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Path-style addressing for R2 and for any custom endpoint
      // (MinIO/Spaces/…): virtual-hosted requests to `bucket.<endpoint-host>`
      // usually fail there, and getPublicUrl builds path-style URLs for
      // custom endpoints — keep the two consistent.
      forcePathStyle: config.provider === "cloudflare_r2" || Boolean(endpoint),
    });
  }

  /**
   * Generate storage key from options
   */
  private generateKey(options: UploadOptions): string {
    return generateStorageKey(this.config.pathPrefix, options);
  }

  /**
   * Get public URL for a key
   */
  getPublicUrl(key: string): string {
    if (this.config.publicUrl) {
      // Use configured CDN/public URL
      const baseUrl = this.config.publicUrl.replace(/\/$/, "");
      return `${baseUrl}/${key}`;
    }

    // Construct URL from endpoint
    if (this.config.endpoint) {
      const baseUrl = this.config.endpoint.replace(/\/$/, "");
      return `${baseUrl}/${this.config.bucketName}/${key}`;
    }

    // Default S3 URL format
    return `https://${this.config.bucketName}.s3.${awsRegion(this.config.region)}.amazonaws.com/${key}`;
  }

  /**
   * Generate presigned upload URL
   */
  async getPresignedUploadUrl(
    options: UploadOptions,
  ): Promise<PresignedUrlResult> {
    const key = this.generateKey(options);

    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.fileSize,
      Metadata: options.metadata,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    });

    return {
      success: true,
      uploadUrl,
      publicUrl: this.getPublicUrl(key),
      key,
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    };
  }

  /**
   * Upload file directly (server-side)
   */
  async uploadFile(
    file: Buffer,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const key = this.generateKey(options);

    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      Body: file,
      ContentType: options.contentType,
      ContentLength: options.fileSize,
      Metadata: options.metadata,
    });

    await this.client.send(command);

    return {
      success: true,
      key,
      url: this.getPublicUrl(key),
      size: options.fileSize,
      contentType: options.contentType,
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<DeleteResult> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });

    await this.client.send(command);

    return {
      success: true,
      key,
    };
  }

  /**
   * List stored files under the path prefix via ListObjectsV2. The cursor is
   * the S3 continuation token. Order is the bucket's lexicographic key order
   * (date-partitioned keys ⇒ roughly chronological).
   */
  async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    const command = new ListObjectsV2Command({
      Bucket: this.config.bucketName,
      Prefix: this.config.pathPrefix || undefined,
      MaxKeys: limit,
      ContinuationToken: options.cursor || undefined,
    });

    const response = await this.client.send(command);

    const files: StorageObject[] = (response.Contents ?? [])
      .filter((object) => object.Key && !object.Key.endsWith("/"))
      .map((object) => ({
        key: object.Key as string,
        url: this.getPublicUrl(object.Key as string),
        size: object.Size ?? 0,
        lastModified: object.LastModified?.toISOString(),
      }));

    return {
      success: true,
      files,
      nextCursor: response.IsTruncated
        ? response.NextContinuationToken
        : undefined,
    };
  }

  /**
   * Loadable URL for a key. With a public URL configured that's the public
   * URL; otherwise a short-lived presigned GET, so the admin Media Library
   * can preview bucket contents even before public access is set up.
   */
  async getDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.config.publicUrl) return this.getPublicUrl(key);

    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Test storage connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const command = new HeadBucketCommand({
        Bucket: this.config.bucketName,
      });

      await this.client.send(command);

      const providerName =
        this.config.provider === "cloudflare_r2" ? "Cloudflare R2" : "AWS S3";

      return {
        success: true,
        message: `${providerName} connected successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to connect to storage",
      };
    }
  }
}
