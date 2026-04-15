import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Badge(props: { tone?: "neutral" | "good" | "bad" | "info"; className?: string; children: ReactNode }) {
  const tone = props.tone ?? "neutral";
  const toneClass =
    tone === "good"
      ? "border-green-300 bg-green-50 text-green-900"
      : tone === "bad"
        ? "border-red-300 bg-red-50 text-red-900"
        : tone === "info"
          ? "border-[color:var(--brand)]/25 bg-[color:var(--brand)]/5 text-[color:var(--brand)]"
          : "border-slate-300 bg-slate-100 text-slate-900";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold sm:px-3 sm:py-1.5", toneClass, props.className)}>
      {props.children}
    </span>
  );
}

