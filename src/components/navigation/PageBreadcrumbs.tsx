"use client";

import { usePathname } from "next/navigation";
import { BREADCRUMB_LABELS } from "@/lib/ui/strings";
import { BrandLink } from "@/components/ui/BrandLink";

export function PageBreadcrumbs() {
  const pathname = usePathname() ?? "/";
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [{ href: "/", label: BREADCRUMB_LABELS["/"] ?? "Home" }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    const label = BREADCRUMB_LABELS[acc] ?? seg.replace(/-/g, " ");
    crumbs.push({ href: acc, label });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="border-t border-slate-100 bg-slate-50/80 px-2 pb-2 pt-3 dark:border-slate-800 dark:bg-slate-900/50"
    >
      <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-2 text-xs font-semibold text-slate-600 md:px-6 dark:text-slate-400">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            {i > 0 ? <span className="text-slate-400" aria-hidden="true">/</span> : null}
            {i === crumbs.length - 1 ? (
              <span className="text-slate-900 dark:text-slate-100">{c.label}</span>
            ) : (
              <BrandLink href={c.href} className="dark:text-blue-300">
                {c.label}
              </BrandLink>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
