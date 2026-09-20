/**
 * POST /api/admin/settings/test-ai
 * Verify an OpenAI API key works. Tests the key from the request body when
 * provided (the unsaved form value); otherwise the stored/env-resolved key.
 * Never echoes any key back.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { USER_ROLES } from "@/config/app.config";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";
import { getSettings } from "@/models/settings.model";
import { resolveOpenAICredentials } from "@/lib/credentials";

export async function POST(request: NextRequest) {
  try {
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

    let candidateKey = "";
    try {
      const body = await request.json();
      if (body && typeof body.apiKey === "string") {
        candidateKey = body.apiKey.trim();
      }
    } catch {
      // Empty body is fine — fall through to the stored key.
    }

    let apiKey = candidateKey;
    if (!apiKey) {
      const settings = await getSettings();
      apiKey = resolveOpenAICredentials(settings.aiAuthoring).apiKey || "";
    }
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No API key to test. Enter a key or set OPENAI_API_KEY in the environment.",
        },
        { status: 400 },
      );
    }

    const client = new OpenAI({ apiKey, timeout: 15000, maxRetries: 0 });
    await client.models.list();

    return NextResponse.json({
      success: true,
      message: "Connection successful. The OpenAI key is valid.",
    });
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      (error as { status?: number }).status === 401
        ? 400
        : 502;
    const message =
      status === 400
        ? "OpenAI rejected the key. Check that it is correct and active."
        : "Could not reach OpenAI. Check the key and your network, then try again.";
    return NextResponse.json({ success: false, message }, { status });
  }
}
