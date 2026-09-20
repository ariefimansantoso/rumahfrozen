import { ValidationError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";
import { successResponse } from "@/lib/api/response";
import { createHeroBanner } from "@/lib/ai-authoring/hero-banner/service";
import type { HeroBannerRuntime } from "@/lib/ai-authoring/hero-banner/brief";
import {
  isHeroBannerEnabled,
  normalizeHeroBannerRequest,
} from "@/lib/ai-authoring/hero-banner/validation";
import { assertAIAuthoringAllowed } from "@/lib/ai-authoring/runtime";

export async function createHeroBannerFromPayload(
  payload: unknown,
  env: Partial<NodeJS.ProcessEnv> = process.env,
  runtime: HeroBannerRuntime = {},
) {
  if (!isHeroBannerEnabled(env)) {
    throw new ValidationError("AI hero banner generation is disabled");
  }
  return createHeroBanner(
    normalizeHeroBannerRequest(payload),
    undefined,
    runtime,
  );
}

export const HERO_BANNER_ROUTE_OPTIONS = {
  auth: "admin",
  rateLimit: {
    action: "admin:ai-authoring:hero-banner",
    preset: "strict",
  },
} as const;

export const POST = withApi(
  HERO_BANNER_ROUTE_OPTIONS,
  async ({ request, session }) => {
  const startedAt = Date.now();
  let operation = "unknown";
  try {
    const payload = await request.json();
    if (payload && typeof payload === "object" && "operation" in payload) {
      operation = String(payload.operation).slice(0, 20);
    }
    const authoring = await assertAIAuthoringAllowed({
      surface: "heroBanner",
      caller: "admin",
      userId: session.user.id,
      kind: "image",
    });
    const result = await createHeroBannerFromPayload(payload, process.env, {
      apiKey: authoring.apiKey,
      textModel: authoring.textModel,
      imageModel: authoring.imageModel,
    });
    console.info("[AI Hero Banner]", {
      operation,
      status: "success",
      durationMs: Date.now() - startedAt,
      mediaId: result.media._id,
    });
    return successResponse(result);
  } catch (error) {
    console.error("[AI Hero Banner]", {
      operation,
      status: "error",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
  },
);
