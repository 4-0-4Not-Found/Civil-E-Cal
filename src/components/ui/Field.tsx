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
  className?: string;
  disabled?: boolean;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
}) {
  const canClear = (props.clearable ?? true) && props.value.length > 0 && !props.disabled;
  return (
    <div className="relative">
      <input
        className={cn(
          "w-full min-h-11 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400 focus-visible:ring-4 focus-visible:ring-sky-500/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500",
          canClear ? "pr-10" : null,
          props.className,
        )}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        inputMode={props.inputMode}
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
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={cn(
        "w-full min-h-11 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm font-semibold text-black shadow-sm outline-none focus:border-sky-400 focus-visible:ring-4 focus-visible:ring-sky-500/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500",
        props.className,
      )}
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value)}
    >
      {props.children}
    </select>
  );
}