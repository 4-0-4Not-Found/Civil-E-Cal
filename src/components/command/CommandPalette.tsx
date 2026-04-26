"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { modalHeaderClass, modalOverlayClass, modalPanelClass, modalSubtitleClass, modalTitleClass, useModalA11y } from "@/components/ui/modal";

export type CommandAction = {
  id: string;
  label: string;
  keywords?: string;
  group?: string;
  shortcut?: string;
  run: () => void | Promise<void>;
};

const STORAGE_FAVORITES = "ssc:favorites";

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_FAVORITES);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeFavorites(favs: string[]) {
  try {
    localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(favs));
  } catch {
    /* ignore */
  }
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [favoritesTick, setFavoritesTick] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useModalA11y({
    open,
    onClose: () => setOpen(false),
    initialFocusRef: inputRef,
    containerRef: panelRef,
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      const isCmdK = (e.ctrlKey || e.metaKey) && k === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("ssc:command-palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("ssc:command-palette:open", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const favs = useMemo(() => {
    // readFavorites reads localStorage; keep it tied to a tick so we can refresh after toggles
    void favoritesTick;
    return readFavorites();
  }, [favoritesTick]);

  const baseActions: CommandAction[] = useMemo(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };

    const modules: { href: string; label: string }[] = [
      { href: "/", label: "Home" },
      { href: "/tension", label: "Tension" },
      { href: "/compression", label: "Compression" },
      { href: "/bending-shear", label: "Beam" },
      { href: "/report", label: "Report" },
      { href: "/info", label: "Info" },
    ];

    const nav = modules.map((m) => {
      const isFav = favs.includes(m.href);
      return {
        id: `nav:${m.href}`,
        label: `${m.label}${isFav ? " ★" : ""}`,
        keywords: `${m.label} ${m.href} ${isFav ? "favorite" : ""}`,
        group: isFav ? "Favorites" : "Navigate",
        shortcut: undefined,
        run: go(m.href),
      } satisfies CommandAction;
    });

    const toggleFav: CommandAction[] = modules
      .filter((m) => m.href !== pathname)
      .map((m) => {
        const isFav = favs.includes(m.href);
        return {
          id: `fav:${m.href}`,
          label: isFav ? `Unfavorite: ${m.label}` : `Favorite: ${m.label}`,
          keywords: `favorite pin ${m.label}`,
          group: "Favorites",
          run: () => {
            const next = isFav ? favs.filter((x) => x !== m.href) : [...favs, m.href];
            writeFavorites(next);
            setFavoritesTick((t) => t + 1);
          },
        } satisfies CommandAction;
      });

    const utils: CommandAction[] = [
      {
        id: "util:copy-link",
        label: "Copy page link",
        keywords: "copy link url share",
        group: "Utilities",
        shortcut: undefined,
        run: async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setOpen(false);
          } catch {
            /* ignore */
          }
        },
      },
      {
        id: "util:print",
        label: "Print / Save PDF",
        keywords: "print pdf report",
        group: "Utilities",
        shortcut: undefined,
        run: () => {
          try {
            window.print();
            setOpen(false);
          } catch {
            /* ignore */
          }
        },
      },
    ];

    return [...nav, ...toggleFav, ...utils];
  }, [router, pathname, favs]);

  const actions = useMemo(() => {
    const query = q.trim().toLowerCase();
    const ranked = baseActions
      .map((a) => {
        const hay = `${a.label} ${a.keywords ?? ""} ${a.group ?? ""}`.toLowerCase();
        const score = query.length === 0 ? 0 : hay.includes(query) ? 1 : -1;
        return { a, score };
      })
      .filter((x) => x.score >= 0)
      .map((x) => x.a);

    // Prefer favorites first when query is empty
    if (query.length === 0) {
      const fav = ranked.filter((a) => a.group === "Favorites");
      const rest = ranked.filter((a) => a.group !== "Favorites");
      return [...fav, ...rest];
    }
    return ranked;
  }, [baseActions, q]);

  const grouped = useMemo(() => {
    const out: Record<string, CommandAction[]> = {};
    for (const a of actions) {
      const g = a.group ?? "Commands";
      (out[g] ??= []).push(a);
    }
    return out;
  }, [actions]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className={modalOverlayClass}
        onMouseDown={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        ref={panelRef}
        className={cn(
          modalPanelClass,
          "absolute left-1/2 top-[10vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={cn(modalHeaderClass, "border-b border-slate-200")}>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</p>
            <p className={cn(modalTitleClass, "mt-1")}>Command palette</p>
            <p className={modalSubtitleClass}>Type to jump between modules or run utilities (favorite, print, copy link).</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                Ctrl/⌘ K
              </span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search modules, actions…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-[color:var(--brand)]/40 focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
            />
          </div>
          </div>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-auto p-2">
          {Object.keys(grouped).length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No matches.</div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="pb-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</div>
                <div className="grid gap-1">
                  {items.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => a.run()}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10",
                        a.id === `nav:${pathname}` ? "bg-[color:var(--brand)]/5 text-[color:var(--brand)]" : undefined,
                      )}
                    >
                      <span className="min-w-0 truncate">{a.label}</span>
                      {a.shortcut ? (
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {a.shortcut}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">Shortcuts</span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold">Ctrl/⌘ K</span>
              <span className="text-slate-500">open/close</span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold">Esc</span>
              <span className="text-slate-500">close</span>
            </div>
            <span className="text-slate-500">Tip: search “favorite” to pin modules on Home.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Dispatch a custom event so the single palette instance can open.
        window.dispatchEvent(new Event("ssc:command-palette:open"));
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
      aria-label="Open command palette"
    >
      Search
      <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 md:inline">
        Ctrl/⌘ K
      </span>
    </button>
  );
}

export function CommandPaletteHost() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  if (!mounted) return null;
  return <CommandPalette />;
}

