import type { CalculationStep } from "@/lib/types/calculation";

export function StepsTable(props: { steps: CalculationStep[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-base">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="px-4 py-3 font-semibold">Step</th>
            <th className="px-4 py-3 font-semibold">Formula</th>
            <th className="px-4 py-3 font-semibold">Value</th>
            <th className="px-4 py-3 font-semibold">Note</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {props.steps.map((s) => (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-slate-900">{s.label}</td>
              <td className="px-4 py-3 font-mono text-sm text-slate-700">{s.formula ?? "-"}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                {typeof s.value === "number" ? s.value.toFixed(3) : s.value} {s.unit ?? ""}
              </td>
              <td className="px-4 py-3 text-slate-700">{s.note ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

