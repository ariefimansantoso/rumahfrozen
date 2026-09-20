/**
 * POST /api/upload
 * Direct server-side file upload endpoint
 * Supports both single file and batch uploads
 * Uses configurable storage (Cloudflare R2, AWS S3)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { USER_ROLES } from "@/config/app.config";
import { rateLimitByUser } from "@/lib/api/rate-limit-middleware";
import {
  getStorageConfig,
  getStorageService,
  validateUpload,
} from "@/lib/storage";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getMediaType(
  mimeType: string,
): "image" | "video" | "model" | "document" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("gltf") || mimeType === "application/octet-stream")
    return "model";
  if (mimeType === "application/pdf") return "document";
  return null;
}

function isPrivilegedUser(user: {
  role?: string | null;
  roles?: Array<string | null | undefined> | null;
}) {
  const roles = user.roles ?? [user.role];
  return roles.some((role) => role && role !== USER_ROLES.CUSTOMER);
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication. Customers legitimately upload review/profile
    // images and privileged users upload product/store media, so any signed-in
    // user is allowed — but anonymous uploads to the storage bucket are not.
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }
    const demoBlock = getDemoModeMutationResponse({
      when: isPrivilegedUser(session.user),
    });
    if (demoBlock) return demoBlock;

    // Throttle per user to prevent storage-cost abuse from a compromised or
    // automated account.
    rateLimitByUser(
      request,
      session.user.id,
      "upload:create",
      "moderate",
      session.user.role,
    );

    const formData = await request.formData();

    // Support both 'file' (single) and 'files' (batch) field names
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;

    const allFiles = singleFile ? [singleFile, ...files] : files;

    if (!allFiles || allFiles.length === 0) {
      return NextResponse.json(
        { success: false, message: "No files provided" },
        { status: 400 },
      );
    }

    // Get storage configuration
    const config = await getStorageConfig();
    const storage = await getStorageService();

    const uploaded: {
      _id: string;
      url: string;
      key: string;
      type: "image" | "video" | "model" | "document" | null;
      mimeType: string;
      filename: string;
      size: number;
    }[] = [];

    const errors: string[] = [];

    for (const file of allFiles) {
      if (!(file instanceof File)) continue;

      // Handle empty mime type by defaulting to octet-stream
      const mimeType = file.type || "application/octet-stream";
      const mediaType = getMediaType(mimeType);

      // Validate upload against configuration
      const validation = validateUpload(config, file.size, mimeType);
      if (!validation.valid) {
        console.warn(
          `[Upload] Validation failed for ${file.name}: ${validation.error}`,
        );
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        const result = await storage.uploadFile(buffer, {
          fileName: file.name,
          contentType: mimeType,
          fileSize: file.size,
          metadata: session?.user?.id
            ? {
                uploadedBy: session.user.id,
                originalName: file.name,
              }
            : undefined,
        });

        uploaded.push({
          _id: crypto.randomUUID(),
          url: result.url,
          key: result.key,
          type: mediaType,
          mimeType,
          filename: file.name,
          size: file.size,
        });
      } catch (error) {
        errors.push(`${file.name}: ${getErrorMessage(error, "Upload failed")}`);
      }
    }

    if (uploaded.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid files were uploaded",
          errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: uploaded,
      message: `${uploaded.length} file(s) uploaded successfully`,
      provider: config.provider,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error, "Failed to upload files"),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require authentication for deletion
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }

    // Deletion accepts an arbitrary storage key, so it must be limited to
    // privileged users who manage store media. Customers (who can only upload
    // their own review/profile images) must not be able to delete bucket
    // objects by key.
    const roles = session.user.roles ?? [session.user.role];
    const isPrivileged = roles.some(
      (role) => role && role !== USER_ROLES.CUSTOMER,
    );
    if (!isPrivileged) {
      return NextResponse.json(
        { success: false, message: "You do not have permission to delete files" },
        { status: 403 },
      );
    }
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") || searchParams.get("filename");

    if (!key) {
      return NextResponse.json(
        { success: false, message: "File key or filename is required" },
        { status: 400 },
      );
    }

    const storage = await getStorageService();
    const result = await storage.deleteFile(key);

    return NextResponse.json({
      success: true,
      data: result,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error, "Failed to delete file"),
      },
      { status: 500 },
    );
  }
}
