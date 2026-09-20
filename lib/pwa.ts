export const PWA_CACHE_PREFIX = "marketify-pwa-";
export const SERVICE_WORKER_PATH = "/sw.js";

export function shouldEnableServiceWorker() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_PWA_IN_DEV === "true"
  );
}
