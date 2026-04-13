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
          ? "border-blue-300 bg-blue-50 text-blue-900"
          : "border-slate-300 bg-slate-100 text-slate-900";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold", toneClass, props.className)}>
      {props.children}
    </span>
  );
}

