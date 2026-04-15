"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopySummaryButton } from "@/components/actions/CopySummaryButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ExportJsonButton } from "@/components/ExportJsonButton";
import { cn } from "@/lib/utils";
import { CompareDrawer, type CompareSnapshot } from "@/components/compare/CompareDrawer";
import { modalOverlayClass, modalPanelClass, useModalA11y } from "@/components/ui/modal";

type CsvSpec = { filename: string; rows: string[][] };
type JsonSpec = { data: unknown };
type CompareSpec = { storageKey: string; getCurrent: () => Omit<CompareSnapshot, "ts"> };

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

export function CalculatorActionRail(props: {
  desktopClassName?: string;
  /** When true, only the mobile bottom bar + spacer render (use for the rail below the main card). */
  mobileOnly?: boolean;
  /** When true, do not render the fixed mobile bar (use on the in-page / sidebar rail so only one bottom bar exists). */
  hideMobileBar?: boolean;
  title?: string;
  subtitle?: string;
  /** LocalStorage key for last-saved timestamp (e.g. `ssc:ts:tension`). */
  savedKey?: string;
  /** UI-only transient state from parent. If set, overrides savedKey-derived label. */
  saving?: boolean;
  savedAt?: number | null;
  onGoResults?: () => void;
  copyText: () => string;
  csv?: CsvSpec;
  json?: JsonSpec;
  compare?: CompareSpec;
  onReset?: () => void;
  onGoSteps?: () => void;
}) {
  const [resetArmed, setResetArmed] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasExport = Boolean(props.csv || props.json);
  const [savedTick, setSavedTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // (dev-only debug logging removed for production safety)

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!props.savedKey) return;
    const t = window.setInterval(() => setSavedTick((v) => v + 1), 10_000);
    return () => window.clearInterval(t);
  }, [props.savedKey]);

  const savedLabel = useMemo(() => {
    // savedTick intentionally triggers refresh for relative timestamps
    void savedTick;
    // Avoid hydration mismatch: the server can't read localStorage and relative time depends on Date.now().
    // So we render no saved label until after first client mount.
    if (!hydrated) return null;
    if (props.saving) return "Saving…";
    if (props.savedAt && Number.isFinite(props.savedAt)) return `Saved ${formatRelative(props.savedAt) ?? "recently"}`;
    if (!props.savedKey) return null;
    try {
      const raw = localStorage.getItem(props.savedKey);
      const ts = raw ? Number(raw) : NaN;
      if (!Number.isFinite(ts)) return null;
      return `Saved ${formatRelative(ts) ?? "recently"}`;
    } catch {
      return null;
    }
  }, [hydrated, props.savedKey, props.saving, props.savedAt, savedTick]);

  // (dev-only debug logging removed for production safety)

  const sheetPanelRef = useRef<HTMLDivElement | null>(null);
  const sheetCloseRef = useRef<HTMLButtonElement | null>(null);
  useModalA11y({
    open: sheetOpen,
    onClose: () => setSheetOpen(false),
    initialFocusRef: sheetCloseRef,
    containerRef: sheetPanelRef,
  });

  const header = useMemo(() => {
    if (!props.title && !props.subtitle) return null;
    return (
      <div className="mb-3">
        {props.title ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.title}</p> : null}
        {props.subtitle ? <p className="mt-1 text-sm font-semibold text-slate-950">{props.subtitle}</p> : null}
        {savedLabel ? <p className="mt-1 text-xs font-medium text-slate-600">{savedLabel}</p> : null}
      </div>
    );
  }, [props.title, props.subtitle, savedLabel]);

  return (
    <>
      {/* Desktop rail */}
      {!props.mobileOnly ? (
      <div className={cn("hidden md:block", props.desktopClassName)}>
        <Card className="border-slate-200">
          <CardBody className="space-y-3">
            {header}
            <div className="flex flex-wrap gap-2">
              <CopySummaryButton getText={props.copyText} label="Copy summary" />
              {props.onGoSteps ? (
                <Button variant="secondary" size="sm" onClick={props.onGoSteps}>
                  Steps
                </Button>
              ) : null}
              {props.compare ? (
                <Button variant="secondary" size="sm" type="button" onClick={() => setCompareOpen(true)}>
                  Compare
                </Button>
              ) : null}
            </div>

            {hasExport ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Export</p>
                <div className="flex flex-wrap gap-2">
                  {props.csv ? <ExportCsvButton filename={props.csv.filename} rows={props.csv.rows} /> : null}
                  {props.json ? <ExportJsonButton data={props.json.data} /> : null}
                </div>
              </div>
            ) : null}

            {props.onReset ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reset</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={resetArmed ? "danger" : "secondary"}
                    size="sm"
                    onClick={() => {
                      if (!resetArmed) {
                        setResetArmed(true);
                        window.setTimeout(() => setResetArmed(false), 1500);
                        return;
                      }
                      setResetArmed(false);
                      props.onReset?.();
                    }}
                  >
                    {resetArmed ? "Confirm reset" : "Reset inputs"}
                  </Button>
                  <span className="text-xs font-medium text-slate-600">Clears saved inputs in this browser.</span>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
      ) : null}

      {/* Mobile bottom bar */}
      {!props.hideMobileBar ? (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
          <div className="min-w-0">
            {props.subtitle ? <p className="truncate text-xs font-semibold text-slate-800">{props.subtitle}</p> : null}
            <p className="hidden text-[11px] font-medium text-slate-600 sm:block">
              {savedLabel ? `${savedLabel} · ` : ""}Copy, jump to steps, export, or reset.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {props.onGoResults ? (
              <Button variant="secondary" size="sm" onClick={props.onGoResults}>
                Results
              </Button>
            ) : null}
            {props.onGoSteps ? (
              <div className="hidden sm:block">
                <Button variant="secondary" size="sm" onClick={props.onGoSteps}>
                  Steps
                </Button>
              </div>
            ) : null}
            {props.compare ? (
              <div className="hidden sm:block">
                <Button variant="secondary" size="sm" type="button" onClick={() => setCompareOpen(true)}>
                  Compare
                </Button>
              </div>
            ) : null}
            <CopySummaryButton getText={props.copyText} label="Copy" />
            {hasExport || props.onReset ? (
              <Button variant="secondary" size="sm" type="button" onClick={() => setSheetOpen(true)}>
                More
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}
      {!props.hideMobileBar ? <div className="h-[calc(env(safe-area-inset-bottom,0px)+64px)] md:hidden" aria-hidden="true" /> : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-[90] md:hidden" role="dialog" aria-modal="true" aria-label="Actions">
          <button
            type="button"
            className={modalOverlayClass}
            aria-label="Close actions"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0">
            <div ref={sheetPanelRef} className={cn(modalPanelClass, "rounded-b-none border-slate-200 pb-[env(safe-area-inset-bottom,0px)]")}>
              <div className="flex justify-center pt-3">
                <div className="h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
              </div>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</p>
                    {props.subtitle ? <p className="mt-1 truncate text-sm font-semibold text-slate-950">{props.subtitle}</p> : null}
                  </div>
                  <Button ref={sheetCloseRef} variant="ghost" size="sm" type="button" onClick={() => setSheetOpen(false)}>
                    Close
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <CopySummaryButton getText={props.copyText} label="Copy summary" />
                  {props.onGoSteps ? (
                    <Button variant="secondary" size="sm" onClick={() => { setSheetOpen(false); props.onGoSteps?.(); }}>
                      Steps
                    </Button>
                  ) : null}
                  {props.compare ? (
                    <Button variant="secondary" size="sm" type="button" onClick={() => { setSheetOpen(false); setCompareOpen(true); }}>
                      Compare
                    </Button>
                  ) : null}
                </div>

                {hasExport ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Export</p>
                    <div className="flex flex-wrap gap-2">
                      {props.csv ? <ExportCsvButton filename={props.csv.filename} rows={props.csv.rows} /> : null}
                      {props.json ? <ExportJsonButton data={props.json.data} /> : null}
                    </div>
                  </div>
                ) : null}

                {props.onReset ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reset</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={resetArmed ? "danger" : "secondary"}
                        size="sm"
                        onClick={() => {
                          if (!resetArmed) {
                            setResetArmed(true);
                            window.setTimeout(() => setResetArmed(false), 1500);
                            return;
                          }
                          setResetArmed(false);
                          setSheetOpen(false);
                          props.onReset?.();
                        }}
                      >
                        {resetArmed ? "Confirm reset" : "Reset inputs"}
                      </Button>
                      <span className="text-xs font-medium text-slate-600">Clears saved inputs in this browser.</span>
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </div>
          </div>
        </div>
      ) : null}

      {props.compare ? (
        <CompareDrawer
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          storageKey={props.compare.storageKey}
          getCurrent={props.compare.getCurrent}
        />
      ) : null}
    </>
  );
}

