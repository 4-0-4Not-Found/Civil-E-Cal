"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { modalHeaderClass, modalOverlayClass, modalSubtitleClass, modalTitleClass, useModalA11y } from "@/components/ui/modal";

export type CompareSnapshot = {
  ts: number;
  title: string;
  lines: string[];
};

type CompareMetrics = {
  capacity?: { value: string; unit?: string };
  demand?: { value: string; unit?: string };
  utilizationPct?: number;
  governing?: string;
  method?: string;
  material?: string;
  mode?: string;
};

function readPinned(storageKey: string): CompareSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompareSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.ts !== "number") return null;
    if (typeof parsed.title !== "string") return null;
    if (!Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePinned(storageKey: string, snap: CompareSnapshot) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

function formatWhen(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function parseMetrics(lines: string[]): CompareMetrics {
  const m: CompareMetrics = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Utilization: 20.9%
    {
      const match = line.match(/utilization:\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
      if (match) {
        const v = Number(match[1]);
        if (Number.isFinite(v)) m.utilizationPct = v;
      }
    }

    // Capacity: 123.45 kips
    {
      const match = line.match(/capacity:\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/²³\-\s]+)?/i);
      if (match && !m.capacity) m.capacity = { value: match[1], unit: match[2]?.trim() || undefined };
    }

    // Demand: 67.89 kips
    {
      const match = line.match(/demand:\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/²³\-\s]+)?/i);
      if (match && !m.demand) m.demand = { value: match[1], unit: match[2]?.trim() || undefined };
    }

    // Governing: xyz
    {
      const match = line.match(/governing:\s*(.+)$/i);
      if (match && !m.governing) m.governing = match[1].trim();
    }

    // Method: LRFD · Material: A992 · Mode: check
    if (!m.method) {
      const match = line.match(/method:\s*([^·]+)(?:·|$)/i);
      if (match) m.method = match[1].trim();
    }
    if (!m.material) {
      const match = line.match(/material:\s*([^·]+)(?:·|$)/i);
      if (match) m.material = match[1].trim();
    }
    if (!m.mode) {
      const match = line.match(/mode:\s*([^·]+)(?:·|$)/i);
      if (match) m.mode = match[1].trim();
    }
  }
  return m;
}

export function CompareDrawer(props: {
  open: boolean;
  onClose: () => void;
  storageKey: string;
  getCurrent: () => Omit<CompareSnapshot, "ts">;
}) {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const { open, onClose, storageKey, getCurrent } = props;

  useEffect(() => {
    setMounted(true);
  }, []);

  useModalA11y({
    open,
    onClose,
    initialFocusRef: closeRef,
    containerRef: panelRef,
  });

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setTick((t) => t + 1));
  }, [open]);

  const pinned = useMemo(() => {
    void tick;
    return readPinned(storageKey);
  }, [storageKey, tick]);
  const snapshot = useMemo(
    () => (open ? getCurrent() : { title: "", lines: [] }),
    [open, getCurrent],
  );
  const [currentTs, setCurrentTs] = useState(0);
  useEffect(() => {
    if (!open) {
      queueMicrotask(() => setCurrentTs(0));
      return;
    }
    queueMicrotask(() => setCurrentTs(Date.now()));
  }, [open]);

  const current = snapshot.lines;
  const pinnedLines = useMemo(() => pinned?.lines ?? [], [pinned]);
  const currentMetrics = useMemo(() => parseMetrics(current), [current]);
  const pinnedMetrics = useMemo(() => parseMetrics(pinnedLines), [pinnedLines]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div
        className={modalOverlayClass}
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare runs"
        ref={panelRef}
        className="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl lg:max-w-4xl 2xl:max-w-5xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={cn(modalHeaderClass, "shrink-0 border-b border-slate-200 bg-white")}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compare</p>
            <p className={cn(modalTitleClass, "mt-1 truncate")}>{snapshot.title}</p>
            <p className={modalSubtitleClass}>
              Pin a baseline, then compare your current run against it (stored in this browser only).
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => {
                writePinned(storageKey, {
                  ts: Date.now(),
                  title: snapshot.title,
                  lines: snapshot.lines,
                });
                setTick((t) => t + 1);
              }}
            >
              Pin current
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={!pinned}
              onClick={() => {
                try {
                  localStorage.removeItem(storageKey);
                } catch {
                  /* ignore */
                }
                setTick((t) => t + 1);
              }}
              title={pinned ? "Clear pinned run" : "No pinned run yet"}
            >
              Clear pinned
            </Button>
            <Button ref={closeRef} variant="ghost" size="sm" type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CompareCard
                tone="current"
                title="Current"
                subtitle={currentTs > 0 ? formatWhen(currentTs) : "—"}
                lines={current}
                metrics={currentMetrics}
                emptyLabel="—"
              />
              <CompareCard
                tone="pinned"
                title="Pinned"
                subtitle={pinned ? formatWhen(pinned.ts) : "No pinned run yet"}
                lines={pinnedLines}
                metrics={pinnedMetrics}
                emptyLabel="Pin a run to compare against."
              />
            </div>

            {pinned ? <DiffSummary current={current} pinned={pinnedLines} /> : null}
          </div>
        </div>
      </div>
    </div>
  , document.body);
}

function StatusBadge(props: { utilizationPct?: number }) {
  const u = props.utilizationPct;
  if (u == null || !Number.isFinite(u)) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
        Utilization —
      </span>
    );
  }
  const safe = u <= 100;
  const high = u >= 95;
  const cls = safe
    ? high
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", cls)}>
      {safe ? "OK" : "Not OK"} · {u.toFixed(1)}%
    </span>
  );
}

function MetricRow(props: { label: string; value?: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-semibold text-slate-600">{props.label}</span>
      <span className="text-xs font-semibold text-slate-900">
        {props.value ?? "—"}
        {props.hint ? <span className="ml-2 font-medium text-slate-500">{props.hint}</span> : null}
      </span>
    </div>
  );
}

function CompareCard(props: {
  tone: "current" | "pinned";
  title: string;
  subtitle: string;
  lines: string[];
  metrics: CompareMetrics;
  emptyLabel: string;
}) {
  const toneCls =
    props.tone === "current"
      ? "border-slate-200"
      : "border-slate-200 bg-slate-50/40";
  return (
    <Card className={cn("border-slate-200", toneCls)}>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-tight text-slate-950">{props.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{props.subtitle}</p>
          </div>
          <StatusBadge utilizationPct={props.metrics.utilizationPct} />
        </div>

        <div className="mt-3 grid gap-1 rounded-xl border border-slate-200 bg-white p-3">
          <MetricRow
            label="Capacity"
            value={props.metrics.capacity?.value}
            hint={props.metrics.capacity?.unit}
          />
          <MetricRow
            label="Demand"
            value={props.metrics.demand?.value}
            hint={props.metrics.demand?.unit}
          />
          <MetricRow label="Governing" value={props.metrics.governing} />
          <MetricRow
            label="Method"
            value={
              [props.metrics.method, props.metrics.material ? `Material ${props.metrics.material}` : null, props.metrics.mode ? `Mode ${props.metrics.mode}` : null]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          />
        </div>

        {props.lines.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-slate-600">{props.emptyLabel}</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-slate-800">
            {props.lines.map((l, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                <span className="min-w-0 break-words">{l}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DiffSummary(props: { current: string[]; pinned: string[] }) {
  const curSet = new Set(props.current);
  const pinSet = new Set(props.pinned);
  const changedOrAdded = props.current.filter((l) => !pinSet.has(l));
  const removed = props.pinned.filter((l) => !curSet.has(l));

  if (changedOrAdded.length === 0 && removed.length === 0) {
    return (
      <Card className="border-slate-200 bg-emerald-50/30">
        <CardBody>
          <p className="text-sm font-semibold text-slate-900">No differences detected.</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Based on the summary lines (UI-only heuristic).</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardBody>
        <p className="text-sm font-extrabold tracking-tight text-slate-950">What changed</p>
        <p className="mt-1 text-xs font-medium text-slate-600">
          {changedOrAdded.length} changed/added, {removed.length} removed (based on summary lines).
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {changedOrAdded.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Changed / added</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {changedOrAdded.slice(0, 12).map((l, idx) => (
                  <li key={idx} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    {l}
                  </li>
                ))}
              </ul>
              {changedOrAdded.length > 12 ? (
                <p className="mt-2 text-xs font-medium text-slate-600">Showing 12 of {changedOrAdded.length}.</p>
              ) : null}
            </div>
          ) : null}
          {removed.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Removed</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {removed.slice(0, 12).map((l, idx) => (
                  <li key={idx} className={cn("rounded-lg border border-rose-200 bg-rose-50 px-3 py-2")}>
                    {l}
                  </li>
                ))}
              </ul>
              {removed.length > 12 ? (
                <p className="mt-2 text-xs font-medium text-slate-600">Showing 12 of {removed.length}.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

