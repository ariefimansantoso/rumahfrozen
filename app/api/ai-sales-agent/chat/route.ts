import { NextResponse } from "next/server";
import { getSettings } from "@/models";
import { ValidationError } from "@/lib/api/errors";
import {
  rateLimitByIP,
  rateLimitBySession,
  rateLimitByUser,
} from "@/lib/api/rate-limit-middleware";
import { runAISalesAgent } from "@/lib/ai-sales-agent/engine";
import {
  isOpenAIConfigured,
  normalizeAISalesAgentSettings,
  toPublicAISalesAgentConfig,
} from "@/lib/ai-sales-agent/settings";
import { withApi } from "@/lib/api/handler";

export const POST = withApi(
  { auth: "optional" },
  async ({ request, session }) => {
    const cartSessionId = request.cookies.get("cart_session")?.value;
    const body = (await request.json()) as {
      conversationId?: string;
      message?: string;
      locale?: string;
    };

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) throw new ValidationError("Message is required");
    if (message.length > 1200) throw new ValidationError("Message is too long");

    if (session?.user?.id) {
      rateLimitByUser(
        request,
        session.user.id,
        "ai-sales-agent:chat",
        "moderate",
        session.user.role,
      );
    } else if (cartSessionId) {
      rateLimitBySession(
        request,
        cartSessionId,
        "ai-sales-agent:chat",
        "moderate",
      );
    } else {
      rateLimitByIP(request, "moderate");
    }

    const settings = await getSettings();
    const aiSettings = normalizeAISalesAgentSettings(settings.aiSalesAgent);
    if (!aiSettings.enabled) throw new ValidationError("AI Sales Agent is disabled");
    if (!isOpenAIConfigured(settings.aiAuthoring)) {
      throw new ValidationError("OpenAI API key is not configured");
    }

    const locale =
      typeof body.locale === "string" && body.locale.trim()
        ? body.locale.trim()
        : "en";
    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const result = await runAISalesAgent({
      conversationId: body.conversationId,
      userMessage: message,
      ctx: {
        locale,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        sessionId: cartSessionId,
        origin,
        settings: aiSettings,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        conversationId: result.conversationId,
        message: result.message,
        cartUpdated: result.cartUpdated,
        checkoutUrl: result.checkoutUrl,
        settings: toPublicAISalesAgentConfig(aiSettings, {
          aiAuthoring: settings.aiAuthoring,
        }),
      },
    });

    if (!session?.user?.id && result.cartSessionId) {
      response.headers.set(
        "Set-Cookie",
        `cart_session=${result.cartSessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
          60 * 60 * 24 * 30
        }`,
      );
    }

    return response;
  },
);
