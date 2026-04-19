"use client";

import { useEffect } from "react";

const CORE_ROUTES = ["/", "/tension", "/compression", "/bending-shear", "/connections", "/report", "/info", "/workspace"];

/**
 * After next-pwa registers the service worker, warm core route documents so
 * the `others` cache (see register.js) is populated for cold offline opens.
 */
export function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const warmCoreRoutes = async () => {
      const warmOne = async (path: string) => {
        try {
          const ctrl = new AbortController();
          const timer = window.setTimeout(() => ctrl.abort(), 7000);
          await fetch(path, {
            method: "GET",
            credentials: "same-origin",
            signal: ctrl.signal,
          });
          window.clearTimeout(timer);
        } catch {
          /* ignore */
        }
      };

      for (const path of CORE_ROUTES) {
        if (cancelled) return;
        // eslint-disable-next-line no-await-in-loop
        await warmOne(path);
      }
    };

    const run = async () => {
      try {
        await navigator.serviceWorker.ready;
        if (!cancelled && navigator.onLine) {
          void warmCoreRoutes();
        }
      } catch {
        /* ignore */
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
