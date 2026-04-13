"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { BeamLimitStates, CalculationOutput, CalculationResult, CalculationStep } from "@/lib/types/calculation";
import { readModuleStoresFromLocalStorage, summarizeModuleStores } from "@/lib/report/snapshot-store";

function formatNumberForReport(v: number): string {
  if (!Number.isFinite(v)) {
    if (v === Number.POSITIVE_INFINITY) return "∞ (not controlling)";
    if (v === Number.NEGATIVE_INFINITY) return "−∞";
    return "—";
  }
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 10000 || (a < 1e-4 && a > 0)) return v.toExponential(4);
  return a >= 100 ? v.toFixed(2) : a >= 1 ? v.toFixed(4) : v.toFixed(6);
}

function formatStepCell(step: CalculationStep): string {
  const v = step.value;
  if (typeof v === "string") {
    return step.unit ? `${v} ${step.unit}` : v;
  }
  return `${formatNumberForReport(v)}${step.unit ? ` ${step.unit}` : ""}`;
}

function CalculationStepsTable({ steps, title }: { steps: CalculationStep[]; title: string }) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-3 print:break-inside-avoid">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700 print:text-[10px]">{title}</h4>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full border-collapse border border-slate-300 text-xs print:text-[10px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1.5 text-left font-medium">Item</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-medium">Formula / reference</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="border border-slate-300 px-2 py-1.5">{s.label}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-slate-600">{s.formula ?? "—"}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums text-slate-900">
                  {formatStepCell(s)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {steps.some((s) => s.note) ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[11px] text-slate-600 print:text-[9px]">
          {steps
            .filter((s) => s.note)
            .map((s) => (
              <li key={`${s.id}-note`}>
                <span className="font-medium text-slate-700">{s.label}:</span> {s.note}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

function LimitStatesResultsTable({ results }: { results: Record<string, CalculationResult> }) {
  const rows = Object.values(results);
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 print:break-inside-avoid">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700 print:text-[10px]">Limit states (capacities)</h4>
      <table className="mt-1 w-full border-collapse border border-slate-300 text-xs print:text-[10px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-1.5 text-left">Mode</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right">φR_n or allowable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="border border-slate-300 px-2 py-1.5">{r.name}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums">
                {formatNumberForReport(r.phiPn)} {r.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BeamLimitStatesBlock({ beamLimitStates, overallSafe }: { beamLimitStates: BeamLimitStates; overallSafe: boolean }) {
  const b = beamLimitStates;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs print:break-inside-avoid print:bg-transparent">
      <h4 className="font-semibold text-slate-900">Demand / capacity by limit state</h4>
      <table className="w-full border-collapse border border-slate-300 print:text-[10px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-1.5 text-left">Check</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right">Demand</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right">Capacity</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right">D/C / ratio</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 px-2 py-1.5">Flexure</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.bending.demand)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.bending.capacity)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.bending.ratio)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-slate-600">{b.bending.unit}</td>
          </tr>
          <tr>
            <td className="border border-slate-300 px-2 py-1.5">Shear</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.shear.demand)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.shear.capacity)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.shear.ratio)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-slate-600">
              {b.shear.unit}; {b.shear.cvCase}; C_v = {formatNumberForReport(b.shear.cv)}
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 px-2 py-1.5">Deflection</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.deflection.demand)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.deflection.capacity)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.deflection.ratio)}</td>
            <td className="border border-slate-300 px-2 py-1.5 text-slate-600">{b.deflection.unit} (demand = δ, capacity = δ_allow)</td>
          </tr>
        </tbody>
      </table>
      <p className="text-slate-800">
        <span className="font-semibold">Governing (max ratio):</span> {b.governing} ·{" "}
        <span className="font-semibold">Overall member:</span> {overallSafe ? "SAFE" : "NOT SAFE"}
      </p>
    </div>
  );
}

function ModuleSummaryStrip({ output }: { output: CalculationOutput }) {
  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 print:border-slate-300 print:text-[10px]">
      <p>
        <span className="font-semibold">Governing case:</span> {output.governingCase}
      </p>
      <p>
        <span className="font-semibold">Controlling capacity / demand:</span>{" "}
        <span className="font-mono tabular-nums">
          {formatNumberForReport(output.controllingStrength)} / {formatNumberForReport(output.demand)}
        </span>
      </p>
      <p>
        <span className="font-semibold">Status:</span> {output.isSafe ? "SAFE" : "NOT SAFE"}
      </p>
    </div>
  );
}

export default function ReportPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const summaries = useMemo(() => {
    if (!mounted || typeof window === "undefined") return null;
    const stores = readModuleStoresFromLocalStorage();
    return summarizeModuleStores(stores);
  }, [mounted]);

  const tensionS = summaries?.tension ?? null;
  const compressionS = summaries?.compression ?? null;
  const bendingS = summaries?.bending ?? null;
  const connectionsS = summaries?.connections ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10 print:p-4">
      <Card className="print:border-0 print:shadow-none">
        <CardHeader
          title="Project summary"
          description="Snapshot from inputs saved in this browser. Detailed steps below match the calculators. Use Print to save as PDF."
          right={
            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
              >
                Print / Save PDF
              </button>
              <Link href="/" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
                Home
              </Link>
            </div>
          }
        />
        <CardBody className="space-y-6 text-sm text-slate-800">
          {!mounted ? (
            <p className="text-slate-600">Loading…</p>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
                <h3 className="font-bold text-slate-900">Tension</h3>
                {tensionS?.ok ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-slate-600">Material: {tensionS.materialLabel}</p>
                    <ModuleSummaryStrip output={tensionS.output} />
                    <LimitStatesResultsTable results={tensionS.output.results} />
                    <CalculationStepsTable steps={tensionS.output.steps} title="Calculation steps (AISC D2 / J4.3)" />
                  </div>
                ) : (
                  <p className="mt-1 text-slate-600">{tensionS && "error" in tensionS ? tensionS.error : "No data."}</p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
                <h3 className="font-bold text-slate-900">Compression</h3>
                {compressionS?.ok ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-slate-600">
                      Shape: {compressionS.shapeName} · Steel: {compressionS.materialLabel}
                    </p>
                    <ModuleSummaryStrip output={compressionS.output} />
                    <LimitStatesResultsTable results={compressionS.output.results} />
                    <CalculationStepsTable steps={compressionS.output.steps} title="Calculation steps (AISC E3 / local limits)" />
                  </div>
                ) : (
                  <p className="mt-1 text-slate-600">
                    {compressionS && "error" in compressionS ? compressionS.error : "No data."}
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
                <h3 className="font-bold text-slate-900">Beam (bending / shear / deflection)</h3>
                {bendingS?.ok ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-slate-600">
                      Shape: {bendingS.shapeName} ({bendingS.shapeFamilyLabel}) · Steel: {bendingS.materialLabel}
                    </p>
                    {bendingS.output.beamLimitStates ? (
                      <BeamLimitStatesBlock
                        beamLimitStates={bendingS.output.beamLimitStates}
                        overallSafe={bendingS.output.isSafe}
                      />
                    ) : (
                      <ModuleSummaryStrip output={bendingS.output} />
                    )}
                    <LimitStatesResultsTable results={bendingS.output.results} />
                    <CalculationStepsTable steps={bendingS.output.steps} title="Calculation steps (AISC F2 / F6 / G2 / deflection)" />
                  </div>
                ) : (
                  <p className="mt-1 text-slate-600">{bendingS && "error" in bendingS ? bendingS.error : "No data."}</p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
                <h3 className="font-bold text-slate-900">Connections</h3>
                {connectionsS?.ok && connectionsS.module === "connections" ? (
                  <div className="mt-2 space-y-3">
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      <li>
                        Design: {connectionsS.designMethod ?? "—"} · Shear mode: {connectionsS.shearMode ?? "—"}
                      </li>
                      {connectionsS.phiRnShearGoverning !== undefined &&
                      connectionsS.demandVu !== undefined &&
                      connectionsS.shearSafe !== undefined ? (
                        <li>
                          Shear ({connectionsS.shearLabel ?? connectionsS.shearMode}): capacity / demand:{" "}
                          {connectionsS.phiRnShearGoverning.toFixed(4)} / {connectionsS.demandVu.toFixed(4)} kips · Status:{" "}
                          {connectionsS.shearSafe ? "SAFE" : "NOT SAFE"}
                        </li>
                      ) : (
                        <li>Shear / slip: (insufficient saved inputs for a check)</li>
                      )}
                      {connectionsS.phiRnTension !== undefined &&
                      connectionsS.demandTu !== undefined &&
                      connectionsS.tensionSafe !== undefined ? (
                        <li>
                          Tension: capacity / demand: {connectionsS.phiRnTension.toFixed(4)} / {connectionsS.demandTu.toFixed(4)}{" "}
                          kips · Status: {connectionsS.tensionSafe ? "SAFE" : "NOT SAFE"}
                        </li>
                      ) : null}
                      {connectionsS.interactionSum !== undefined && connectionsS.interactionSafe !== undefined ? (
                        <li>
                          Shear–tension interaction (Σ): {connectionsS.interactionSum.toFixed(6)} · Status:{" "}
                          {connectionsS.interactionSafe ? "SAFE" : "NOT SAFE"}
                        </li>
                      ) : null}
                      {connectionsS.phiRnWeld !== undefined &&
                      connectionsS.weldDemand !== undefined &&
                      connectionsS.weldSafe !== undefined ? (
                        <li>
                          Fillet weld: capacity / demand: {connectionsS.phiRnWeld.toFixed(4)} / {connectionsS.weldDemand.toFixed(4)}{" "}
                          kips · Status: {connectionsS.weldSafe ? "SAFE" : "NOT SAFE"}
                        </li>
                      ) : null}
                      {connectionsS.phiRnGroove !== undefined &&
                      connectionsS.grooveDemand !== undefined &&
                      connectionsS.grooveSafe !== undefined ? (
                        <li>
                          Groove weld (shear on throat): capacity / demand: {connectionsS.phiRnGroove.toFixed(4)} /{" "}
                          {connectionsS.grooveDemand.toFixed(4)} kips · Status: {connectionsS.grooveSafe ? "SAFE" : "NOT SAFE"}
                        </li>
                      ) : null}
                      {connectionsS.pryingTMinApproxIn !== undefined && connectionsS.pryingTPerBoltUsed !== undefined ? (
                        <li>
                          Prying (approx. plate thickness): T/bolt = {connectionsS.pryingTPerBoltUsed.toFixed(4)} kips · t_min ≈{" "}
                          {connectionsS.pryingTMinApproxIn.toFixed(4)} in (simplified strip model — see Connections module)
                        </li>
                      ) : null}
                    </ul>
                    {connectionsS.detailSteps && connectionsS.detailSteps.length > 0 ? (
                      <CalculationStepsTable
                        steps={connectionsS.detailSteps}
                        title="Connections — detailed check (bolts, slip, fillet weld, optional groove & prying)"
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-slate-600">
                    {connectionsS && "error" in connectionsS ? connectionsS.error : "No data."}
                  </p>
                )}
              </section>
            </>
          )}
        </CardBody>
      </Card>
    </main>
  );
}

