"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { STORAGE } from "@/lib/storage/keys";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type ModuleKey = keyof typeof STORAGE;

const modules: Array<{ key: ModuleKey; label: string; href: string }> = [
  { key: "tension", label: "Tension", href: "/tension" },
  { key: "compression", label: "Compression", href: "/compression" },
  { key: "bending", label: "Beam", href: "/bending-shear" },
];

export function ModuleProgressPanel() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    queueMicrotask(() => setTick((v) => v + 1));
  }, []);

  const status = useMemo(() => {
    void tick;
    const out: Record<string, { hasData: boolean }> = {};
    for (const m of modules) {
      const k = STORAGE[m.key];
      out[m.key] = { hasData: typeof window !== "undefined" && Boolean(localStorage.getItem(k)) };
    }
    return out;
  }, [tick]);

  const resumeHref = useMemo(() => {
    void tick;
    try {
      if (typeof window === "undefined") return null;
      const last = localStorage.getItem("ssc:lastRoute");
      return last && typeof last === "string" ? last : null;
    } catch {
      return null;
    }
  }, [tick]);

  useEffect(() => {
    const onVis = () => {
      // refresh localStorage-derived UI
      setTick((v) => v + 1);
    };
    window.addEventListener("focus", onVis);
    return () => window.removeEventListener("focus", onVis);
  }, []);

  return (
    <Card className="border-slate-200">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-950">Your progress</p>
            <p className="text-sm text-slate-700">See which modules have saved inputs on this device.</p>
          </div>
          {resumeHref ? (
            <Link href={resumeHref}>
              <Button variant="primary" size="sm">
                Continue
              </Button>
            </Link>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((m) => {
            const hasData = status ? status[m.key]?.hasData : false;
            return (
              <Link
                key={m.key}
                href={m.href}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[color:var(--brand)]/35 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-slate-950">{m.label}</p>
                    <p className="text-sm text-slate-700">{hasData ? "Saved inputs found" : "No saved inputs yet"}</p>
                  </div>
                  {hasData ? <Badge tone="good">READY</Badge> : <Badge tone="neutral">NEW</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

