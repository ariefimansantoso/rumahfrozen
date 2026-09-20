import { connectDB } from "@/lib/db";
import { successResponse } from "@/lib/api/response";
import { ValidationError } from "@/lib/api/errors";
import { testStorageConnection, type StorageConfig } from "@/lib/storage";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";
import { withApi } from "@/lib/api/handler";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export const POST = withApi(
  { auth: "admin" },
  async ({ request }) => {
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    const body = (await request.json()) as unknown;
    if (!isPlainObject(body)) throw new ValidationError("Invalid request body");

    await connectDB();
    const result = await testStorageConnection(body as unknown as StorageConfig);

    if (!result.success) {
      throw new ValidationError(result.message);
    }

    return successResponse(result, "Storage credentials are valid");
  },
);
