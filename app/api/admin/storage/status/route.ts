import { getStorageConfig, testStorageConnection } from "@/lib/storage";
import { successResponse } from "@/lib/api/response";
import { withApi } from "@/lib/api/handler";

function isConfigured(config: Awaited<ReturnType<typeof getStorageConfig>>) {
  if (config.provider === "local") {
    // Local storage needs no credentials — writability is verified by the
    // connection test.
    return true;
  }
  if (config.provider === "cloudflare_r2") {
    return Boolean(
      config.accountId &&
        config.bucketName &&
        config.accessKeyId &&
        config.secretAccessKey,
    );
  }
  // AWS S3
  return Boolean(config.bucketName && config.accessKeyId && config.secretAccessKey);
}

export const GET = withApi(
  { auth: "admin" },
  async () => {
    const config = await getStorageConfig();

    const connection = await testStorageConnection(config);

    return successResponse({
      provider: config.provider,
      configured: isConfigured(config),
      connection,
      details: {
        bucketName: config.bucketName,
        region: config.region,
        publicUrl: config.publicUrl,
        pathPrefix: config.pathPrefix,
        maxFileSizeMB: config.maxFileSizeMB,
        allowedMimeTypesCount: config.allowedMimeTypes.length,
      },
    });
  },
);

