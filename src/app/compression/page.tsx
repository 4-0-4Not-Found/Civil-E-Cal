"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { ExportJsonButton } from "@/components/ExportJsonButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { STORAGE } from "@/lib/storage/keys";

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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE.compression);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const p = JSON.parse(raw) as Record<string, string>;
      if (typeof p.material === "string") setMaterial(p.material as SteelMaterialKey);
      if (typeof p.shapeFamily === "string") setShapeFamily(p.shapeFamily as ShapeFamilyKey);
      if (typeof p.shapeName === "string") setShapeName(p.shapeName);
      if (typeof p.k === "string") setK(p.k);
      if (typeof p.builtUpFactor === "string") setBuiltUpFactor(p.builtUpFactor);
      if (typeof p.L === "string") setL(p.L);
      if (typeof p.Pu === "string") setPu(p.Pu);
      if (p.designMethod === "LRFD" || p.designMethod === "ASD") setDesignMethod(p.designMethod);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE.compression,
        JSON.stringify({ material, shapeFamily, shapeName, k, builtUpFactor, L, Pu, designMethod }),
      );
    } catch {
      /* ignore */
    }
  }, [hydrated, material, shapeFamily, shapeName, k, builtUpFactor, L, Pu, designMethod]);

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

  const csvRows = useMemo(() => {
    return [
      ["Field", "Value"],
      ["Steel", material],
      ["Shape family", shapeFamily],
      ["Shape", shapeName],
      ["Design method", designMethod],
      ["Pu / Pa (kips)", Pu],
      ["Strength (kips)", out.controllingStrength.toFixed(3)],
    ];
  }, [material, shapeFamily, shapeName, Pu, designMethod, out.controllingStrength]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardHeader
          title="Compression Analysis & Design"
          description="Column buckling (E3), LRFD or ASD. Slender-element limits are approximate when shape data is available. Inputs save in this browser."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <ExportCsvButton filename="compression-export.csv" rows={csvRows} />
              <ExportJsonButton data={{ result: out, inputs: { material, shapeName, designMethod, k, L, Pu } }} />
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
              <Field label="Steel Type" hint="Fy (ksi) comes from selection.">
                <SelectInput value={material} onChange={(v) => setMaterial(v as SteelMaterialKey)}>
                  {steelMaterials.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Shape family" hint="Requires A_g, r_x, r_y &gt; 0 in database.">
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
            </div>

            {missingSlenderness ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-semibold">Slenderness not in database row</p>
                <p className="mt-1">
                  Capacity uses <strong>member flexural buckling (E3)</strong> only. For HSS, verify wall slenderness and any
                  applicable AISC limits outside this tool.
                </p>
              </div>
            ) : null}

            <Card className="shadow-none">
              <CardBody className="grid gap-4 md:grid-cols-2">
                <Field label="Design method" hint="LRFD default; ASD uses P_n/1.67 for member buckling.">
                  <SelectInput value={designMethod} onChange={(v) => setDesignMethod(v as "LRFD" | "ASD")}>
                    <option value="LRFD">LRFD</option>
                    <option value="ASD">ASD</option>
                  </SelectInput>
                </Field>
                <Field label="Demand Pu / Pa" hint="Required compressive strength (kips).">
                  <TextInput value={Pu} onChange={setPu} />
                </Field>
                <Field label="Length L" hint="in">
                  <TextInput value={L} onChange={setL} />
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
                  hint="Multiply K when your course or lacing notes require it (1.0 = unchanged). Not a full batten/lacing design."
                >
                  <TextInput value={builtUpFactor} onChange={setBuiltUpFactor} placeholder="1.0" />
                </Field>
                <p className="col-span-2 text-xs text-slate-600">
                  Effective K for analysis = {k} × {builtUpFactor} = <strong>{kEffective.toFixed(4)}</strong> (used in KL/r).
                </p>
              </CardBody>
            </Card>

            <details className="rounded-2xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Show step-by-step calculations</summary>
              <div className="mt-4">
                <StepsTable steps={out.steps} />
              </div>
            </details>
          </div>

          <aside className="md:col-span-4">
            <div className="sticky top-6 space-y-4">
              <Card>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                      <div className="mt-2">
                        {out.isSafe ? <Badge tone="good">SAFE</Badge> : <Badge tone="bad">NOT SAFE</Badge>}
                      </div>
                    </div>
                    <Badge tone="info">{mat.key}</Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    <Row
                      label={designMethod === "LRFD" ? "Design strength (φPn)" : "Allowable (Pn/Ω)"}
                      value={`${out.controllingStrength.toFixed(3)} kips`}
                    />
                    <Row label={designMethod === "LRFD" ? "Demand Pu" : "Demand Pa"} value={`${out.demand.toFixed(3)} kips`} />
                  </div>
                </CardBody>
              </Card>

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
