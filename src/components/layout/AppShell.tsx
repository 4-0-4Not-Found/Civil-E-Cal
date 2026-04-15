import type { ReactNode } from "react";
import { AppHeader } from "@/components/navigation/AppHeader";
import { PageBreadcrumbs } from "@/components/navigation/PageBreadcrumbs";
import { ToastProvider } from "@/components/ui/Toast";

function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-xs font-semibold tracking-wide text-slate-500">BSCE-3D</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prepared by</span>
              <span className="font-semibold text-slate-800">Simone Rey Dy</span>
              <span className="text-slate-300" aria-hidden="true">
                •
              </span>
              <span className="font-semibold text-slate-800">Jay-R Suniga</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function AppShell(props: { children: ReactNode; width?: "6xl" | "3xl" }) {
  const maxWidth = props.width === "3xl" ? "max-w-3xl" : "max-w-6xl";

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-white">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--brand)] focus:shadow-md"
        >
          Skip to content
        </a>
        <a
          href="#actions"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-16 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--brand)] focus:shadow-md"
        >
          Skip to actions
        </a>
        <a
          href="#results"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-28 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--brand)] focus:shadow-md"
        >
          Skip to results
        </a>
        <AppHeader />
        <PageBreadcrumbs />
        <main id="content" className={`mx-auto w-full ${maxWidth} px-4 pb-10 pt-6 md:px-8 md:pt-8`}>
          {props.children}
        </main>
        <AppFooter />
      </div>
    </ToastProvider>
  );
}

