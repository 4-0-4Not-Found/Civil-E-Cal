import type { CalculationStep } from "@/lib/types/calculation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  steps: CalculationStep[];
  governingCase?: string;
  /** Show a small toolbar: key-steps toggle + copy. Default false (back-compat). */
  tools?: boolean;
};

function formatStepValue(s: CalculationStep) {
  const v = s.value;
  const val = typeof v === "number" ? v.toFixed(3) : String(v);
  return `${val}${s.unit ? ` ${s.unit}` : ""}`.trim();
}

function stepToText(s: CalculationStep) {
  const formula = s.formula ? ` | ${s.formula}` : "";
  const note = s.note ? ` | ${s.note}` : "";
  return `${s.label}: ${formatStepValue(s)}${formula}${note}`;
}

function isKeyStep(s: CalculationStep, governingCase?: string) {
  if (s.note) return true;
  if (!governingCase) return false;
  const g = governingCase.toLowerCase();
  const hay = `${s.id} ${s.label} ${s.formula ?? ""}`.toLowerCase();
  return hay.includes(g);
}

export function StepsTable(props: Props) {
  const [keyOnly, setKeyOnly] = useState(false);

  const filtered = useMemo(() => {
    if (!keyOnly) return props.steps;
    const keys = props.steps.filter((s) => isKeyStep(s, props.governingCase));
    // If heuristics find nothing, fall back to full list to avoid "empty steps" confusion.
    return keys.length > 0 ? keys : props.steps;
  }, [keyOnly, props.steps, props.governingCase]);

  const grouped = useMemo(() => {
    // UI-only grouping heuristic: split "Group: Label" into a group header.
    const groups: Array<{ title: string; steps: CalculationStep[] }> = [];
    const map = new Map<string, CalculationStep[]>();
    for (const s of filtered) {
      const idx = s.label.indexOf(":");
      const title = idx > 0 && idx <= 22 ? s.label.slice(0, idx).trim() : "Steps";
      const list = map.get(title) ?? [];
      list.push(s);
      map.set(title, list);
    }
    for (const [title, steps] of map.entries()) groups.push({ title, steps });
    // Keep insertion order stable by iterating filtered once.
    const ordered: Array<{ title: string; steps: CalculationStep[] }> = [];
    const seen = new Set<string>();
    for (const s of filtered) {
      const idx = s.label.indexOf(":");
      const title = idx > 0 && idx <= 22 ? s.label.slice(0, idx).trim() : "Steps";
      if (seen.has(title)) continue;
      seen.add(title);
      ordered.push({ title, steps: map.get(title) ?? [] });
    }
    return ordered;
  }, [filtered]);

  return (
    <div className="space-y-2">
      {props.tools ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setKeyOnly((v) => !v)}
            >
              {keyOnly ? "Show all steps" : "Key steps only"}
            </Button>
            <span className="text-xs font-medium text-slate-600">
              {keyOnly ? "Filtered for governing / noted steps." : "Showing full calculation trail."}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={async () => {
              try {
                const text = filtered.map(stepToText).join("\n");
                await navigator.clipboard.writeText(text);
              } catch {
                /* ignore */
              }
            }}
          >
            Copy steps
          </Button>
        </div>
      ) : null}

      {grouped.length > 1 ? (
        <div className="space-y-3">
          {grouped.map((g) => (
            <div key={g.title} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</div>
              <Table steps={g.steps} />
            </div>
          ))}
        </div>
      ) : (
        <Table steps={filtered} />
      )}
    </div>
  );
}

function Table(props: { steps: CalculationStep[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th scope="col" className="sticky top-0 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Step</th>
            <th scope="col" className="sticky top-0 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Formula</th>
            <th scope="col" className="sticky top-0 bg-slate-50 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">Value</th>
            <th scope="col" className="sticky top-0 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Note</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {props.steps.map((s, idx) => (
            <tr key={s.id} className={idx % 2 === 1 ? "border-t border-slate-100 bg-slate-50/40" : "border-t border-slate-100"}>
              <td className="px-4 py-2.5 text-sm font-medium text-slate-950">{s.label}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.formula ?? "-"}</td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-950">
                {formatStepValue(s)}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{s.note ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

