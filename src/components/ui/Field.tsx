import { cn } from "@/lib/utils";
import { useId, type ReactNode } from "react";

export function Field(props: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <label className={cn("flex flex-col gap-1.5", props.className)}>
      <span className="text-sm font-semibold text-slate-900">{props.label}</span>
      {props.hint ? (
        <span id={hintId} className="text-xs leading-relaxed text-slate-600">
          {props.hint}
        </span>
      ) : null}
      {props.children}
      {props.error ? (
        <span id={errorId} className="text-xs font-semibold text-[color:var(--action)]">
          {props.error}
        </span>
      ) : null}
    </label>
  );
}

export function TextInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const canClear = (props.clearable ?? true) && props.value.length > 0;
  return (
    <div className="relative">
      <input
        className={cn(
          "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-[color:var(--brand)]/40 focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10",
          canClear ? "pr-10" : null,
        )}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {canClear ? (
        <button
          type="button"
          aria-label="Clear field"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
          onClick={() => props.onChange("")}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function SelectInput(props: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      className="w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-black shadow-sm outline-none focus:border-[color:var(--brand)]/40 focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    >
      {props.children}
    </select>
  );
}

