import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card(props: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", props.className)}>{props.children}</section>;
}

export function CardHeader(props: {
  className?: string;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  /** Keep document outline correct; defaults to h2 for cards. */
  titleAs?: "h1" | "h2" | "h3";
}) {
  const TitleTag = props.titleAs ?? "h2";
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 sm:gap-4 sm:p-6", props.className)}>
      <div className="min-w-0">
        <TitleTag className="text-lg font-extrabold tracking-tight text-[color:var(--brand)] sm:text-xl md:text-2xl">
          {props.title}
        </TitleTag>
        {props.description ? <p className="mt-2 text-sm text-slate-700 sm:text-[15px] md:text-base">{props.description}</p> : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  );
}

export function CardBody(props: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4 sm:p-6", props.className)}>{props.children}</div>;
}
