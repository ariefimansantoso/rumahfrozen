import { createSign } from "node:crypto";
import { z } from "zod";
import { withApi } from "@/lib/api/handler";
import { AuthorizationError, ValidationError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { canAccessVendorFeatures } from "@/lib/rbac";

const SignSchema = z.object({
  request: z.string().min(1).max(262_144),
});

function privateKey() {
  return (process.env.QZ_TRAY_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
}

export const POST = withApi(
  { auth: "user" },
  async ({ request, session }) => {
    if (!canAccessVendorFeatures(session.user)) {
      throw new AuthorizationError();
    }
    const key = privateKey();
    if (!key) {
      throw new ValidationError(
        "QZ Tray signing is not configured. Add QZ_TRAY_PRIVATE_KEY.",
      );
    }
    const body = await validateBody(request, SignSchema);
    const signer = createSign("RSA-SHA512");
    signer.update(body.request, "utf8");
    signer.end();
    return Response.json({ signature: signer.sign(key, "base64") });
  },
);
