"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { aiscShapes } from "@/lib/aisc/data";
import {
  filterShapesByFamily,
  shapeFamilyOptions,
  type ShapeFamilyKey,
} from "@/lib/aisc/shape-filters";
import { calculateCompressionDesign } from "@/lib/calculations/compression";
import { steelMaterialMap, steelMaterials, type SteelMaterialKey } from "@/lib/data/materials";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { StepsTable } from "@/components/StepsTable";
import { STORAGE } from "@/lib/storage/keys";
import { AppShell } from "@/components/layout/AppShell";
import { ResultHero } from "@/components/results/ResultHero";
import { PageFooterNav } from "@/components/navigation/PageFooterNav";
import { TextInputWithUnit } from "@/components/ui/InputGroup";
import { Button } from "@/components/ui/Button";
import { CalculatorActionRail } from "@/components/actions/CalculatorActionRail";
import { PageSectionNav } from "@/components/navigation/PageSectionNav";

export default function CompressionPage() {
  const [material, setMaterial] = useState<SteelMaterialKey>("A992");
  const [shapeFamily, setShapeFamily] = useState<ShapeFamilyKey>("W");
  const [shapeName, setShapeName] = useState("W24X131");
  const [k, setK] = useState("1.0");
  /** Multiplier on K for lacing / built-up notes (1.0 = as entered). */
  const [builtUpFactor, setBuiltUpFactor] = useState("1.0");
  const [L, setL] = useState("240");
  const [Pu, setPu] = useState("700");
  const [designMethod, setDesignMethod] = useState<"LRFD" | "ASD">("LRFD");
  const [mode, setMode] = useState<"check" | "design">("check");
  const [designMinAg, setDesignMinAg] = useState("");
  const [designMinR, setDesignMinR] = useState("");
  const [useDesignFilters, setUseDesignFilters] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE.compression);
      if (!raw) {
        queueMicrotask(() => setHydrated(true));
        return;
      }
      const p = JSON.parse(raw) as Record<string, string>;
      queueMicrotask(() => {
        if (typeof p.material === "string") setMaterial(p.material as SteelMaterialKey);
        if (typeof p.shapeFamily === "string") setShapeFamily(p.shapeFamily as ShapeFamilyKey);
        if (typeof p.shapeName === "string") setShapeName(p.shapeName);
        if (typeof p.k === "string") setK(p.k);
        if (typeof p.builtUpFactor === "string") setBuiltUpFactor(p.builtUpFactor);
        if (typeof p.L === "string") setL(p.L);
        if (typeof p.Pu === "string") setPu(p.Pu);
        if (p.designMethod === "LRFD" || p.designMethod === "ASD") setDesignMethod(p.designMethod);
        if (p.mode === "check" || p.mode === "design") setMode(p.mode);
        if (typeof p.designMinAg === "string") setDesignMinAg(p.designMinAg);
        if (typeof p.designMinR === "string") setDesignMinR(p.designMinR);
        if (p.useDesignFilters === "yes" || p.useDesignFilters === "no") setUseDesignFilters(p.useDesignFilters === "yes");
      });
    } catch {
      /* ignore */
    }
    queueMicrotask(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      setSaving(true);
      localStorage.setItem(
        STORAGE.compression,
        JSON.stringify({
          material,
          shapeFamily,
          shapeName,
          k,
          builtUpFactor,
          L,
          Pu,
          designMethod,
          mode,
          designMinAg,
          designMinR,
          useDesignFilters: useDesignFilters ? "yes" : "no",
        }),
      );
      const ts = Date.now();
      localStorage.setItem("ssc:ts:compression", String(ts));
      setSavedAt(ts);
    } catch {
      /* ignore */
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaving(false), 450);
  }, [hydrated, material, shapeFamily, shapeName, k, builtUpFactor, L, Pu, designMethod, mode, designMinAg, designMinR, useDesignFilters]);

  const shapeChoices = useMemo(
    () => filterShapesByFamily(aiscShapes, shapeFamily, "compression"),
    [shapeFamily],
  );
  const shape = aiscShapes.find((s) => s.shape === shapeName);
  const mat = steelMaterialMap[material];

  const handleShapeFamilyChange = (v: ShapeFamilyKey) => {
    setShapeFamily(v);
    const list = filterShapesByFamily(aiscShapes, v, "compression");
    if (list.length === 0) return;
    if (!list.some((s) => s.shape === shapeName)) {
      setShapeName(list[0].shape);
    }
  };

  const kEffective = Number(k) * (Number.isFinite(Number(builtUpFactor)) && Number(builtUpFactor) > 0 ? Number(builtUpFactor) : 1);
  const minAgFilter = Number(designMinAg) || 0;
  const minRFilter = Number(designMinR) || 0;
  const designPool = useMemo(() => {
    if (!useDesignFilters) return shapeChoices;
    return shapeChoices.filter((s) => s.A >= minAgFilter && Math.min(s.rx, s.ry) >= minRFilter);
  }, [shapeChoices, useDesignFilters, minAgFilter, minRFilter]);

  const out = useMemo(
    () =>
      calculateCompressionDesign({
        designMethod,
        Fy: mat.Fy,
        E: 29000,
        k: kEffective,
        L: Number(L),
        rx: shape?.rx ?? 1,
        ry: shape?.ry ?? 1,
        Ag: shape?.A ?? 0,
        lambdaFlange: shape?.bf_2tf ?? 0,
        lambdaWeb: shape?.h_tw ?? 0,
        demandPu: Number(Pu),
      }),
    [mat, designMethod, kEffective, L, Pu, shape],
  );

  const missingSlenderness = shape ? shape.bf_2tf <= 0 && shape.h_tw <= 0 : false;

  const designRows = useMemo(() => {
    if (mode !== "design") return [];
    return [...designPool]
      .sort((a, b) => a.W - b.W)
      .slice(0, 24)
      .map((s) => {
        const r = calculateCompressionDesign({
          designMethod,
          Fy: mat.Fy,
          E: 29000,
          k: kEffective,
          L: Number(L),
          rx: s.rx,
          ry: s.ry,
          Ag: s.A,
          lambdaFlange: s.bf_2tf,
          lambdaWeb: s.h_tw,
          demandPu: Number(Pu),
        });
        return { shape: s.shape, W: s.W, strength: r.controllingStrength, safe: r.isSafe, gov: r.governingCase };
      });
  }, [mode, designPool, designMethod, mat.Fy, kEffective, L, Pu]);
  const designSuggestion = useMemo(() => designRows.find((r) => r.safe) ?? null, [designRows]);
  const safeDesignRows = useMemo(() => designRows.filter((r) => r.safe), [designRows]);
  const unsafeDesignRows = useMemo(() => designRows.filter((r) => !r.safe), [designRows]);

  const csvRows = useMemo(() => {
    return [
      ["Field", "Value"],
      ["Steel", material],
      ["Shape family", shapeFamily],
      ["Shape", shapeName],
      ["Design method", designMethod],
      ["Mode", mode],
      ["Pu / Pa (kips)", Pu],
      ["Strength (kips)", out.controllingStrength.toFixed(3)],
    ];
  }, [material, shapeFamily, shapeName, Pu, designMethod, mode, out.controllingStrength]);

  function scrollTo(id: string) {
    try {
      const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    } catch {
      /* ignore */
    }
  }

  const resetInputs = () => {
    try {
      localStorage.removeItem(STORAGE.compression);
      localStorage.removeItem("ssc:ts:compression");
    } catch {
      /* ignore */
    }
    setMaterial("A992");
    setShapeFamily("W");
    setShapeName("W24X131");
    setK("1.0");
    setBuiltUpFactor("1.0");
    setL("240");
    setPu("700");
    setDesignMethod("LRFD");
    setMode("check");
    setDesignMinAg("");
    setDesignMinR("");
    setUseDesignFilters(false);
  };

  const invalid = (v: string, min = 0) => {
    const n = Number(v);
    return !Number.isFinite(n) || n < min;
  };

  return (
    <AppShell>
      <Card>
        <CardHeader
          title="Compression Analysis & Design"
          description="Column buckling (E3), LRFD or ASD. Slender-element limits are approximate when shape data is available. Inputs save in this browser."
        />
        <CardBody className="grid gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-12 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Quick workflow</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Choose steel, shape family, shape, and check/design mode in General.</li>
              <li>Enter demand and member data in KL/r section (L, K, and optional built-up factor).</li>
              <li>Review governing case, result panel, and Steps before exporting.</li>
            </ol>
          </div>
          <div className="md:col-span-12 md:hidden">
            <PageSectionNav
              sections={[
                { id: "compression-general", label: "General" },
                { id: "compression-member", label: "Member" },
                { id: "compression-steps", label: "Steps" },
              ]}
            />
          </div>
          <div className="md:col-span-8 grid gap-4">
            {missingSlenderness ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-semibold">Slenderness not in database row</p>
                <p className="mt-1">
                  Capacity uses <strong>member flexural buckling (E3)</strong> only. For HSS, verify wall slenderness and any
                  applicable AISC limits outside this tool.
                </p>
              </div>
            ) : null}

            <details open className="rounded-2xl border border-slate-200 bg-white" id="compression-general">
              <summary className="min-h-11 cursor-pointer px-4 py-3.5 text-sm font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 sm:px-5 sm:py-4">
                1 · General
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Blue fields are user input. Non-blue values below are auto-computed from your inputs.
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Units: ksi, in
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Steel Type" hint="Fy (ksi) comes from selection.">
                    <SelectInput value={material} onChange={(v) => setMaterial(v as SteelMaterialKey)}>
                      {steelMaterials.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Shape family" hint="Requires A_g, r_x, r_y > 0 in database.">
                    <SelectInput value={shapeFamily} onChange={(v) => handleShapeFamilyChange(v as ShapeFamilyKey)}>
                      {shapeFamilyOptions.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="AISC Shape" hint="Filtered v16 shapes.">
                    <SelectInput value={shapeName} onChange={setShapeName}>
                      {shapeChoices.map((s) => (
                        <option key={s.shape} value={s.shape}>
                          {s.shape}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Mode" hint="Check selected shape or search lightest safe shape.">
                    <SelectInput value={mode} onChange={(v) => setMode(v as "check" | "design")}>
                      <option value="check">Check / analyze</option>
                      <option value="design">Design (lightest shape)</option>
                    </SelectInput>
                  </Field>
                  {mode === "design" ? (
                    <Field label="Apply design filters?" hint="Optional min Ag and min r requirements.">
                      <SelectInput value={useDesignFilters ? "yes" : "no"} onChange={(v) => setUseDesignFilters(v === "yes")}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </SelectInput>
                    </Field>
                  ) : null}
                  {mode === "design" && useDesignFilters ? (
                    <>
                      <Field label="Min Ag" hint="in²">
                        <TextInputWithUnit value={designMinAg} onChange={setDesignMinAg} unit="in²" inputMode="decimal" />
                      </Field>
                      <Field label="Min r" hint="in (uses min(rx, ry))">
                        <TextInputWithUnit value={designMinR} onChange={setDesignMinR} unit="in" inputMode="decimal" />
                      </Field>
                    </>
                  ) : null}
                </div>

                {shape ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">Section context</p>
                      <Badge tone="info">{shape.shape}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-4">
                      <span className="tabular-nums">W: {shape.W.toFixed(1)} plf</span>
                      <span className="tabular-nums">Ag: {shape.A.toFixed(2)} in²</span>
                      <span className="tabular-nums">rx: {shape.rx.toFixed(2)} in</span>
                      <span className="tabular-nums">ry: {shape.ry.toFixed(2)} in</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </details>

            <details open className="rounded-2xl border border-slate-200 bg-white" id="compression-member">
              <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                2 · Member (KL/r)
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Enter demand and member inputs in blue; capacity and governing checks update automatically.
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Units: kips, in
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" type="button" onClick={() => setK("1.0")}>
                    K = 1.0
                  </Button>
                  <Button variant="secondary" size="sm" type="button" onClick={() => setBuiltUpFactor("1.0")}>
                    Built-up factor = 1.0
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Design method" hint="LRFD default; ASD uses P_n/1.67 for member buckling.">
                    <SelectInput value={designMethod} onChange={(v) => setDesignMethod(v as "LRFD" | "ASD")}>
                      <option value="LRFD">LRFD</option>
                      <option value="ASD">ASD</option>
                    </SelectInput>
                  </Field>
                  <Field
                    label="Demand Pu / Pa"
                    hint="Required compressive strength (kips)."
                    error={invalid(Pu, 0) ? "Enter a number ≥ 0." : undefined}
                  >
                    <TextInputWithUnit value={Pu} onChange={setPu} unit="kips" inputMode="decimal" />
                  </Field>
                  <Field label="Length L" hint="in" error={invalid(L, 0) ? "Enter a number ≥ 0." : undefined}>
                    <TextInputWithUnit value={L} onChange={setL} unit="in" inputMode="decimal" />
                  </Field>
                  <Field label="K-factor" hint="End condition factor from alignment chart.">
                    <SelectInput value={k} onChange={setK}>
                      {["0.5", "0.65", "0.8", "1.0", "2.0"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field
                    label="Factor on K (built-up / notes)"
                    hint="Multiply K when your course or lacing notes require it (1.0 = unchanged)."
                    className="md:col-span-2"
                  >
                    <TextInput value={builtUpFactor} onChange={setBuiltUpFactor} placeholder="1.0" />
                  </Field>
                  <p className="md:col-span-2 text-xs font-semibold text-slate-600">
                    Effective K = {k} × {builtUpFactor} = <span className="tabular-nums text-slate-900">{kEffective.toFixed(4)}</span>
                  </p>
                </div>
              </div>
            </details>

            {mode === "design" && designSuggestion ? (
              <Card className="border-[color:var(--brand)]/20 bg-[color:var(--brand)]/5">
                <CardBody>
                  <p className="text-sm font-semibold text-slate-900">Suggested section (lightest safe)</p>
                  <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">{designSuggestion.shape}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {designSuggestion.W.toFixed(1)} lb/ft · Strength {designSuggestion.strength.toFixed(3)} kips
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {mode === "design" && designRows.length > 0 ? (
              <Card className="border border-slate-200 shadow-none">
                <CardBody className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Section comparison (lightest first){useDesignFilters ? " · filters applied" : ""}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    SAFE: {safeDesignRows.length} · NOT SAFE: {unsafeDesignRows.length}
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[28rem] text-left text-sm text-slate-800">
                      <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Shape</th>
                          <th className="px-3 py-2">W (plf)</th>
                          <th className="px-3 py-2">Governing</th>
                          <th className="px-3 py-2">Strength</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {designRows.map((row) => (
                          <tr key={row.shape} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-medium">{row.shape}</td>
                            <td className="px-3 py-2">{row.W.toFixed(1)}</td>
                            <td className="px-3 py-2">{row.gov}</td>
                            <td className="px-3 py-2">{row.strength.toFixed(3)} kips</td>
                            <td className="px-3 py-2">
                              {row.safe ? (
                                <span className="font-semibold text-emerald-800">SAFE</span>
                              ) : (
                                <span className="font-semibold text-rose-800">NOT SAFE</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            <details id="compression-steps" className="rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                Steps (show math)
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Governing: <span className="text-slate-900">{out.governingCase}</span> · Capacity{" "}
                  <span className="tabular-nums text-slate-900">{out.controllingStrength.toFixed(3)} kips</span>
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <StepsTable steps={out.steps} governingCase={String(out.governingCase)} tools />
              </div>
            </details>
          </div>

          <aside className="md:col-span-4">
            <div className="sticky top-6 md:top-[calc(var(--app-header-h,104px)+16px)] space-y-4">
              <div className="hidden md:block">
                <PageSectionNav
                  sections={[
                    { id: "compression-general", label: "General" },
                    { id: "compression-member", label: "Member" },
                    { id: "compression-steps", label: "Steps" },
                  ]}
                />
              </div>
              <CalculatorActionRail
                hideMobileBar
                title="Actions"
                subtitle={`${shapeName} · ${designMethod}`}
                savedKey="ssc:ts:compression"
                saving={saving}
                savedAt={savedAt}
                compare={{
                  storageKey: "ssc:compare:compression",
                  getCurrent: () => ({
                    title: `Compression — ${shapeName}`,
                    lines: [
                      `Method: ${designMethod} · Material: ${mat.key}`,
                      `Pu/Pa = ${Pu} kips · L = ${L} in · K = ${k} · built-up = ${builtUpFactor}`,
                      `Governing: ${out.governingCase}`,
                      `Capacity: ${out.controllingStrength.toFixed(3)} kips`,
                      `Demand: ${out.demand.toFixed(3)} kips`,
                      `Utilization: ${out.controllingStrength > 0 ? ((out.demand / out.controllingStrength) * 100).toFixed(1) : "-"}%`,
                    ],
                  }),
                }}
                copyText={() =>
                  [
                    "Compression",
                    `Method: ${designMethod}`,
                    `Material: ${mat.key}`,
                    `Shape: ${shapeName}`,
                    `Governing: ${out.governingCase}`,
                    `Capacity: ${out.controllingStrength.toFixed(3)} kips`,
                    `Demand: ${out.demand.toFixed(3)} kips`,
                  ].join("\n")
                }
                onGoResults={() => scrollTo("results")}
                onGoSteps={() => scrollTo("compression-steps")}
                csv={{ filename: "compression-export.csv", rows: csvRows }}
                json={{ data: { result: out, inputs: { material, shapeName, designMethod, k, L, Pu } } }}
                onReset={resetInputs}
              />
              <div id="results">
              <ResultHero
                status={out.isSafe ? "safe" : "unsafe"}
                governing={out.governingCase}
                capacityLabel={designMethod === "LRFD" ? "Design strength (φPn)" : "Allowable (Pn/Ω)"}
                capacity={`${out.controllingStrength.toFixed(3)} kips`}
                demandLabel={designMethod === "LRFD" ? "Demand Pu" : "Demand Pa"}
                demand={`${out.demand.toFixed(3)} kips`}
                utilization={out.controllingStrength > 0 ? out.demand / out.controllingStrength : undefined}
                metaRight={<Badge tone="info">{mat.key}</Badge>}
              />
              </div>

              {shape ? (
                <Card>
                  <CardBody>
                    <p className="text-xs font-semibold uppercase text-slate-500">Section snapshot</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-800">
                      <Row label="Shape" value={shape.shape} />
                      <Row label="W" value={`${shape.W.toFixed(1)} plf`} />
                      <Row label="A_g" value={`${shape.A.toFixed(2)} in²`} />
                      <Row
                        label="b_f / 2t_f"
                        value={shape.bf_2tf > 0 ? shape.bf_2tf.toFixed(2) : "—"}
                      />
                      <Row label="h / t_w" value={shape.h_tw > 0 ? shape.h_tw.toFixed(2) : "—"} />
                      <Row label="rx" value={`${shape.rx.toFixed(2)} in`} />
                      <Row label="ry" value={`${shape.ry.toFixed(2)} in`} />
                    </div>
                  </CardBody>
                </Card>
              ) : null}
            </div>
          </aside>
        </CardBody>
      </Card>
      <div className="mt-8 md:mt-10">
      <div id="actions">
      <CalculatorActionRail
        mobileOnly
        subtitle="Compression actions"
        savedKey="ssc:ts:compression"
        saving={saving}
        savedAt={savedAt}
        compare={{
          storageKey: "ssc:compare:compression",
          getCurrent: () => ({
            title: `Compression — ${shapeName}`,
            lines: [
              `Method: ${designMethod} · Material: ${mat.key}`,
              `Pu/Pa = ${Pu} kips · L = ${L} in · K = ${k} · built-up = ${builtUpFactor}`,
              `Governing: ${out.governingCase}`,
              `Capacity: ${out.controllingStrength.toFixed(3)} kips`,
              `Demand: ${out.demand.toFixed(3)} kips`,
              `Utilization: ${out.controllingStrength > 0 ? ((out.demand / out.controllingStrength) * 100).toFixed(1) : "-"}%`,
            ],
          }),
        }}
        copyText={() =>
          [
            "Compression",
            `Method: ${designMethod}`,
            `Material: ${mat.key}`,
            `Shape: ${shapeName}`,
            `Governing: ${out.governingCase}`,
            `Capacity: ${out.controllingStrength.toFixed(3)} kips`,
            `Demand: ${out.demand.toFixed(3)} kips`,
          ].join("\n")
        }
        onGoResults={() => scrollTo("results")}
        onGoSteps={() => scrollTo("compression-steps")}
        csv={{ filename: "compression-export.csv", rows: csvRows }}
        json={{ data: { result: out, inputs: { material, shapeName, designMethod, k, L, Pu } } }}
        onReset={resetInputs}
      />
      </div>
      </div>
      <PageFooterNav currentHref="/compression" />
    </AppShell>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-600">{props.label}</span>
      <span className="font-semibold text-slate-900">{props.value}</span>
    </div>
  );
}
