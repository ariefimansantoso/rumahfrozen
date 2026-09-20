/**
 * POST /api/admin/settings/test-storage
 * Test storage connection with provided configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { USER_ROLES } from "@/config/app.config";
import { testStorageConnection, StorageConfig } from "@/lib/storage";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }
    if (session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 },
      );
    }
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    const body = await request.json();
    const {
      provider,
      accountId,
      endpoint,
      region,
      bucketName,
      accessKeyId,
      secretAccessKey,
      publicUrl,
    } = body;

    // Validate required fields based on provider. Local storage needs no
    // credentials or bucket — it just writes to the server's disk.
    if (provider !== "local") {
      if (!bucketName || !accessKeyId || !secretAccessKey) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Bucket name, access key ID, and secret access key are required",
          },
          { status: 400 },
        );
      }

      if (provider === "cloudflare_r2" && !accountId) {
        return NextResponse.json(
          {
            success: false,
            message: "Account ID is required for Cloudflare R2",
          },
          { status: 400 },
        );
      }
    }

    // Build config object
    const config: StorageConfig = {
      provider,
      accountId,
      endpoint,
      region: region || "auto",
      bucketName,
      accessKeyId,
      secretAccessKey,
      publicUrl,
      maxFileSizeMB: 10,
      allowedMimeTypes: [],
    };

    // Test connection + public URL accessibility
    const result = await testStorageConnection(config, true);

    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (error: any) {
    console.error("Storage test error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to test storage connection",
      },
      { status: 500 },
    );
  }
}
