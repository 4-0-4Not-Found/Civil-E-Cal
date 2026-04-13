import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/** Help: capabilities, limits, units, and tips for students. */
export default function InfoPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardHeader
          title="About this app"
          description="AISC 360–based steel checks using the v16 shape database. Works offline after the first load (PWA). Use Summary to print or review inputs and key results together."
          right={
            <Link href="/" className="text-sm font-medium text-blue-700 hover:underline">
              Home
            </Link>
          }
        />
        <CardBody className="max-w-none space-y-8 text-slate-800">
          <section>
            <h3 className="text-lg font-bold text-slate-900">What you can do</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
              <li>
                <strong>Tension:</strong> Gross yielding, net-section rupture, block shear (J4.3), optional staggered net-width
                helper (D3). Check mode or design hint (lightest shape in a chosen family by weight).
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
              <li>
                <strong>Connections:</strong> Bolt shear and bearing (J3.10 — hole-edge limit), slip-critical slip (J3.8), bolt
                tension, shear–tension interaction, fillet and groove weld metal in shear, approximate prying plate thickness —
                plus bolt-count and weld-length hints. Inputs can auto-save in your browser.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900">What this app does not replace</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
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
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900">Units &amp; conventions</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
              <li>
                <strong>Length:</strong> inches (in) unless a field says feet (e.g. beam span in feet converts to inches inside).
              </li>
              <li>
                <strong>Force:</strong> kips; <strong>stress:</strong> ksi; <strong>moment:</strong> kip·ft where labeled.
              </li>
              <li>
                <strong>LRFD</strong> is the default; switch to <strong>ASD</strong> where offered. Beam auto-loads from D+L use
                LRFD factored w for strength when LRFD is selected, and D+L for ASD strength when ASD is selected; service{" "}
                <strong>D+L</strong> is used for deflection checks.
              </li>
              <li>Final strengths and demands are usually shown to <strong>about three decimal places</strong> for readability.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900">Tips</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
              <li>
                Open each calculator from <Link href="/" className="text-blue-700 hover:underline">Home</Link> — each module has
                its own full-width layout. Use <Link href="/report" className="text-blue-700 hover:underline">Summary</Link> for a
                combined view of saved inputs.
              </li>
              <li>
                Export <strong>CSV</strong> or <strong>JSON</strong> on each module to archive work or open CSV in Excel.
              </li>
              <li>
                On Home, use <strong>Save / load project</strong> to keep inputs in this browser or download a single JSON
                backup file.
              </li>
              <li>
                Use <Link href="/report" className="text-blue-700 hover:underline">Summary</Link> (also linked on Home) for a
                printable overview when you have saved inputs.
              </li>
            </ul>
          </section>
        </CardBody>
      </Card>
    </main>
  );
}
