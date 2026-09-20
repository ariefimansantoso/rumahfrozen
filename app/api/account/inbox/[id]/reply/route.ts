import { NextRequest } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { appendCustomerSupportReply } from "@/lib/support-messages";
import { successResponse } from "@/lib/api/response";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  handleApiError,
} from "@/lib/api/errors";
import { USER_ROLES } from "@/config/app.config";

const ReplySchema = z.object({
  message: z.string().trim().min(2).max(4000),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AuthenticationError();
    if (session.user.role !== USER_ROLES.CUSTOMER) {
      throw new AuthorizationError("Only customers can reply to support messages");
    }

    const body = await request.json();
    const parsed = ReplySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Reply message is required");
    }

    const { id } = await context.params;
    const conversation = await appendCustomerSupportReply({
      conversationId: id,
      customer: {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image || undefined,
      },
      message: parsed.data.message,
    });

    if (!conversation) throw new NotFoundError("Inbox message");

    return successResponse({ conversation }, "Reply sent");
  } catch (error) {
    return handleApiError(error);
  }
}
