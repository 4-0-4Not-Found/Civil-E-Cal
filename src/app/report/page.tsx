"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { BeamLimitStates, CalculationOutput, CalculationResult, CalculationStep } from "@/lib/types/calculation";
import { readModuleStoresFromLocalStorage, summarizeModuleStores } from "@/lib/report/snapshot-store";
import { AppShell } from "@/components/layout/AppShell";
import { PageFooterNav } from "@/components/navigation/PageFooterNav";
import { PageSectionLayout } from "@/components/navigation/PageSectionLayout";
import { Button } from "@/components/ui/Button";

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
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-left font-medium">Item</th>
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-left font-medium">Formula / reference</th>
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-right font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, idx) => (
              <tr key={s.id} className={idx % 2 === 1 ? "align-top bg-slate-50/60" : "align-top"}>
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
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse border border-slate-300 text-xs print:min-w-0 print:text-[10px]">
          <thead>
            <tr className="bg-slate-100">
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-left">Mode</th>
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-right">φR_n or allowable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.name} className={idx % 2 === 1 ? "bg-slate-50/60" : undefined}>
                <td className="border border-slate-300 px-2 py-1.5">{r.name}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums">
                  {formatNumberForReport(r.phiPn)} {r.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BeamLimitStatesBlock({ beamLimitStates, overallSafe }: { beamLimitStates: BeamLimitStates; overallSafe: boolean }) {
  const b = beamLimitStates;
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs print:break-inside-avoid print:bg-transparent">
      <h4 className="font-semibold text-slate-900">Demand / capacity by limit state</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse border border-slate-300 print:min-w-0 print:text-[10px]">
          <thead>
            <tr className="bg-slate-100">
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-left">Check</th>
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-right">Demand</th>
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-right">Capacity</th>
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-right">D/C / ratio</th>
              <th scope="col" className="border border-slate-300 px-2 py-1.5 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-50/60">
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
            <tr className="bg-slate-50/60">
              <td className="border border-slate-300 px-2 py-1.5">Deflection</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.deflection.demand)}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.deflection.capacity)}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">{formatNumberForReport(b.deflection.ratio)}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-slate-600">{b.deflection.unit} (demand = δ, capacity = δ_allow)</td>
            </tr>
          </tbody>
        </table>
      </div>
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
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const summaries = useMemo(() => {
    if (!mounted || typeof window === "undefined") return null;
    const stores = readModuleStoresFromLocalStorage();
    return summarizeModuleStores(stores);
  }, [mounted]);

  const tensionS = summaries?.tension ?? null;
  const compressionS = summaries?.compression ?? null;
  const bendingS = summaries?.bending ?? null;

  return (
    <AppShell>
      <Card className="print:border-0 print:shadow-none">
        <CardHeader
          title="Project summary"
          description="Snapshot from inputs saved in this browser. Detailed steps below match the calculators. Use Print to save as PDF."
          right={
            <div className="flex gap-2 print:hidden">
              <Button variant="primary" size="sm" type="button" onClick={() => window.print()}>
                Print / Save PDF
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4 text-sm text-slate-800">
          <PageSectionLayout
            sections={[
              { id: "report-tension", label: "Tension" },
              { id: "report-compression", label: "Compression" },
              { id: "report-beam", label: "Beam" },
            ]}
            navClassName="print:hidden"
          >
          {!mounted ? (
            <p className="text-slate-600">Loading…</p>
          ) : (
            <>
              <details id="report-tension" open className="rounded-2xl border border-slate-200 bg-white print:break-inside-avoid">
                <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                  Tension
                  <span className="mt-1 block text-xs font-semibold text-slate-600">
                    Saved snapshot from the Tension module.
                  </span>
                </summary>
                <div className="border-t border-slate-200 p-5">
                  {tensionS?.ok ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600">Material: {tensionS.materialLabel}</p>
                      <ModuleSummaryStrip output={tensionS.output} />
                      <LimitStatesResultsTable results={tensionS.output.results} />
                      <CalculationStepsTable steps={tensionS.output.steps} title="Calculation steps (AISC D2 / J4.3)" />
                    </div>
                  ) : (
                    <p className="text-slate-600">{tensionS && "error" in tensionS ? tensionS.error : "No data."}</p>
                  )}
                </div>
              </details>

              <details id="report-compression" open className="rounded-2xl border border-slate-200 bg-white print:break-inside-avoid">
                <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                  Compression
                  <span className="mt-1 block text-xs font-semibold text-slate-600">
                    Saved snapshot from the Compression module.
                  </span>
                </summary>
                <div className="border-t border-slate-200 p-5">
                  {compressionS?.ok ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600">
                        Shape: {compressionS.shapeName} · Steel: {compressionS.materialLabel}
                      </p>
                      <ModuleSummaryStrip output={compressionS.output} />
                      <LimitStatesResultsTable results={compressionS.output.results} />
                      <CalculationStepsTable steps={compressionS.output.steps} title="Calculation steps (AISC E3 / local limits)" />
                    </div>
                  ) : (
                    <p className="text-slate-600">
                      {compressionS && "error" in compressionS ? compressionS.error : "No data."}
                    </p>
                  )}
                </div>
              </details>

              <details id="report-beam" open className="rounded-2xl border border-slate-200 bg-white print:break-inside-avoid">
                <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                  Beam (bending / shear / deflection)
                  <span className="mt-1 block text-xs font-semibold text-slate-600">
                    Saved snapshot from the Beam module.
                  </span>
                </summary>
                <div className="border-t border-slate-200 p-5">
                  {bendingS?.ok ? (
                    <div className="space-y-2">
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
                      <CalculationStepsTable
                        steps={bendingS.output.steps}
                        title="Calculation steps (AISC F2 / F6 / G2 / deflection)"
                      />
                    </div>
                  ) : (
                    <p className="text-slate-600">{bendingS && "error" in bendingS ? bendingS.error : "No data."}</p>
                  )}
                </div>
              </details>

            </>
          )}
          </PageSectionLayout>
        </CardBody>
      </Card>
      <PageFooterNav currentHref="/report" />
    </AppShell>
  );
}

