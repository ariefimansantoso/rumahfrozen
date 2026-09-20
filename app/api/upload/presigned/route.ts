/**
 * POST /api/upload/presigned
 * Generate presigned URLs for direct client-to-storage uploads
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getStorageConfig,
  getStorageService,
  validateUpload,
} from "@/lib/storage";
import { USER_ROLES } from "@/config/app.config";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";

function isPrivilegedUser(user: {
  role?: string | null;
  roles?: Array<string | null | undefined> | null;
}) {
  const roles = user.roles ?? [user.role];
  return roles.some((role) => role && role !== USER_ROLES.CUSTOMER);
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
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

    const body = await request.json();
    const { fileName, contentType, fileSize, customPath } = body;

    // Validate required fields
    if (!fileName || !contentType || !fileSize) {
      return NextResponse.json(
        {
          success: false,
          message: "fileName, contentType, and fileSize are required",
        },
        { status: 400 },
      );
    }

    // Get storage configuration
    const config = await getStorageConfig();

    // Validate upload against configuration
    const validation = validateUpload(config, fileSize, contentType);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400 },
      );
    }

    // Get storage service and generate presigned URL
    const storage = await getStorageService();

    const result = await storage.getPresignedUploadUrl({
      fileName,
      contentType,
      fileSize,
      customPath,
      metadata: {
        uploadedBy: session.user.id,
        originalName: fileName,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: result.uploadUrl,
        publicUrl: result.publicUrl,
        key: result.key,
        filename: fileName,
        expiresIn: result.expiresIn,
        provider: config.provider,
      },
    });
  } catch (error: any) {
    console.error("Presigned URL generation error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to generate upload URL",
      },
      { status: 500 },
    );
  }
}
