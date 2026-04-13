import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProjectBackupPanel } from "@/components/ProjectBackupPanel";
import { InstallAppButton } from "@/components/InstallAppButton";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">AISC 16th Edition</Badge>
            <Badge>Offline-first PWA</Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Structural steel calculators</h1>
          <p className="text-slate-600">
            Four modules - tension, compression, beam (bending, shear, deflection), and connections - using the AISC v16 shape
            database. Enter inputs, review step tables, and export CSV or JSON.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/info"
              className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 hover:bg-blue-100"
            >
              Info - what each tool does, limits &amp; units
            </Link>
            <Link
              href="/report"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:border-blue-300 hover:bg-slate-50"
            >
              Summary - printable snapshot of saved work
            </Link>
            <InstallAppButton />
          </div>
          <ProjectBackupPanel />
        </CardBody>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/tension"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-400 hover:shadow-md"
        >
          <h2 className="text-xl font-semibold text-slate-900">Tension</h2>
          <p className="mt-2 text-slate-600">Yielding, rupture, block shear, staggered net-area helper.</p>
        </Link>
        <Link
          href="/compression"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-400 hover:shadow-md"
        >
          <h2 className="text-xl font-semibold text-slate-900">Compression</h2>
          <p className="mt-2 text-slate-600">Column buckling (E3), K and length, LRFD or ASD.</p>
        </Link>
        <Link
          href="/bending-shear"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-400 hover:shadow-md"
        >
          <h2 className="text-xl font-semibold text-slate-900">Beam</h2>
          <p className="mt-2 text-slate-600">W-shapes: flexure, shear, deflection; optional lightest-section hint.</p>
        </Link>
        <Link
          href="/connections"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-400 hover:shadow-md"
        >
          <h2 className="text-xl font-semibold text-slate-900">Connections</h2>
          <p className="mt-2 text-slate-600">Bolts, slip, tension, interaction, fillet welds.</p>
        </Link>
      </section>
    </main>
  );
}
