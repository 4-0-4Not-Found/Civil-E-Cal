"use client";

import { type ReactNode } from "react";
import { PageSectionNav } from "@/components/navigation/PageSectionNav";
import { cn } from "@/lib/utils";

export function PageSectionLayout(props: {
  sections: { id: string; label: string }[];
  children: ReactNode;
  /** Optional extra classes for the outer wrapper. */
  className?: string;
  /** Optional extra classes for the desktop sidebar wrapper. */
  sidebarClassName?: string;
  /** Optional className forwarded to PageSectionNav. */
  navClassName?: string;
}) {
  if (props.sections.length === 0) return <>{props.children}</>;

  return (
    <div className={cn("w-full", props.className)}>
      {/* Mobile: keep it in-flow above content (no overlap). */}
      <div className="mb-4 md:hidden">
        <PageSectionNav sections={props.sections} className={props.navClassName} />
      </div>

      {/* Desktop: two-column layout, sticky nav contained to sidebar. */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-6">
        <div className="min-w-0">{props.children}</div>
        <aside className={cn("hidden md:block", props.sidebarClassName)}>
          <PageSectionNav sections={props.sections} className={props.navClassName} />
        </aside>
      </div>
    </div>
  );
}

