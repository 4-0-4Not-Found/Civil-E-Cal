"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "neutral" | "good" | "bad" | "info";
export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  tone?: ToastTone;
  ttlMs?: number;
};

type Ctx = {
  push: (t: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider(props: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${seq.current++}`;
    const ttlMs = t.ttlMs ?? 2600;
    const item: ToastItem = { id, ...t, ttlMs };
    setItems((cur) => [...cur, item].slice(-4));
    window.setTimeout(() => {
      setItems((cur) => cur.filter((x) => x.id !== id));
    }, ttlMs);
  }, []);

  const value = useMemo<Ctx>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <ToastViewport items={items} onDismiss={(id) => setItems((cur) => cur.filter((x) => x.id !== id))} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { push: () => {} };
  }
  return ctx;
}

function ToastViewport(props: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  if (props.items.length === 0) return null;
  return (
    <div className="not-print fixed inset-x-0 bottom-3 z-[120] flex justify-center px-4">
      <div className="w-full max-w-md space-y-2">
        {props.items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "rounded-2xl border bg-white/95 p-3 shadow-xl ring-1 ring-slate-950/5 backdrop-blur",
              t.tone === "good"
                ? "border-emerald-200"
                : t.tone === "bad"
                  ? "border-rose-200"
                  : t.tone === "info"
                    ? "border-slate-200"
                    : "border-slate-200",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{t.title}</p>
                {t.message ? <p className="mt-0.5 text-xs font-medium text-slate-600">{t.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => props.onDismiss(t.id)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

