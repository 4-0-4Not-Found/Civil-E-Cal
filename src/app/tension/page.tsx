"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { aiscShapes } from "@/lib/aisc/data";
import {
  filterShapesByFamily,
  shapeFamilyOptions,
  type ShapeFamilyKey,
} from "@/lib/aisc/shape-filters";
import { steelMaterialMap, steelMaterials, type SteelMaterialKey } from "@/lib/data/materials";
import { calculateTensionDesign } from "@/lib/calculations/tension";
import { staggeredNetWidthInches } from "@/lib/calculations/net-area";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { StepsTable } from "@/components/StepsTable";
import { ExportJsonButton } from "@/components/ExportJsonButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { STORAGE } from "@/lib/storage/keys";

const toNumber = (v: string) => Number(v) || 0;
/** Client preference: ~3 decimals on final strengths / demands. */
const fmt = (n: number, digits = 3) => (Number.isFinite(n) ? n.toFixed(digits) : "-");

export default function TensionModulePage() {
  const [material, setMaterial] = useState<SteelMaterialKey>("A992");
  const [shapeName, setShapeName] = useState("W24X131");
  const [Ag, setAg] = useState("38.5");
  const [An, setAn] = useState("32");
  const [U, setU] = useState("0.9");
  const [Pu, setPu] = useState("900");
  const [Agv, setAgv] = useState("24");
  const [Anv, setAnv] = useState("20");
  const [Agt, setAgt] = useState("8");
  const [Ant, setAnt] = useState("6.5");
  const [ubs, setUbs] = useState("0.5");

  const [stagW, setStagW] = useState("");
  const [stagDh, setStagDh] = useState("0.875");
  const [stagN, setStagN] = useState("2");
  const [stagS, setStagS] = useState("3");
  const [stagG, setStagG] = useState("3");
  const [stagT, setStagT] = useState("0.75");
  const [shapeFamily, setShapeFamily] = useState<ShapeFamilyKey>("all");
  const [designMethod, setDesignMethod] = useState<"LRFD" | "ASD">("LRFD");
  const [mode, setMode] = useState<"check" | "design">("check");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE.tension);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const p = JSON.parse(raw) as Record<string, string>;
      if (typeof p.material === "string") setMaterial(p.material as SteelMaterialKey);
      if (typeof p.shapeName === "string") setShapeName(p.shapeName);
      if (typeof p.Ag === "string") setAg(p.Ag);
      if (typeof p.An === "string") setAn(p.An);
      if (typeof p.U === "string") setU(p.U);
      if (typeof p.Pu === "string") setPu(p.Pu);
      if (typeof p.Agv === "string") setAgv(p.Agv);
      if (typeof p.Anv === "string") setAnv(p.Anv);
      if (typeof p.Agt === "string") setAgt(p.Agt);
      if (typeof p.Ant === "string") setAnt(p.Ant);
      if (typeof p.ubs === "string") setUbs(p.ubs);
      if (typeof p.stagW === "string") setStagW(p.stagW);
      if (typeof p.stagDh === "string") setStagDh(p.stagDh);
      if (typeof p.stagN === "string") setStagN(p.stagN);
      if (typeof p.stagS === "string") setStagS(p.stagS);
      if (typeof p.stagG === "string") setStagG(p.stagG);
      if (typeof p.stagT === "string") setStagT(p.stagT);
      if (typeof p.shapeFamily === "string") setShapeFamily(p.shapeFamily as ShapeFamilyKey);
      if (p.designMethod === "LRFD" || p.designMethod === "ASD") setDesignMethod(p.designMethod);
      if (p.mode === "check" || p.mode === "design") setMode(p.mode);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload = {
      material,
      shapeName,
      Ag,
      An,
      U,
      Pu,
      Agv,
      Anv,
      Agt,
      Ant,
      ubs,
      stagW,
      stagDh,
      stagN,
      stagS,
      stagG,
      stagT,
      shapeFamily,
      designMethod,
      mode,
    };
    try {
      localStorage.setItem(STORAGE.tension, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [
    hydrated,
    material,
    shapeName,
    Ag,
    An,
    U,
    Pu,
    Agv,
    Anv,
    Agt,
    Ant,
    ubs,
    stagW,
    stagDh,
    stagN,
    stagS,
    stagG,
    stagT,
    shapeFamily,
    designMethod,
    mode,
  ]);

  const selectedMaterial = steelMaterialMap[material];
  const shapeChoices = useMemo(
    () => filterShapesByFamily(aiscShapes, shapeFamily, "tension"),
    [shapeFamily],
  );
  const shape = aiscShapes.find((s) => s.shape === shapeName);

  const handleShapeFamilyChange = (v: ShapeFamilyKey) => {
    setShapeFamily(v);
    const list = filterShapesByFamily(aiscShapes, v, "tension");
    if (list.length === 0) return;
    if (!list.some((s) => s.shape === shapeName)) {
      const first = list[0];
      setShapeName(first.shape);
      setAg(String(first.A));
    }
  };

  const result = useMemo(() => {
    return calculateTensionDesign({
      designMethod,
      Fy: selectedMaterial.Fy,
      Fu: selectedMaterial.Fu,
      Ag: toNumber(Ag),
      An: toNumber(An),
      U: toNumber(U),
      demandPu: toNumber(Pu),
      Agv: toNumber(Agv),
      Anv: toNumber(Anv),
      Agt: toNumber(Agt),
      Ant: toNumber(Ant),
      ubs: toNumber(ubs) || 0.5,
    });
  }, [selectedMaterial, designMethod, Ag, An, U, Pu, Agv, Anv, Agt, Ant, ubs]);

  /** Lightest section in family that passes all limit states with gross = net (optimistic — refine in Check). */
  const designSuggestion = useMemo(() => {
    if (mode !== "design") return null;
    const demand = toNumber(Pu);
    const list = [...shapeChoices].sort((a, b) => a.W - b.W);
    for (const s of list) {
      const r = calculateTensionDesign({
        designMethod,
        Fy: selectedMaterial.Fy,
        Fu: selectedMaterial.Fu,
        Ag: s.A,
        An: s.A,
        U: 1,
        demandPu: demand,
        Agv: toNumber(Agv),
        Anv: toNumber(Anv),
        Agt: toNumber(Agt),
        Ant: toNumber(Ant),
        ubs: toNumber(ubs) || 0.5,
      });
      if (r.isSafe) return s;
    }
    return null;
  }, [mode, shapeChoices, Pu, selectedMaterial, designMethod, Agv, Anv, Agt, Ant, ubs]);

  /** Design mode: compare first 16 lightest shapes (same assumptions as design suggestion). */
  const designComparisonRows = useMemo(() => {
    if (mode !== "design" || shapeChoices.length === 0) return [];
    const demand = toNumber(Pu);
    return [...shapeChoices]
      .sort((a, b) => a.W - b.W)
      .slice(0, 16)
      .map((s) => {
        const r = calculateTensionDesign({
          designMethod,
          Fy: selectedMaterial.Fy,
          Fu: selectedMaterial.Fu,
          Ag: s.A,
          An: s.A,
          U: 1,
          demandPu: demand,
          Agv: toNumber(Agv),
          Anv: toNumber(Anv),
          Agt: toNumber(Agt),
          Ant: toNumber(Ant),
          ubs: toNumber(ubs) || 0.5,
        });
        return {
          shape: s.shape,
          W: s.W,
          strength: r.controllingStrength,
          safe: r.isSafe,
          gov: r.governingCase,
        };
      });
  }, [mode, shapeChoices, Pu, selectedMaterial, designMethod, Agv, Anv, Agt, Ant, ubs]);

  const csvRows = useMemo(() => {
    const rows: string[][] = [
      ["Field", "Value"],
      ["Steel", material],
      ["Shape family", shapeFamily],
      ["Shape", shapeName],
      ["Pu (kips)", Pu],
      ["Design method", designMethod],
      ["Mode", mode],
      [`${designMethod === "LRFD" ? "φPn / Pa" : "Pa"} governing (kips)`, fmt(result.controllingStrength)],
      ["Governing case", result.governingCase],
    ];
    return rows;
  }, [material, shapeFamily, shapeName, Pu, result, designMethod, mode]);

  const staggerHelp = useMemo(() => {
    const W = toNumber(stagW);
    const dh = toNumber(stagDh);
    const n = Math.floor(toNumber(stagN));
    const s = toNumber(stagS);
    const g = toNumber(stagG);
    const t = toNumber(stagT);
    if (!stagW.trim() || W <= 0 || dh <= 0 || n < 0 || t <= 0) return null;
    const nw = staggeredNetWidthInches({
      grossWidthIn: W,
      holeDiameterIn: dh,
      nHoles: n,
      staggers: s > 0 && g > 0 ? [{ sIn: s, gIn: g }] : undefined,
    });
    return { netWidth: nw, an: nw * t };
  }, [stagW, stagDh, stagN, stagS, stagG, stagT]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardHeader
          title="Tension Analysis & Design"
          description="Yielding, rupture, block shear (J4.3), optional staggered net width. Check or design mode. Inputs save in this browser."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <ExportCsvButton filename="tension-export.csv" rows={csvRows} />
              <ExportJsonButton
                data={{ result, inputs: { material, shapeName, designMethod, mode, Ag, An, U, Pu, Agv, Anv, Agt, Ant, ubs } }}
              />
              <Link href="/info" className="text-sm font-medium text-slate-600 hover:underline">
                Info
              </Link>
              <Link href="/" className="text-sm font-medium text-blue-700 hover:underline">
                Home
              </Link>
            </div>
          }
        />
        <CardBody className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-8 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Steel Type" hint="Auto-fills Fy and Fu (ksi).">
                <SelectInput value={material} onChange={(v) => setMaterial(v as SteelMaterialKey)}>
                  {steelMaterials.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} (Fy={m.Fy}, Fu={m.Fu})
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Shape family" hint="Filter AISC v16 database (W, S, C, L, HSS, …).">
                <SelectInput value={shapeFamily} onChange={(v) => handleShapeFamilyChange(v as ShapeFamilyKey)}>
                  {shapeFamilyOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="AISC Shape" hint="Select a section; Ag will auto-update.">
                <SelectInput
                  value={shapeName}
                  onChange={(v) => {
                    const selected = aiscShapes.find((s) => s.shape === v);
                    setShapeName(v);
                    if (selected) setAg(String(selected.A));
                  }}
                >
                  {shapeChoices.map((s) => (
                    <option key={s.shape} value={s.shape}>
                      {s.shape}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            <Card className="shadow-none">
              <CardBody className="grid gap-4 md:grid-cols-2">
                <Field label="Mode" hint="Check a section, or get a lightest-weight suggestion in the chosen family.">
                  <SelectInput value={mode} onChange={(v) => setMode(v as "check" | "design")}>
                    <option value="check">Check / analyze</option>
                    <option value="design">Design (lightest shape)</option>
                  </SelectInput>
                </Field>
                <Field label="Design method" hint="LRFD (default) or ASD.">
                  <SelectInput value={designMethod} onChange={(v) => setDesignMethod(v as "LRFD" | "ASD")}>
                    <option value="LRFD">LRFD</option>
                    <option value="ASD">ASD</option>
                  </SelectInput>
                </Field>
                <Field label="Required Pu / Pa" hint="Required axial (kips) — LRFD Pu or ASD Pa depending on method.">
                  <TextInput value={Pu} onChange={setPu} placeholder="e.g. 900" />
                </Field>
                <Field label="Shear lag factor U" hint="dimensionless">
                  <TextInput value={U} onChange={setU} placeholder="e.g. 0.90" />
                </Field>
                <Field label="Ag" hint="gross area (in²)">
                  <TextInput value={Ag} onChange={setAg} />
                </Field>
                <Field label="An" hint="net area (in²)">
                  <TextInput value={An} onChange={setAn} />
                </Field>
              </CardBody>
            </Card>

            {designSuggestion ? (
              <Card className="border-emerald-200 bg-emerald-50/80">
                <CardBody>
                  <p className="text-sm font-semibold text-emerald-950">Suggested section (lightest in family that passes)</p>
                  <p className="mt-1 text-xl font-bold text-emerald-950">{designSuggestion.shape}</p>
                  <p className="mt-1 text-sm text-emerald-900">
                    {designSuggestion.W} lb/ft — uses gross = net areas and your block-shear inputs; switch to Check to enter real A<sub>n</sub> and holes.
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {mode === "design" && designComparisonRows.length > 0 ? (
              <Card className="shadow-none border border-slate-200">
                <CardBody className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Section comparison (lightest first, gross = net)</p>
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
                        {designComparisonRows.map((row) => (
                          <tr key={row.shape} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-medium">{row.shape}</td>
                            <td className="px-3 py-2">{fmt(row.W, 1)}</td>
                            <td className="px-3 py-2">{row.gov}</td>
                            <td className="px-3 py-2">{fmt(row.strength)} kips</td>
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

            <Card className="shadow-none border border-dashed border-slate-300">
              <CardBody className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Staggered holes — net width (AISC D3)</p>
                <p className="text-sm text-slate-600">
                  Net width = W − n d_h + Σ(s² / 4g) for stagger(s). Then A_n = t × net width for a uniform plate strip. For W-shapes, compute path areas separately or use this as a helper and enter A_n above.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Gross width W" hint="in — along the failure path">
                    <TextInput value={stagW} onChange={setStagW} placeholder="e.g. 8" />
                  </Field>
                  <Field label="Hole dia d_h" hint="in">
                    <TextInput value={stagDh} onChange={setStagDh} />
                  </Field>
                  <Field label="Number of holes n" hint="on that path">
                    <TextInput value={stagN} onChange={setStagN} />
                  </Field>
                  <Field label="Thickness t" hint="in — for A_n = t × net width">
                    <TextInput value={stagT} onChange={setStagT} />
                  </Field>
                  <Field label="Pitch s" hint="in — optional stagger (leave 0 for collinear holes)">
                    <TextInput value={stagS} onChange={setStagS} />
                  </Field>
                  <Field label="Gage g" hint="in — between gage lines for one stagger">
                    <TextInput value={stagG} onChange={setStagG} />
                  </Field>
                </div>
                {staggerHelp ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                    <span>
                      Net width = {staggerHelp.netWidth.toFixed(4)} in → A_n = {staggerHelp.an.toFixed(4)} in²
                    </span>
                    <button
                      type="button"
                      className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
                      onClick={() => setAn(String(Math.round(staggerHelp.an * 10000) / 10000))}
                    >
                      Copy A_n to net area
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Enter W, d_h, t, and n to compute.</p>
                )}
              </CardBody>
            </Card>

            <Card className="shadow-none">
              <CardBody className="grid gap-4 md:grid-cols-2">
                <Field label="Agv" hint="gross shear area (in²)">
                  <TextInput value={Agv} onChange={setAgv} />
                </Field>
                <Field label="Anv" hint="net shear area (in²)">
                  <TextInput value={Anv} onChange={setAnv} />
                </Field>
                <Field label="Agt" hint="Gross tension area (in²), for full block-shear path when needed.">
                  <TextInput value={Agt} onChange={setAgt} />
                </Field>
                <Field label="Ant" hint="net tension area (in²)">
                  <TextInput value={Ant} onChange={setAnt} />
                </Field>
                <Field
                  label="Ubs (block shear)"
                  hint="AISC J4.3 U_bs: 0.5 non-uniform tension on A_nt (typical); 1.0 uniform"
                >
                  <TextInput value={ubs} onChange={setUbs} placeholder="0.5" />
                </Field>
              </CardBody>
            </Card>

            <details className="rounded-2xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Show step-by-step calculations</summary>
              <div className="mt-4">
                <StepsTable steps={result.steps} />
              </div>
            </details>
          </div>

          <aside className="md:col-span-4">
            <div className="sticky top-6 space-y-4">
              <Card className="border-slate-200">
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                      <p className="mt-1 text-2xl font-extrabold text-slate-900">
                        {result.isSafe ? <Badge tone="good">SAFE</Badge> : <Badge tone="bad">NOT SAFE</Badge>}
                      </p>
                    </div>
                    <Badge tone="info">{selectedMaterial.key}</Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    <Row label="Governing case" value={result.governingCase} />
                    <Row
                      label={designMethod === "LRFD" ? "Design strength (φPn)" : "Allowable (Pa)"}
                      value={`${fmt(result.controllingStrength)} kips`}
                    />
                    <Row label={designMethod === "LRFD" ? "Demand Pu" : "Demand Pa"} value={`${fmt(result.demand)} kips`} />
                  </div>
                </CardBody>
              </Card>

              <Card className="border-slate-200">
                <CardBody>
                  <p className="text-xs font-semibold uppercase text-slate-500">Failure modes</p>
                  <div className="mt-3 space-y-2">
                    {Object.entries(result.results).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-700">{value.name}</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{fmt(value.phiPn)} {value.unit}</div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {shape ? (
                <Card className="border-slate-200">
                  <CardBody>
                    <p className="text-xs font-semibold uppercase text-slate-500">Section snapshot</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-800">
                      <Row label="Shape" value={shape.shape} />
                      <Row label="W" value={`${fmt(shape.W)} plf`} />
                      <Row label="d" value={`${fmt(shape.d)} in`} />
                      <Row label="bf" value={`${fmt(shape.bf)} in`} />
                      <Row label="tf" value={`${fmt(shape.tf)} in`} />
                      <Row label="tw" value={`${fmt(shape.tw)} in`} />
                      <Row label="rx" value={`${fmt(shape.rx)} in`} />
                      <Row label="ry" value={`${fmt(shape.ry)} in`} />
                    </div>
                  </CardBody>
                </Card>
              ) : null}
            </div>
          </aside>
        </CardBody>
      </Card>
    </main>
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
