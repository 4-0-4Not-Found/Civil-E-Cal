import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

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

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheStartUrl: true,
  dynamicStartUrl: false,
  reloadOnOnline: true,
  fallbacks: {
    document: "/offline",
  },
  additionalManifestEntries: OFFLINE_SHELL_ROUTES.map((url) => ({ url, revision: "app-shell-v1" })),
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
      urlPattern: ({ url }: { url: URL }) => url.origin === self.location.origin && url.pathname.startsWith("/api/"),
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "same-origin-apis",
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 * 24,
        },
      },
    },
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) =>
        request.mode === "navigate" && url.origin === self.location.origin && !url.pathname.startsWith("/api/"),
      handler: "StaleWhileRevalidate",
      method: "GET",
      options: {
        cacheName: "app-pages",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) =>
        request.destination === "script" ||
        request.destination === "style" ||
        request.destination === "worker" ||
        (request.destination === "font" && url.origin === self.location.origin),
      handler: "StaleWhileRevalidate",
      method: "GET",
      options: {
        cacheName: "runtime-static-assets",
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 60 * 60 * 24 * 14,
        },
      },
    },
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) =>
        request.destination === "image" && url.origin === self.location.origin,
      handler: "StaleWhileRevalidate",
      method: "GET",
      options: {
        cacheName: "runtime-images",
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/scope", destination: "/info", permanent: true }];
  },
};

export default withPWA(nextConfig);
