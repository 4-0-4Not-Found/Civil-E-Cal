"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ProjectBackupPanel } from "@/components/ProjectBackupPanel";
import { STORAGE } from "@/lib/storage/keys";

type ModuleKey = keyof typeof STORAGE;

const STORAGE_FAVORITES = "ssc:favorites";
const STORAGE_HOME_ORDER = "ssc:home:moduleOrder";

const modules: Array<{
  key: ModuleKey;
  label: string;
  href: string;
  summary: string;
  bullets: string[];
}> = [
  {
    key: "tension",
    label: "Tension",
    href: "/tension",
    summary: "Yielding, rupture, block shear; optional stagger helper.",
    bullets: ["Quick SAFE / NOT SAFE", "Exports + step table"],
  },
  {
    key: "compression",
    label: "Compression",
    href: "/compression",
    summary: "Member buckling (E3), LRFD/ASD; KL/r focus.",
    bullets: ["K + length inputs", "Section snapshot"],
  },
  {
    key: "bending",
    label: "Beam",
    href: "/bending-shear",
    summary: "Flexure, shear, deflection; W + HSS check modes.",
    bullets: ["Load-to-M/V helper", "Utilization by limit state"],
  },
  {
    key: "connections",
    label: "Connections",
    href: "/connections",
    summary: "Bolts, slip-critical, tension, interaction, welds.",
    bullets: ["Overall summary", "Design hints (n, weld size)"],
  },
];

function tsKey(m: ModuleKey) {
  return `ssc:ts:${m}`;
}

function formatSaved(ts: number | null) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function readJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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

function readHomeOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_HOME_ORDER);
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(arr)) return null;
    const out = arr.filter((x) => typeof x === "string") as string[];
    return out.length ? out : null;
  } catch {
    return null;
  }
}

function writeHomeOrder(order: string[]) {
  try {
    localStorage.setItem(STORAGE_HOME_ORDER, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function emptyModuleState(): Record<ModuleKey, { hasData: boolean; savedTs: number | null }> {
  return {
    tension: { hasData: false, savedTs: null },
    compression: { hasData: false, savedTs: null },
    bending: { hasData: false, savedTs: null },
    connections: { hasData: false, savedTs: null },
  };
}

function previewLineFor(key: ModuleKey): string | null {
  try {
    const raw = localStorage.getItem(STORAGE[key]);
    const p = readJson<Record<string, unknown>>(raw);
    if (!p) return null;
    if (key === "tension") {
      const shape = typeof p.shapeName === "string" ? p.shapeName : null;
      const Pu = typeof p.Pu === "string" ? p.Pu : null;
      return shape && Pu ? `${shape} · Pu ${Pu} kips` : shape ? String(shape) : null;
    }
    if (key === "compression") {
      const shape = typeof p.shapeName === "string" ? p.shapeName : null;
      const Pu = typeof p.Pu === "string" ? p.Pu : null;
      const L = typeof p.L === "string" ? p.L : null;
      return shape && Pu && L ? `${shape} · Pu ${Pu} kips · L ${L} in` : shape ? String(shape) : null;
    }
    if (key === "bending") {
      const shape = typeof p.shapeName === "string" ? p.shapeName : null;
      const Mu = typeof p.Mu === "string" ? p.Mu : null;
      const Vu = typeof p.Vu === "string" ? p.Vu : null;
      return shape && Mu && Vu ? `${shape} · Mu ${Mu} · Vu ${Vu}` : shape ? String(shape) : null;
    }
    if (key === "connections") {
      const vu = typeof p.vu === "string" ? p.vu : null;
      const tu = typeof p.tu === "string" ? p.tu : null;
      const n = typeof p.nBolts === "string" ? p.nBolts : null;
      const d = typeof p.dBolt === "string" ? p.dBolt : null;
      return vu && n && d ? `Vu ${vu} · Tu ${tu ?? "0"} · n=${n} d=${d} in` : vu ? `Vu ${vu}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function HomeDashboard() {
  const [tick, setTick] = useState(0);
  /** false until after mount — SSR and first client paint must not read localStorage (differs from server HTML). */
  const [mounted, setMounted] = useState(false);
  /** null until mounted — avoids SSR vs client mismatch on navigator.onLine */
  const [networkOnline, setNetworkOnline] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onFocus = () => setTick((v) => v + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const sync = () => setNetworkOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const resumeHref = useMemo(() => {
    if (!mounted) return null;
    try {
      const last = localStorage.getItem("ssc:lastRoute");
      if (!last || last === "/") return null;
      return last;
    } catch {
      return null;
    }
  }, [tick, mounted]);

  const moduleState = useMemo(() => {
    if (!mounted) return emptyModuleState();
    const out: Record<string, { hasData: boolean; savedTs: number | null }> = {};
    for (const m of modules) {
      const k = STORAGE[m.key];
      const hasData = Boolean(localStorage.getItem(k));
      const rawTs = localStorage.getItem(tsKey(m.key));
      const ts = rawTs ? Number(rawTs) : null;
      out[m.key] = { hasData, savedTs: Number.isFinite(ts ?? NaN) ? ts : null };
    }
    return out;
  }, [tick, mounted]);

  const favorites = useMemo(() => {
    if (!mounted) return [];
    return readFavorites();
  }, [tick, mounted]);

  const orderedModules = useMemo(() => {
    if (!mounted) return modules;
    const order = readHomeOrder();
    if (!order) return modules;
    const byHref = new Map(modules.map((m) => [m.href, m] as const));
    const kept: typeof modules = [];
    for (const href of order) {
      const m = byHref.get(href);
      if (m) kept.push(m);
    }
    // Append any new modules not in storage order.
    for (const m of modules) if (!kept.some((x) => x.href === m.href)) kept.push(m);
    return kept;
  }, [tick, mounted]);

  const modulesWithPreview = useMemo(() => {
    if (!mounted) {
      return modules.map((m) => ({ ...m, preview: null as string | null, isFav: false }));
    }
    return orderedModules.map((m) => ({
      ...m,
      preview: previewLineFor(m.key),
      isFav: favorites.includes(m.href),
    }));
  }, [orderedModules, favorites, mounted]);

  const recent = useMemo(() => {
    if (!mounted) return [];
    return modulesWithPreview
      .map((m) => ({ m, s: moduleState[m.key] }))
      .filter((x) => x.s?.hasData)
      .sort((a, b) => (b.s?.savedTs ?? 0) - (a.s?.savedTs ?? 0))
      .slice(0, 4);
  }, [moduleState, modulesWithPreview, mounted]);

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">AISC 16th Edition</Badge>
            <Badge>Offline-first PWA</Badge>
            {networkOnline === null ? (
              <Badge tone="neutral">…</Badge>
            ) : networkOnline ? (
              <Badge tone="good">Online</Badge>
            ) : (
              <Badge tone="bad">Offline</Badge>
            )}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">
                Structural Steel Calculators
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-700 md:text-base">
                Fast AISC-based checks for students. Inputs save locally in your browser. Export results and print a combined report.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {resumeHref ? (
                <Link href={resumeHref}>
                  <Button variant="primary">Continue</Button>
                </Link>
              ) : null}
              <a href="#modules">
                <Button variant="secondary">Start a calculation</Button>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/report">
              <Button variant="secondary" size="sm">
                Report (Print/PDF)
              </Button>
            </Link>
            <Link href="/info">
              <Button variant="secondary" size="sm">
                Info & units
              </Button>
            </Link>
            <InstallAppButton />
          </div>
        </CardBody>
      </Card>

      <div className="h-px bg-slate-200/70" role="separator" aria-hidden="true" />

      {recent.length > 0 ? (
        <Card className="border-slate-200">
          <CardBody className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-slate-950">Recent work</p>
              <Link href="/report" className="text-sm font-semibold text-[#0818A8] hover:underline">
                Open report
              </Link>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {recent.map(({ m, s }) => (
                <Link
                  key={m.key}
                  href={m.href}
                  className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:border-[#0818A8]/35 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-[#0818A8]/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-950">{m.label}</p>
                      <p className="mt-1 text-sm text-slate-700">{m.summary}</p>
                      {m.preview ? <p className="mt-2 text-xs font-semibold text-slate-600">{m.preview}</p> : null}
                      {s?.savedTs ? (
                        <p className="mt-2 text-xs font-semibold text-slate-600">Last saved: {formatSaved(s.savedTs) ?? "—"}</p>
                      ) : null}
                    </div>
                    <Badge tone="good">READY</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="h-px bg-slate-200/70" role="separator" aria-hidden="true" />

      <section id="modules" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-950">Modules</h2>
            <p className="text-sm text-slate-700">Pick a calculator. Your inputs are saved locally as you work.</p>
          </div>
          <p className="text-xs font-semibold text-slate-600">
            Suggested order: Tension → Compression → Beam → Connections
          </p>
        </div>

        <details className="rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
            Personalize Home
            <span className="mt-1 block text-xs font-semibold text-slate-600">
              Favorites and module order are saved in this browser only.
            </span>
          </summary>
          <div className="border-t border-slate-200 p-5">
            <div className="grid gap-2">
              {modulesWithPreview.map((m, idx) => (
                <div
                  key={m.href}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {m.isFav ? "★ " : ""}
                      {m.label}
                    </p>
                    {m.preview ? <p className="truncate text-xs font-medium text-slate-600">{m.preview}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => {
                        const cur = readFavorites();
                        const next = cur.includes(m.href) ? cur.filter((x) => x !== m.href) : [...cur, m.href];
                        writeFavorites(next);
                        setTick((v) => v + 1);
                      }}
                    >
                      {m.isFav ? "Unfavorite" : "Favorite"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => {
                        const order = modulesWithPreview.map((x) => x.href);
                        if (idx <= 0) return;
                        const next = [...order];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        writeHomeOrder(next);
                        setTick((v) => v + 1);
                      }}
                      disabled={idx === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => {
                        const order = modulesWithPreview.map((x) => x.href);
                        if (idx >= order.length - 1) return;
                        const next = [...order];
                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                        writeHomeOrder(next);
                        setTick((v) => v + 1);
                      }}
                      disabled={idx === modulesWithPreview.length - 1}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem(STORAGE_HOME_ORDER);
                        } catch {
                          /* ignore */
                        }
                        setTick((v) => v + 1);
                      }}
                    >
                      Reset order
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        <div className="grid gap-4 md:grid-cols-2">
          {modulesWithPreview
            .slice()
            .sort((a, b) => Number(b.isFav) - Number(a.isFav))
            .map((m) => {
            const s = moduleState[m.key];
            const saved = s?.savedTs ? formatSaved(s.savedTs) : null;
            return (
              <Link
                key={m.key}
                href={m.href}
                className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm transition hover:border-[#0818A8]/40 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#0818A8]/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-extrabold tracking-tight text-slate-950">
                      {m.isFav ? <span className="text-[#0818A8]">★ </span> : null}
                      {m.label}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{m.summary}</p>
                    {m.preview ? <p className="mt-2 text-xs font-semibold text-slate-600">{m.preview}</p> : null}
                  </div>
                  {s?.hasData ? <Badge tone="good">READY</Badge> : <Badge tone="neutral">NEW</Badge>}
                </div>

                <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-600 md:text-sm md:text-slate-700">
                  {m.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                  <span>{s?.hasData ? (saved ? `Last saved: ${saved}` : "Saved inputs found") : "No saved inputs yet"}</span>
                  <span className="text-[#0818A8]">Open →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="h-px bg-slate-200/70" role="separator" aria-hidden="true" />

      <ProjectBackupPanel />
    </div>
  );
}

