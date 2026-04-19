import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

/** next-pwa default Workbox routes — includes same-origin `others` cache used by register.js on SPA nav. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pwaDefaultRuntimeCaching = require("next-pwa/cache") as Array<Record<string, unknown>>;

/** Core screens users should be able to open after install, even offline. */
const OFFLINE_SHELL_ROUTES = [
  "/",
  "/tension",
  "/compression",
  "/bending-shear",
  "/connections",
  "/report",
  "/info",
  "/workspace",
  "/offline",
];
const APP_SHELL_REVISION = "app-shell-v3";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheStartUrl: true,
  cacheOnFrontEndNav: true,
  dynamicStartUrl: false,
  reloadOnOnline: true,
  fallbacks: {
    document: "/offline",
  },
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^source$/, /^ref$/],
  additionalManifestEntries: OFFLINE_SHELL_ROUTES.map((url) => ({ url, revision: APP_SHELL_REVISION })),
  /**
   * next-pwa/register.js fills the `others` cache on client navigation (history.pushState).
   * Do NOT replace default runtime rules with a different cache name for HTML (e.g. `app-pages`).
   */
  runtimeCaching: [
    {
      urlPattern: ({ url }: { url: URL }) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"),
      handler: "CacheFirst",
      method: "GET",
      options: {
        cacheName: "next-static-assets",
        expiration: {
          maxEntries: 256,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) => {
        if (url.origin !== self.location.origin || request.method !== "GET") return false;
        const hasRscParam = url.searchParams.has("_rsc") || url.searchParams.has("__nextDataReq");
        const hasRscHeaders = request.headers.get("RSC") === "1" || request.headers.get("Next-Router-State-Tree") !== null;
        return hasRscParam || hasRscHeaders;
      },
      handler: "StaleWhileRevalidate",
      method: "GET",
      options: {
        cacheName: "next-app-router-data",
        expiration: {
          maxEntries: 256,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    ...pwaDefaultRuntimeCaching,
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/scope", destination: "/info", permanent: true }];
  },
};

export default withPWA(nextConfig);
