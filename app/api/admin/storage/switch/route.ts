import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models/settings.model";
import {
  clearStorageConfigCache,
  getStorageConfig,
  testStorageConnection,
} from "@/lib/storage";
import { successResponse } from "@/lib/api/response";
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  handleApiError,
} from "@/lib/api/errors";
import { USER_ROLES } from "@/config/app.config";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";

let switchInProgress = false;

const ALLOWED_PROVIDERS = ["cloudflare_r2", "s3", "local"] as const;
type AllowedProvider = (typeof ALLOWED_PROVIDERS)[number];

function isAllowedProvider(value: unknown): value is AllowedProvider {
  return (
    typeof value === "string" &&
    (ALLOWED_PROVIDERS as readonly string[]).includes(value)
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();
    if (session.user.role !== USER_ROLES.ADMIN) throw new AuthorizationError();
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    if (switchInProgress) {
      throw new ValidationError("A storage switch is already in progress");
    }

    const body = (await request.json()) as unknown;
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      !("provider" in body)
    ) {
      throw new ValidationError("Invalid request body");
    }

    const provider = (body as { provider?: unknown }).provider;
    if (!isAllowedProvider(provider)) {
      throw new ValidationError("Invalid provider");
    }

    switchInProgress = true;
    try {
      await connectDB();

      const currentConfig = await getStorageConfig();
      const connectionResult = await testStorageConnection({
        ...currentConfig,
        provider,
      });
      if (!connectionResult.success) {
        throw new ValidationError(connectionResult.message);
      }

      const settings = await getSettings();
      const settingsDoc = settings as unknown as {
        storage?: Record<string, unknown>;
      };
      const currentStorage = settingsDoc.storage ?? {};
      settingsDoc.storage = { ...currentStorage, provider };
      settings.updatedBy = session.user.id;
      await settings.save();
      clearStorageConfigCache();

      return successResponse(
        {
          provider,
        },
        "Storage provider switched successfully",
      );
    } finally {
      switchInProgress = false;
    }
  } catch (error) {
    switchInProgress = false;
    return handleApiError(error);
  }
}
