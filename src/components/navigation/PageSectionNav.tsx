"use client";

import { UI } from "@/lib/ui/strings";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

/**
 * In-page anchor links to section ids (e.g. PersistedDetails with matching `id` on `<details>`).
 */
export function PageSectionNav(props: {
  sections: { id: string; label: string }[];
  className?: string;
}) {
  const isDev = process.env.NODE_ENV === "development";
  const navRef = useRef<HTMLElement | null>(null);

  // #region agent log (on-this-page overlap)
  useEffect(() => {
    void isDev;
    if (!isDev) return;
    const nav = navRef.current;
    if (!nav) return;

    const sample = (hypothesisId: string, message: string) => {
      try {
        const r = nav.getBoundingClientRect();
        const yProbe = Math.min(window.innerHeight - 2, Math.max(2, r.bottom + 2));
        const xProbe = Math.min(window.innerWidth - 2, Math.max(2, r.left + Math.min(24, r.width - 4)));
        const under = document.elementFromPoint(xProbe, yProbe) as HTMLElement | null;
        const style = window.getComputedStyle(nav);
        fetch("/api/debug-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "291aab",
            runId: "pre-fix-onthispage",
            hypothesisId,
            location: "PageSectionNav.tsx:useEffect",
            message,
            data: {
              rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height, w: r.width },
              position: style.position,
              top: style.top,
              zIndex: style.zIndex,
              backgroundColor: style.backgroundColor,
              backdropFilter: style.backdropFilter,
              underTag: under?.tagName ?? null,
              underId: under?.id ?? null,
              underClass: under?.className ? String(under.className).slice(0, 120) : null,
              viewport: { w: window.innerWidth, h: window.innerHeight },
              scrollY: window.scrollY,
              headerVar: getComputedStyle(document.documentElement).getPropertyValue("--app-header-h").trim() || null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      } catch {
        // ignore
      }
    };

    sample("P1", "PageSectionNav initial layout");
    requestAnimationFrame(() => sample("P1b", "PageSectionNav after rAF"));
    const onScroll = () => sample("P2", "PageSectionNav after scroll");
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDev]);
  // #endregion agent log (on-this-page overlap)

  if (props.sections.length === 0) return null;

  return (
    <nav
      ref={navRef}
      aria-label={UI.pageOnThisPage}
      className={cn(
        "not-print rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm md:sticky md:top-[calc(var(--app-header-h,104px)+16px)] md:z-20",
        props.className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {UI.pageOnThisPage}
        </span>
        <ul className="flex min-w-0 flex-wrap gap-2">
          {props.sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[color:var(--brand)]/35 hover:bg-[color:var(--brand)]/5 hover:text-[color:var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
