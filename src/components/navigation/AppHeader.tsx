"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CommandPaletteButton, CommandPaletteHost } from "@/components/command/CommandPalette";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { STORAGE } from "@/lib/storage/keys";

type NavItem = { href: string; label: string; short?: string };

const modules: NavItem[] = [
  { href: "/tension", label: "Tension" },
  { href: "/compression", label: "Compression" },
  { href: "/bending-shear", label: "Beam", short: "Beam" },
];

const utility: NavItem[] = [
  { href: "/report", label: "Report", short: "Report" },
  { href: "/info", label: "Info", short: "Info" },
];

type LastSaved = { label: string; ts: number } | null;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readLastSaved(): LastSaved {
  try {
    const pairs: Array<{ key: string; label: string }> = [
      { key: "tension", label: "Tension" },
      { key: "compression", label: "Compression" },
      { key: "bending", label: "Beam" },
    ];
    let best: LastSaved = null;
    for (const p of pairs) {
      const raw = localStorage.getItem(`ssc:ts:${p.key}`);
      const ts = raw ? Number(raw) : NaN;
      if (!Number.isFinite(ts)) continue;
      if (!best || ts > best.ts) best = { label: p.label, ts };
    }
    return best;
  } catch {
    return null;
  }
}

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff)) return null;
  if (diff < 15_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const [tick, setTick] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const toast = useToast();
  const isDev = process.env.NODE_ENV === "development";
  const [mounted, setMounted] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // #region agent log (header height -> sticky offsets)
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    if (!isDev) return;

    const apply = (hypothesisId: string, message: string) => {
      const r = el.getBoundingClientRect();
      const h = Math.max(0, Math.round(r.height));
      document.documentElement.style.setProperty("--app-header-h", `${h}px`);
      fetch("/api/debug-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "291aab",
          runId: "pre-fix",
          hypothesisId,
          location: "AppHeader.tsx:useLayoutEffect(headerHeight)",
          message,
          data: {
            pathname,
            headerPx: h,
            cssVar: getComputedStyle(document.documentElement).getPropertyValue("--app-header-h").trim() || null,
            scrollY: typeof window !== "undefined" ? window.scrollY : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    };

    apply("H1", "Initial header height measured");

    const ro = new ResizeObserver(() => apply("H2", "Header height changed (ResizeObserver)"));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pathname, isDev]);
  // #endregion agent log (header height -> sticky offsets)

  // #region agent log (hydration)
  useEffect(() => {
    if (!isDev) return;
    fetch("http://127.0.0.1:7428/ingest/ca13048c-9d98-4bcc-a485-2fd46d0652e4", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a6528a" },
      body: JSON.stringify({
        sessionId: "a6528a",
        runId: "pre-fix",
        hypothesisId: "H2",
        location: "AppHeader.tsx:useEffect(mount)",
        message: "AppHeader mounted",
        data: { pathname },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [isDev, pathname]);
  // #endregion agent log (hydration)

  const lastSaved = useMemo(() => {
    // tick + pathname intentionally trigger refresh of localStorage-derived UI
    void tick;
    void pathname;
    return mounted ? readLastSaved() : null;
  }, [mounted, tick, pathname]);
  const lastSavedLabel = lastSaved ? `${lastSaved.label} · ${formatRelative(lastSaved.ts) ?? "saved"}` : null;

  const projectStatus = useMemo(() => {
    void tick;
    void pathname;
    if (!mounted) return { items: [], completed: 0, total: 3 };
    try {
      const keys: Array<{ k: string; label: string; href: string }> = [
        { k: "tension", label: "Tension", href: "/tension" },
        { k: "compression", label: "Compression", href: "/compression" },
        { k: "bending", label: "Beam", href: "/bending-shear" },
      ];
      const items = keys.map((x) => {
        const raw = localStorage.getItem(`ssc:ts:${x.k}`);
        const ts = raw ? Number(raw) : NaN;
        return { ...x, ts: Number.isFinite(ts) ? ts : null };
      });
      const completed = items.filter((i) => i.ts != null).length;
      return { items, completed, total: items.length };
    } catch {
      return { items: [], completed: 0, total: 3 };
    }
  }, [tick, pathname, mounted]);

  // Remember last visited route for a fast "Continue" on Home.
  // UI-only preference, no calculation logic.
  useEffect(() => {
    try {
      localStorage.setItem("ssc:lastRoute", pathname);
    } catch {
      /* ignore */
    }
  }, [pathname]);

  // (dev-only debug logging removed for production safety)

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <CommandPaletteHost />
      <ConfirmDialog
        open={clearOpen}
        contextLabel="This device"
        title="Clear all saved inputs?"
        description={<p>This clears saved fields for all modules in this browser and cannot be undone.</p>}
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          try {
            Object.values(STORAGE).forEach((k) => localStorage.removeItem(k));
            const keys = ["tension", "compression", "bending"];
            for (const k of keys) localStorage.removeItem(`ssc:ts:${k}`);
            localStorage.removeItem("ssc:lastRoute");
          } catch {
            /* ignore */
          }
          toast.push({ title: "Cleared", message: "Saved inputs removed for this browser.", tone: "info" });
          setTick((t) => t + 1);
        }}
      />
      {/* Top row: branding + key status controls */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-2.5 md:px-8">
        <div className="min-w-0">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
            aria-label="Structural Steel Calculators — Home"
          >
            <Image
              src="/brand/bu_logo.png"
              alt="Bulacan University"
              width={160}
              height={160}
              sizes="(min-width: 1024px) 68px, (min-width: 768px) 60px, (min-width: 640px) 52px, 48px"
              quality={100}
              priority
              className="h-12 w-12 shrink-0 object-contain sm:h-[52px] sm:w-[52px] md:h-[60px] md:w-[60px] lg:h-[68px] lg:w-[68px]"
            />
            <span className="block min-w-0">
              <span className="block truncate text-base font-extrabold tracking-tight text-slate-950 group-hover:text-[color:var(--brand)] md:text-lg">
                Structural Steel Calculators
              </span>
            </span>
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <CommandPaletteButton />
          </div>

          {/* Desktop: project status quickview (also hosts last-saved to keep header height stable) */}
          <details className="relative hidden md:block">
            <summary className="list-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 [&::-webkit-details-marker]:hidden">
              Progress {projectStatus.completed}/{projectStatus.total}
            </summary>
            <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-950/5">
              <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project status (this device)
              </div>
              <div className="p-2">
                {mounted && lastSavedLabel ? (
                  <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                    <span className="font-semibold text-slate-900">Last saved:</span> {lastSavedLabel}
                  </div>
                ) : null}
                {projectStatus.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
                  >
                    <span className="min-w-0 truncate">{i.label}</span>
                    <span className="shrink-0 text-xs font-semibold text-slate-600">
                      {i.ts ? `Saved ${formatRelative(i.ts) ?? "recently"}` : "No data"}
                    </span>
                  </Link>
                ))}
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-left text-sm font-semibold text-red-800 shadow-sm hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20"
                    onClick={() => setClearOpen(true)}
                  >
                    Clear saved inputs…
                  </button>
                </div>
              </div>
            </div>
          </details>

          {/* Mobile: quick dropdown to reduce pill scrolling */}
          <details className="relative md:hidden">
            <summary className="list-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 [&::-webkit-details-marker]:hidden">
              Modules
            </summary>
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-950/5">
              <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Navigate
              </div>
              <div className="p-2">
                {[{ href: "/", label: "Home" }, ...modules, ...utility].map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
                  >
                    {i.label}
                  </Link>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Bottom row: modules (primary nav) + utilities (secondary) */}
      <nav className="border-t border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-6xl px-2 md:px-6">
          <div className="flex items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <NavPill href="/" label="Home" active={isActive(pathname, "/")} />
              <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
              {modules.map((item) => (
                <NavPill
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  short={item.short}
                  active={isActive(pathname, item.href)}
                />
              ))}
              <div className="mx-1 h-5 w-px bg-slate-200 md:hidden" aria-hidden="true" />
              <div className="flex items-center gap-1 md:hidden">
                {utility.map((item) => (
                  <NavPill
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    short={item.short}
                    active={isActive(pathname, item.href)}
                  />
                ))}
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              {utility.map((item) => (
                <NavPill
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  short={item.short}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

function NavPill(props: { href: string; label: string; short?: string; active: boolean }) {
  const label = props.short ?? props.label;
  return (
    <Link
      href={props.href}
      aria-current={props.active ? "page" : undefined}
      className={[
        "inline-flex min-h-10 shrink-0 items-center rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10",
        props.active
          ? "bg-[color:var(--brand)] text-white"
          : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
      ].join(" ")}
      title={props.label}
    >
      {label}
    </Link>
  );
}




