import type { NextConfig } from "next";
import path from "path";
import withPWAInit from "next-pwa";

/** next-pwa default Workbox routes — includes same-origin `others` cache used by register.js on SPA nav. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pwaDefaultRuntimeCaching = require("next-pwa/cache") as Array<Record<string, unknown>>;

/**
 * App routes that must be available offline after one online visit.
 * NOTE: Do NOT pass these as `additionalManifestEntries: [...]` — that replaces next-pwa’s
 * default `public/**` glob and drops manifest.json, icons, and other static precache entries,
 * which breaks offline installs. Use `manifestTransforms` below to append instead.
 */
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

const APP_SHELL_REVISION = "app-shell-v5";

const pwaPlugin = withPWAInit({
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
  manifestTransforms: [
    async (manifestEntries: Array<{ url: string; revision?: string | null }>) => {
      const normalize = (u: string) => u.replace(/%5B/g, "[").replace(/%5D/g, "]").split("?")[0];
      const seen = new Set(manifestEntries.map((m) => normalize(m.url)));
      const extra: Array<{ url: string; revision: string }> = [];
      for (const route of OFFLINE_SHELL_ROUTES) {
        const url = route.startsWith("/") ? route : `/${route}`;
        if (!seen.has(url)) {
          extra.push({ url, revision: APP_SHELL_REVISION });
          seen.add(url);
        }
      }
      return { manifest: [...manifestEntries, ...extra], warnings: [] };
    },
  ],
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

/**
 * next-pwa only prepends `register.js` to the `main.js` webpack entry. Next.js App Router
 * merges `main.js` into `main` and deletes `main.js`, so the register script never ships —
 * no SW registration, empty Application → Service workers (exactly what you saw in DevTools).
 * Inject into `main` / `main-app` after next-pwa runs.
 */
function injectPwaRegisterForAppRouter(config: { entry?: unknown }, options: { isServer?: boolean }) {
  if (options.isServer) return;

  const registerJs = path.join(path.dirname(require.resolve("next-pwa/package.json")), "register.js");
  const prevEntry = config.entry;
  if (!prevEntry) return;

  config.entry = async () => {
    const raw = typeof prevEntry === "function" ? await (prevEntry as () => Promise<Record<string, unknown>>)() : prevEntry;
    if (!raw || typeof raw !== "object") return raw;

    const entries = raw as Record<string, unknown>;
    const hasRegister = (arr: unknown) =>
      Array.isArray(arr) &&
      (arr as string[]).some((p) => {
        const s = String(p).replace(/\\/g, "/");
        return s.includes("next-pwa") && s.includes("register");
      });

    for (const key of ["main", "main-app", "main.js"] as const) {
      const v = entries[key];
      if (Array.isArray(v) && v.length > 0 && !hasRegister(v)) {
        (v as string[]).unshift(registerJs);
        break;
      }
    }
    return entries;
  };
}

const baseConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/scope", destination: "/info", permanent: true }];
  },
};

const withPWA = pwaPlugin(baseConfig);
const origWebpack = withPWA.webpack;

withPWA.webpack = (config, options) => {
  const cfg = typeof origWebpack === "function" ? origWebpack(config, options) : config;
  injectPwaRegisterForAppRouter(cfg, options);
  return cfg;
};

export default withPWA;
