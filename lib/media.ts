/**
 * Media URL Resolution Utility
 * Handles dual-origin strategy: local public assets vs remote CDN uploads
 */

export type MediaOrigin = "local" | "remote" | "placeholder";

export interface ResolvedMedia {
  url: string;
  origin: MediaOrigin;
  isOptimized: boolean;
}

export interface MediaResolutionOptions {
  fallback?: string;
  defaultWidth?: number;
  defaultHeight?: number;
}

/**
 * Check if a URL is a remote/CDN URL
 */
export function isRemoteUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  );
}

/**
 * Check if a URL is a local public asset
 */
export function isLocalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("/") && !isRemoteUrl(url);
}

/**
 * Check if a URL is a placeholder image (for seed/demo data)
 */
export function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("picsum.photos") ||
    url.includes("placeholder.com") ||
    url.includes("via.placeholder.com") ||
    url.includes("unsplash.com") ||
    url.includes("images.unsplash.com") ||
    url.includes("placeholder")
  );
}

/**
 * Detect the origin of a media URL
 */
export function detectMediaOrigin(url: string | null | undefined): MediaOrigin {
  if (!url) return "local";

  if (isRemoteUrl(url)) {
    if (isPlaceholderUrl(url)) {
      return "placeholder";
    }
    return "remote";
  }

  return "local";
}

/**
 * Resolve a media URL with fallback support
 * This is the main utility for handling dual-origin media
 */
export function resolveMediaUrl(
  url: string | null | undefined,
  options: MediaResolutionOptions = {},
): ResolvedMedia {
  const { fallback = "/placeholder.png" } = options;

  if (!url) {
    return {
      url: fallback,
      origin: "local",
      isOptimized: false,
    };
  }

  const origin = detectMediaOrigin(url);
  const isOptimized = origin === "local" || origin === "remote";

  return {
    url,
    origin,
    isOptimized,
  };
}

/**
 * Get the best URL for display based on environment
 * In development, local URLs are optimized by Next.js
 * In production, remote URLs are served via CDN
 */
export function getOptimizedMediaUrl(
  url: string | null | undefined,
  options: MediaResolutionOptions = {},
): string {
  return resolveMediaUrl(url, options).url;
}

/**
 * Seed data placeholder images using Picsum Photos
 * These are stable, real images perfect for demo/seed data
 */
export const SEED_PLACEHOLDER_CONFIG = {
  service: "picsum.photos",
  baseUrl: "https://picsum.photos",

  // Generate stable placeholder URL for a seed item
  generateProductImage: (seed: string, width = 800, height = 800): string => {
    return `https://picsum.photos/seed/${seed}/${width}/${height}`;
  },

  // Generate logo placeholder
  generateLogo: (seed: string, size = 200): string => {
    return `https://picsum.photos/seed/${seed}-logo/${size}/${size}`;
  },

  // Generate banner placeholder
  generateBanner: (seed: string, width = 1200, height = 400): string => {
    return `https://picsum.photos/seed/${seed}-banner/${width}/${height}`;
  },

  // Generate category image
  generateCategoryImage: (seed: string, width = 600, height = 400): string => {
    return `https://picsum.photos/seed/${seed}-category/${width}/${height}`;
  },

  // Generate blog post featured image
  generateBlogImage: (seed: string, width = 1200, height = 630): string => {
    return `https://picsum.photos/seed/${seed}-blog/${width}/${height}`;
  },

  // Generate OG image
  generateOgImage: (seed: string, width = 1200, height = 630): string => {
    return `https://picsum.photos/seed/${seed}-og/${width}/${height}`;
  },
};

/**
 * Local public asset paths for production static assets
 * These should be uploaded to /public folder or R2
 */
export const LOCAL_ASSET_PATHS = {
  logos: {
    main: "/logo.png",
    dark: "/logo-dark.png",
    favicon: "/favicon.ico",
  },
  placeholders: {
    product: "/placeholder-product.png",
    vendor: "/placeholder-vendor.png",
    category: "/placeholder-category.png",
    blog: "/placeholder-blog.png",
  },
  og: {
    default: "/og-image.png",
  },
};

/**
 * Check if R2/CDN is configured and available
 */
export function isCloudflareConfigured(): boolean {
  if (typeof window !== "undefined") {
    return false; // Client-side can't check server config
  }

  // This should be checked server-side
  // return Boolean(process.env.CLOUDFLARE_R2_PUBLIC_URL);
  return false; // Placeholder - actual check in storage config
}

/**
 * Upload file to R2/CDN and return the public URL
 * Used when user uploads media from admin panel
 */
export async function uploadToCloudflare(
  file: File | Buffer,
  path: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { getStorageService } = await import("@/lib/storage");
    const service = await getStorageService();

    let buffer: Buffer;
    let fileName: string;
    let contentType: string;

    if ("arrayBuffer" in file && typeof file.arrayBuffer === "function") {
      const webFile = file as File;
      buffer = Buffer.from(await webFile.arrayBuffer());
      fileName = webFile.name || "upload";
      contentType = webFile.type || "image/png";
    } else {
      buffer = file as Buffer;
      fileName = "upload";
      contentType = "image/png";
    }

    const result = await service.uploadFile(buffer, {
      fileName,
      contentType,
      fileSize: buffer.length,
      customPath: path,
    });

    return {
      success: true,
      url: result.url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("[Media] Upload to Cloudflare failed:", error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Delete file from R2/CDN
 */
export async function deleteFromCloudflare(key: string): Promise<boolean> {
  try {
    const { getStorageService } = await import("@/lib/storage");
    const service = await getStorageService();

    await service.deleteFile(key);
    return true;
  } catch (error) {
    console.error("[Media] Delete from Cloudflare failed:", error);
    return false;
  }
}

/**
 * Migration utility: Move seed placeholder URLs to R2 URLs
 * Use this when you want to replace placeholder images with real uploads
 */
export async function migrateSeedImagesToR2(
  items: Array<{ _id: string; field: string; newUrl: string }>,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const item of items) {
    try {
      // This would update the database field
      // Implementation depends on your model
      console.log(`[Migration] ${item.field}: ${item._id} → ${item.newUrl}`);
      success++;
    } catch (error) {
      console.error(`[Migration] Failed for ${item._id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}
