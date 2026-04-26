import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AppShell } from "@/components/layout/AppShell";
import { PageFooterNav } from "@/components/navigation/PageFooterNav";
import { RetryReloadButton } from "@/components/offline/RetryReloadButton";
import { BrandLink } from "@/components/ui/BrandLink";

export default function OfflinePage() {
  return (
    <AppShell width="3xl">
      <Card>
        <CardHeader
          title="You are offline"
          description="The app shell is available, but this page could not be loaded from cache."
          right={
            <div className="flex items-center gap-2">
              <RetryReloadButton />
              <BrandLink href="/" className="text-sm">
                Go Home
              </BrandLink>
            </div>
          }
        />
        <CardBody className="space-y-2 text-sm text-slate-700">
          <p>Try reconnecting and refresh to access the latest data.</p>
          <p>Your saved calculator inputs in this browser are not deleted.</p>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick links</p>
            <div className="flex flex-wrap gap-2">
              {[
                { href: "/tension", label: "Tension" },
                { href: "/compression", label: "Compression" },
                { href: "/bending-shear", label: "Beam" },
                { href: "/report", label: "Report" },
                { href: "/info", label: "Info" },
              ].map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10"
                >
                  {i.label}
                </Link>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
      <PageFooterNav currentHref="/offline" />
    </AppShell>
  );
}
