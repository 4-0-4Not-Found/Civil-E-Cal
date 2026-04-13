import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Field(props: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", props.className)}>
      <span className="text-base font-semibold text-slate-900">{props.label}</span>
      {props.hint ? <span className="text-sm text-slate-600">{props.hint}</span> : null}
      {props.children}
    </label>
  );
}

export function TextInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function SelectInput(props: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base font-medium text-black shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    >
      {props.children}
    </select>
  );
}

