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
/** Extra app routes to precache (not already added by next-pwa: start URL `/`, fallback `/offline`). */
const OFFLINE_SHELL_ROUTES = [
  "/tension",
  "/compression",
  "/bending-shear",
  "/connections",
  "/report",
  "/info",
  "/workspace",
];

const APP_SHELL_REVISION = "app-shell-v6";

function normalizeManifestPath(url: string): string {
  try {
    const pathPart = url.includes("://") ? new URL(url).pathname : url;
    const noQuery = pathPart.split("?")[0] ?? "/";
    if (noQuery.length > 1 && noQuery.endsWith("/")) return noQuery.slice(0, -1);
    return noQuery || "/";
  } catch {
    return url.split("?")[0] || "/";
  }
}

function dedupePrecacheManifest(manifestEntries: Array<{ url: string; revision?: string | null }>) {
  const byPath = new Map<string, { url: string; revision?: string | null }>();

  const isAppShellRevision = (r: string) => /^app-shell-v\d+$/i.test(r);

  const pick = (
    a: { url: string; revision?: string | null },
    b: { url: string; revision?: string | null },
  ): { url: string; revision?: string | null } => {
    const ar = String(a.revision ?? "");
    const br = String(b.revision ?? "");
    const aShell = isAppShellRevision(ar);
    const bShell = isAppShellRevision(br);
    if (aShell && !bShell) return b;
    if (!aShell && bShell) return a;
    return br.length >= ar.length ? b : a;
  };

  for (const m of manifestEntries) {
    const key = normalizeManifestPath(m.url);
    const prev = byPath.get(key);
    if (!prev) {
      byPath.set(key, m);
      continue;
    }
    byPath.set(key, pick(prev, m));
  }

  return Array.from(byPath.values());
}

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
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^source$/, /^ref$/, /^standalone$/, /^from$/],
  manifestTransforms: [
    async (manifestEntries: Array<{ url: string; revision?: string | null }>) => {
      const seenPaths = new Set(manifestEntries.map((m) => normalizeManifestPath(m.url)));
      const extra: Array<{ url: string; revision: string }> = [];
      for (const route of OFFLINE_SHELL_ROUTES) {
        const url = route.startsWith("/") ? route : `/${route}`;
        if (!seenPaths.has(normalizeManifestPath(url))) {
          extra.push({ url, revision: APP_SHELL_REVISION });
          seenPaths.add(normalizeManifestPath(url));
        }
      }
      const combined = [...manifestEntries, ...extra];
      return { manifest: dedupePrecacheManifest(combined), warnings: [] };
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
