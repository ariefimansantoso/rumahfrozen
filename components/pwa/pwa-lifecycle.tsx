"use client";

import { useEffect } from "react";
import {
  PWA_CACHE_PREFIX,
  SERVICE_WORKER_PATH,
  shouldEnableServiceWorker,
} from "@/lib/pwa";

function canUseServiceWorker() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  const { protocol, hostname } = window.location;
  return (
    protocol === "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function isAppServiceWorkerRegistration(registration: ServiceWorkerRegistration) {
  const rootScope = new URL("/", window.location.href).href;
  const workers = [
    registration.active,
    registration.waiting,
    registration.installing,
  ];

  return (
    registration.scope === rootScope &&
    workers.some((worker) => worker?.scriptURL.endsWith(SERVICE_WORKER_PATH))
  );
}

async function unregisterAppServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations
      .filter(isAppServiceWorkerRegistration)
      .map((registration) => registration.unregister()),
  );
}

async function clearAppServiceWorkerCaches() {
  if (!("caches" in window)) return;

  const keys = await caches.keys();

  await Promise.all(
    keys
      .filter((key) => key.startsWith(PWA_CACHE_PREFIX))
      .map((key) => caches.delete(key)),
  );
}

export function PwaLifecycle() {
  useEffect(() => {
    if (!canUseServiceWorker()) return;

    if (!shouldEnableServiceWorker()) {
      void Promise.all([
        unregisterAppServiceWorkers(),
        clearAppServiceWorkerCaches(),
      ]).catch((error) => {
        console.warn("Service worker cleanup failed:", error);
      });
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
          scope: "/",
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Service worker registration failed:", error);
        }
      }
    };

    void register();
  }, []);

  return null;
}
