import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AppShell } from "@/components/layout/AppShell";
import { PageFooterNav } from "@/components/navigation/PageFooterNav";
import { PageSectionLayout } from "@/components/navigation/PageSectionLayout";
import { BrandLink } from "@/components/ui/BrandLink";

/** Help: capabilities, limits, units, and tips for students. */
export default function InfoPage() {
  return (
    <AppShell>
      <Card>
        <CardHeader
          title="About this app"
          description="AISC 360–based steel checks using the v16 shape database. Works offline after the first load (PWA). Use Summary to print or review inputs and key results together."
        />
        <CardBody className="max-w-none space-y-4 text-slate-800">
          <PageSectionLayout
            sections={[
              { id: "info-capabilities", label: "Capabilities" },
              { id: "info-limits", label: "Limitations" },
              { id: "info-units", label: "Units" },
              { id: "info-tips", label: "Tips" },
            ]}
          >
          <details id="info-capabilities" open className="rounded-2xl border border-slate-200 bg-white">
            <summary className="min-h-11 cursor-pointer px-4 py-3.5 text-sm font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 sm:px-5 sm:py-4">
              What you can do
              <span className="mt-1 block text-xs font-semibold text-slate-600">
                A quick map of each module and what it checks.
              </span>
            </summary>
            <div className="border-t border-slate-200 p-5">
              <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>
                <strong>Tension:</strong> Gross yielding, net-section rupture, block shear (J4.3), optional Net Area Solver
                for staggered net-width (D3). Check mode or design hint (lightest shape in a chosen family by weight).
              </li>
              <li>
                <strong>Compression:</strong> Member flexural buckling (E3), controlling KL/r, LRFD or ASD. Optional multiplier on{" "}
                <strong>K</strong> for course notes or built-up bracing (not a full lacing/batten design). Local plate limits are
                approximated when slenderness data exists—see limitations below.
              </li>
              <li>
                <strong>Beam:</strong> Strong axis, simply supported: flexure (F6 flange + F2 LTB), shear (G2), deflection.
                <strong> Design mode</strong> searches rolled <strong>W</strong> shapes. <strong>Check mode</strong> can use{" "}
                <strong>W</strong> or <strong>HSS</strong> with simplified HSS assumptions (wall slenderness, shear area).
                Optional dead/live/span to build loads, or enter M, V, and w yourself.
              </li>
              </ul>
            </div>
          </details>

          <details id="info-limits" open className="rounded-2xl border border-slate-200 bg-white">
            <summary className="min-h-11 cursor-pointer px-4 py-3.5 text-sm font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 sm:px-5 sm:py-4">
              What this app does not replace
              <span className="mt-1 block text-xs font-semibold text-slate-600">
                Limits and what to verify outside the tool.
              </span>
            </summary>
            <div className="border-t border-slate-200 p-5">
              <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>
                Full connection design: eccentric bolt groups, full T-stub / end-plate prying, combined weld limit states beyond the
                shear-on-throat checks here, and project-specific details not captured in a short form.
              </li>
              <li>
                <strong>Beam design mode</strong> does not search HSS — use check mode for HSS strong-axis review with the stated
                simplifications.
              </li>
              <li>Full AISC E7 effective-area treatment for every slender compression element—results are educational checks.</li>
              <li>Building code load combinations beyond what you enter (wind, seismic, snow) unless you supply the factored loads.</li>
              <li>Sealed or permit-ready construction documents—always verify with your instructor or a licensed engineer when required.</li>
              </ul>
            </div>
          </details>

          <details id="info-units" open className="rounded-2xl border border-slate-200 bg-white">
            <summary className="min-h-11 cursor-pointer px-4 py-3.5 text-sm font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 sm:px-5 sm:py-4">
              Units & conventions
              <span className="mt-1 block text-xs font-semibold text-slate-600">
                Consistent units used across the calculators.
              </span>
            </summary>
            <div className="border-t border-slate-200 p-5">
              <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>
                <strong>Length:</strong> inches (in) unless a field says feet (e.g. beam span in feet converts to inches inside).
              </li>
              <li>
                <strong>Force:</strong> kips; <strong>stress:</strong> ksi; <strong>moment:</strong> kip·ft where labeled.
              </li>
              <li>
                <strong>LRFD</strong> is the default; switch to <strong>ASD</strong> where offered. Beam auto-loads from D+L use
                LRFD factored w for strength when LRFD is selected, and D+L for ASD strength when ASD is selected; service{" "}
                <strong>L only</strong> is used for deflection checks.
              </li>
              <li>Final strengths and demands are usually shown to <strong>about three decimal places</strong> for readability.</li>
              </ul>
            </div>
          </details>

          <details id="info-tips" open className="rounded-2xl border border-slate-200 bg-white">
            <summary className="min-h-11 cursor-pointer px-4 py-3.5 text-sm font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 sm:px-5 sm:py-4">
              Tips
              <span className="mt-1 block text-xs font-semibold text-slate-600">
                Faster workflow and where to print/export.
              </span>
            </summary>
            <div className="border-t border-slate-200 p-5">
              <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>
                Open each calculator from <BrandLink href="/">Home</BrandLink> — each module has its own full-width layout. Use{" "}
                <BrandLink href="/report">Report</BrandLink> for a combined view of saved inputs.
              </li>
              <li>
                Export <strong>CSV</strong> or <strong>JSON</strong> on each module to archive work or open CSV in Excel.
              </li>
              <li>
                On Home, use <strong>Save / load project</strong> to keep inputs in this browser or download a single JSON
                backup file.
              </li>
              <li>
                Use <BrandLink href="/report">Report</BrandLink> (also linked on Home) for a printable overview when you have saved inputs.
              </li>
              </ul>
            </div>
          </details>
          </PageSectionLayout>
        </CardBody>
      </Card>
      <PageFooterNav currentHref="/info" />
    </AppShell>
  );
}
