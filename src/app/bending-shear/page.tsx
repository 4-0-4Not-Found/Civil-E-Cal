"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calculateBendingShearDesign } from "@/lib/calculations/bending";
import {
  asdStrengthUniformLoadKlf,
  lrfdFactoredUniformLoadKlf,
  serviceUniformLoadKlf,
} from "@/lib/excel-parity";
import { fmtKipFt, fmtKips } from "@/lib/format/display";
import { flangeWebSlenderness } from "@/lib/calculations/section-slenderness";
import { aiscShapes } from "@/lib/aisc/data";
import { steelMaterialMap, steelMaterials, type SteelMaterialKey } from "@/lib/data/materials";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { StepsTable } from "@/components/StepsTable";
import { ExportJsonButton } from "@/components/ExportJsonButton";
import { STORAGE } from "@/lib/storage/keys";

export default function BendingShearPage() {
  const [designMethod, setDesignMethod] = useState<"LRFD" | "ASD">("LRFD");
  const [material, setMaterial] = useState<SteelMaterialKey>("A36");
  const [shapeName, setShapeName] = useState("W30X90");
  const [Mu, setMu] = useState("450");
  const [Vu, setVu] = useState("120");
  const [L, setL] = useState("360");
  const [wLive, setWLive] = useState("0.1");
  const [deadLoadKft, setDeadLoadKft] = useState("");
  const [liveLoadKft, setLiveLoadKft] = useState("");
  const [spanFt, setSpanFt] = useState("");
  const [unbracedLbIn, setUnbracedLbIn] = useState("");
  const [cbFactor, setCbFactor] = useState("1.14");
  const [mode, setMode] = useState<"check" | "design">("check");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE.bending);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const p = JSON.parse(raw) as Record<string, string>;
      if (p.designMethod === "LRFD" || p.designMethod === "ASD") setDesignMethod(p.designMethod);
      if (typeof p.material === "string") setMaterial(p.material as SteelMaterialKey);
      if (typeof p.shapeName === "string") setShapeName(p.shapeName);
      if (typeof p.Mu === "string") setMu(p.Mu);
      if (typeof p.Vu === "string") setVu(p.Vu);
      if (typeof p.L === "string") setL(p.L);
      if (typeof p.wLive === "string") setWLive(p.wLive);
      if (typeof p.deadLoadKft === "string") setDeadLoadKft(p.deadLoadKft);
      if (typeof p.liveLoadKft === "string") setLiveLoadKft(p.liveLoadKft);
      if (typeof p.spanFt === "string") setSpanFt(p.spanFt);
      if (typeof p.unbracedLbIn === "string") setUnbracedLbIn(p.unbracedLbIn);
      if (typeof p.cbFactor === "string") setCbFactor(p.cbFactor);
      if (p.mode === "check" || p.mode === "design") setMode(p.mode);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE.bending,
        JSON.stringify({
          designMethod,
          material,
          shapeName,
          Mu,
          Vu,
          L,
          wLive,
          deadLoadKft,
          liveLoadKft,
          spanFt,
          unbracedLbIn,
          cbFactor,
          mode,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [
    hydrated,
    designMethod,
    material,
    shapeName,
    Mu,
    Vu,
    L,
    wLive,
    deadLoadKft,
    liveLoadKft,
    spanFt,
    unbracedLbIn,
    cbFactor,
    mode,
  ]);

  const shape = aiscShapes.find((s) => s.shape === shapeName);
  const mat = steelMaterialMap[material];

  const slenderness = useMemo(() => {
    if (!shape) return null;
    return flangeWebSlenderness(29000, mat.Fy, shape.bf_2tf, shape.h_tw);
  }, [shape, mat]);

  const shapeOptions = useMemo(
    () =>
      mode === "design"
        ? aiscShapes.filter((s) => s.type === "W")
        : aiscShapes.filter((s) => s.type === "W" || s.type === "HSS"),
    [mode],
  );

  useEffect(() => {
    if (mode !== "design") return;
    setShapeName((prev) => {
      const cur = aiscShapes.find((s) => s.shape === prev);
      if (cur?.type === "HSS") {
        const firstW = aiscShapes.find((s) => s.type === "W");
        return firstW?.shape ?? prev;
      }
      return prev;
    });
  }, [mode]);

  const derivedFromLoads = useMemo(() => {
    const DL = Number(deadLoadKft);
    const LL = Number(liveLoadKft);
    const Lft = Number(spanFt);
    if (!Number.isFinite(DL) || !Number.isFinite(LL) || !Number.isFinite(Lft) || Lft <= 0) return null;
    const wStrengthKlf =
      designMethod === "LRFD" ? lrfdFactoredUniformLoadKlf(DL, LL) : asdStrengthUniformLoadKlf(DL, LL);
    const MuDer = (wStrengthKlf * Lft * Lft) / 8;
    const VuDer = (wStrengthKlf * Lft) / 2;
    /** Service load for deflection: D + L (unfactored) → kip/in. */
    const wServiceKipIn = serviceUniformLoadKlf(DL, LL) / 12;
    const Lin = Lft * 12;
    return { wStrengthKlf, MuDer, VuDer, wServiceKipIn, Lin };
  }, [deadLoadKft, liveLoadKft, spanFt, designMethod]);

  useEffect(() => {
    if (!derivedFromLoads) return;
    queueMicrotask(() => {
      setMu(String(Math.round(derivedFromLoads.MuDer * 1000) / 1000));
      setVu(String(Math.round(derivedFromLoads.VuDer * 1000) / 1000));
      setWLive(String(Math.round(derivedFromLoads.wServiceKipIn * 1000000) / 1000000));
      setL(String(Math.round(derivedFromLoads.Lin)));
    });
  }, [derivedFromLoads]);

  const out = useMemo(() => {
    if (!shape) return null;
    const Lin = derivedFromLoads?.Lin ?? Number(L);
    const w = derivedFromLoads?.wServiceKipIn ?? Number(wLive);
    const muUse = derivedFromLoads?.MuDer ?? Number(Mu);
    const vuUse = derivedFromLoads?.VuDer ?? Number(Vu);
    const delta = (5 / 384) * w * (Lin ** 4) / (29000 * (shape.Ix || 1));
    const lbParsed = Number(unbracedLbIn);
    const LbUse = unbracedLbIn.trim() !== "" && Number.isFinite(lbParsed) && lbParsed > 0 ? lbParsed : Lin;
    const cbParsed = Number(cbFactor);
    const CbUse = Number.isFinite(cbParsed) && cbParsed > 0 ? cbParsed : 1;
    return calculateBendingShearDesign({
      designMethod,
      E: 29000,
      Fy: mat.Fy,
      Zx: shape.Zx,
      Sx: shape.Sx,
      Ix: shape.Ix,
      Iy: shape.Iy,
      ry: shape.ry,
      d: shape.d,
      bf: shape.bf,
      tf: shape.tf,
      lambdaFlange: shape.bf_2tf,
      lambdaWeb: shape.h_tw,
      h: shape.h || shape.d - 2 * shape.tf,
      tw: shape.tw,
      a: shape.d,
      isStiffened: false,
      Mu: muUse,
      Vu: vuUse,
      L: Lin,
      wLive: w,
      deflection: delta,
      deflectionAllowable: Lin / 360,
      Lb: LbUse,
      Cb: CbUse,
      sectionProfile: mode === "design" ? "W" : shape.type === "HSS" ? "HSS" : "W",
    });
  }, [shape, mat, Mu, Vu, L, wLive, designMethod, derivedFromLoads, unbracedLbIn, cbFactor, mode]);

  const suggestion = useMemo(() => {
    if (mode !== "design") return null;
    const Lin = derivedFromLoads?.Lin ?? Number(L);
    const w = derivedFromLoads?.wServiceKipIn ?? Number(wLive);
    const muUse = derivedFromLoads?.MuDer ?? Number(Mu);
    const vuUse = derivedFromLoads?.VuDer ?? Number(Vu);
    const lbParsed = Number(unbracedLbIn);
    const LbUse = unbracedLbIn.trim() !== "" && Number.isFinite(lbParsed) && lbParsed > 0 ? lbParsed : Lin;
    const cbParsed = Number(cbFactor);
    const CbUse = Number.isFinite(cbParsed) && cbParsed > 0 ? cbParsed : 1;
    const candidates = aiscShapes
      .filter((s) => s.type === "W")
      .map((s) => {
        const delta = (5 / 384) * w * (Lin ** 4) / (29000 * (s.Ix || 1));
        const check = calculateBendingShearDesign({
          designMethod,
          E: 29000,
          Fy: mat.Fy,
          Zx: s.Zx,
          Sx: s.Sx,
          Ix: s.Ix,
          Iy: s.Iy,
          ry: s.ry,
          d: s.d,
          bf: s.bf,
          tf: s.tf,
          lambdaFlange: s.bf_2tf,
          lambdaWeb: s.h_tw,
          h: s.h || s.d - 2 * s.tf,
          tw: s.tw,
          a: s.d,
          isStiffened: false,
          Mu: muUse,
          Vu: vuUse,
          L: Lin,
          wLive: w,
          deflection: delta,
          deflectionAllowable: Lin / 360,
          Lb: LbUse,
          Cb: CbUse,
          sectionProfile: "W",
        });
        return { s, check };
      })
      .filter((c) => c.check.isSafe)
      .sort((a, b) => a.s.W - b.s.W);
    return candidates[0] ?? null;
  }, [mode, Mu, Vu, mat, L, wLive, designMethod, derivedFromLoads, unbracedLbIn, cbFactor]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardHeader
          title="Bending, Shear & Deflection"
          description="Simply supported strong axis: rolled W-shapes (full F6/F2) or rectangular HSS (approximate F7/G-style limits in-engine). Design mode suggests lightest W only. Inputs save in this browser."
          right={
            <div className="flex flex-wrap items-center gap-2">
              {out ? <ExportJsonButton data={{ result: out, inputs: { material, shapeName, Mu, Vu, L, wLive, designMethod, unbracedLbIn, cbFactor } }} /> : null}
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
              <Field label="Steel Type" hint="Fy and Fu (ksi) from the material table.">
                <SelectInput value={material} onChange={(v) => setMaterial(v as SteelMaterialKey)}>
                  {steelMaterials.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} (Fy = {m.Fy} ksi)
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field
                label={mode === "design" ? "W-shape (design)" : "Member (W or HSS)"}
                hint="AISC v16. HSS uses approximate wall λ limits and box J — verify critical members with AISC F7. Design mode: W only."
              >
                <SelectInput value={shapeName} onChange={setShapeName}>
                  {shapeOptions.map((s) => (
                    <option key={s.shape} value={s.shape}>
                      {s.shape}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            {slenderness ? (
              <Card className="shadow-none border border-slate-200 bg-white">
                <CardBody className="space-y-3 text-sm text-slate-800">
                  <p className="text-base font-semibold text-slate-900">Local buckling (AISC Table B4.1)</p>
                  <p className="text-slate-600">
                    Compare section slenderness λ to λ_p (compact) and λ_r from the AISC v16 shape you selected (E = 29 000 ksi).
                  </p>
                  <div className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
                    <div>
                      <p className="font-semibold">{slenderness.flange.label}</p>
                      <p>λ = {slenderness.flange.lambda.toFixed(2)}, λ_p = {slenderness.flange.lambdaP.toFixed(3)}, λ_r = {slenderness.flange.lambdaR.toFixed(3)}</p>
                      <p className="text-slate-900">→ {slenderness.flange.class}</p>
                    </div>
                    <div>
                      <p className="font-semibold">{slenderness.web.label}</p>
                      <p>λ = {slenderness.web.lambda.toFixed(2)}, λ_p = {slenderness.web.lambdaP.toFixed(3)}, λ_r = {slenderness.web.lambdaR.toFixed(3)}</p>
                      <p className="text-slate-900">→ {slenderness.web.class}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            <Card className="shadow-none">
              <CardBody className="grid gap-4 md:grid-cols-2">
                <Field label="Mode" hint="Check a chosen section, or suggest a lighter W that works.">
                  <SelectInput value={mode} onChange={(v) => setMode(v as "check" | "design")}>
                    <option value="check">Check section</option>
                    <option value="design">Suggest lightest W</option>
                  </SelectInput>
                </Field>
                <Field label="Design method" hint="LRFD or ASD strength reduction.">
                  <SelectInput value={designMethod} onChange={(v) => setDesignMethod(v as "LRFD" | "ASD")}>
                    <option value="LRFD">LRFD</option>
                    <option value="ASD">ASD</option>
                  </SelectInput>
                </Field>

                <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  <p className="font-semibold text-slate-900">Loads</p>
                  <p className="mt-1 text-slate-600">
                    Option A — Enter <strong>dead load</strong>, <strong>live load</strong> (kips/ft), and <strong>span</strong> (ft) for a uniform simply supported beam.
                    Strength load: <strong>LRFD</strong> uses max(1.4D, 1.2D + 1.6L) klf; <strong>ASD</strong> uses D + L klf
                    (ASCE 7 ASD combo 2 for D+L-only). Deflection uses <strong>service D + L</strong> as kip/in ((D + L) ÷ 12).
                  </p>
                  <p className="mt-2 text-slate-600">
                    Option B — Leave those three blank and enter <strong>M_u</strong>, <strong>V_u</strong>, <strong>span L</strong> (in), and <strong>live load w</strong> for deflection (kip/in) yourself.
                  </p>
                </div>

                <Field label="Dead load w_D" hint="Uniform dead load (kips per ft).">
                  <TextInput value={deadLoadKft} onChange={setDeadLoadKft} placeholder="e.g. 0.8" />
                </Field>
                <Field label="Live load w_L" hint="Uniform live load (kips per ft).">
                  <TextInput value={liveLoadKft} onChange={setLiveLoadKft} placeholder="e.g. 3.2" />
                </Field>
                <Field label="Span" hint="Clear span in feet (converts to L in inches for analysis).">
                  <TextInput
                    value={spanFt}
                    onChange={(v) => {
                      setSpanFt(v);
                      const ft = Number(v);
                      if (Number.isFinite(ft) && ft > 0) setL(String(ft * 12));
                    }}
                    placeholder="e.g. 30"
                  />
                </Field>

                {derivedFromLoads ? (
                  <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                    <p className="font-semibold">From your loads ({designMethod})</p>
                    <p>
                      w for strength = {derivedFromLoads.wStrengthKlf.toFixed(3)} k/ft
                      {designMethod === "LRFD" ? " (LRFD factored)" : " (ASD D + L)"}
                    </p>
                    <p>M_u = {derivedFromLoads.MuDer.toFixed(3)} kip·ft, V_u = {derivedFromLoads.VuDer.toFixed(3)} kips</p>
                    <p>Service w for deflection (D+L) = {derivedFromLoads.wServiceKipIn.toFixed(4)} kip/in</p>
                  </div>
                ) : null}

                <Field label="M_u" hint="Required flexural strength (kip·ft). Filled automatically when dead/live/span are set.">
                  <TextInput value={Mu} onChange={setMu} />
                </Field>
                <Field label="V_u" hint="Required shear (kips).">
                  <TextInput value={Vu} onChange={setVu} />
                </Field>
                <Field label="Span L" hint="Span in inches.">
                  <TextInput value={L} onChange={setL} />
                </Field>
                <Field
                  label="Unbraced L_b (LTB)"
                  hint="Inches along the beam between points braced against twist/lateral displacement. Leave blank to use span L (fully unbraced)."
                >
                  <TextInput value={unbracedLbIn} onChange={setUnbracedLbIn} placeholder="default = span" />
                </Field>
                <Field
                  label="C_b (moment gradient)"
                  hint="AISC F1. Uniform moment 1.0; uniform load on simple span ≈ 1.14; others per Table 3-2."
                >
                  <TextInput value={cbFactor} onChange={setCbFactor} />
                </Field>
                <Field label="Service w for deflection" hint="Uniform service load in kip/in — with D/L/span above, uses (D+L)/12; manual mode: enter (D+L)/12 or your Excel convention.">
                  <TextInput value={wLive} onChange={setWLive} />
                </Field>
              </CardBody>
            </Card>

            {suggestion ? (
              <Card className="border-slate-300 bg-white">
                <CardBody>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-800">Suggested section (lowest weight W that passes)</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{suggestion.s.shape}</p>
                  <p className="mt-1 text-base font-medium text-slate-800">
                    {suggestion.s.W} lb/ft, Zx = {suggestion.s.Zx.toFixed(1)} in³
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {out ? (
              <details className="rounded-2xl border border-slate-300 bg-white p-5">
                <summary className="cursor-pointer text-lg font-bold text-slate-900">Step-by-step calculations</summary>
                <div className="mt-4">
                  <StepsTable steps={out.steps} />
                </div>
              </details>
            ) : null}
          </div>

          <aside className="md:col-span-4">
            {out ? (
              <div className="sticky top-6 space-y-4">
                {out.governingCase === "geometry_error" ? (
                  <Card className="border-red-300 bg-red-50">
                    <CardBody className="text-sm text-red-950">
                      <p className="font-semibold">Cannot run analysis</p>
                      <p className="mt-1">{String(out.steps[0]?.value ?? "")}</p>
                    </CardBody>
                  </Card>
                ) : null}
                <Card>
                  <CardBody>
                    <p className="text-base font-semibold uppercase tracking-wide text-slate-800">Status</p>
                    <div className="mt-2">
                      {out.governingCase === "geometry_error" ? (
                        <Badge tone="bad">INVALID SECTION</Badge>
                      ) : out.isSafe ? (
                        <Badge tone="good">SAFE</Badge>
                      ) : (
                        <Badge tone="bad">NOT SAFE</Badge>
                      )}
                    </div>
                    {out.beamLimitStates && out.governingCase !== "geometry_error" ? (
                      <div className="mt-4 space-y-3 text-base">
                        <p className="font-semibold text-slate-800">
                          Governing: {out.beamLimitStates.governing} (highest utilization)
                        </p>
                        <LimitRow
                          title="Bending"
                          demand={out.beamLimitStates.bending.demand}
                          capacity={out.beamLimitStates.bending.capacity}
                          ratio={out.beamLimitStates.bending.ratio}
                          unit={out.beamLimitStates.bending.unit}
                        />
                        <LimitRow
                          title={`Shear (${out.beamLimitStates.shear.cvCase}, C_v = ${out.beamLimitStates.shear.cv.toFixed(4)})`}
                          demand={out.beamLimitStates.shear.demand}
                          capacity={out.beamLimitStates.shear.capacity}
                          ratio={out.beamLimitStates.shear.ratio}
                          unit={out.beamLimitStates.shear.unit}
                        />
                        <LimitRow
                          title={deadLoadKft.trim() && liveLoadKft.trim() && spanFt.trim() ? "Deflection (service D+L)" : "Deflection (service w)"}
                          demand={out.beamLimitStates.deflection.demand}
                          capacity={out.beamLimitStates.deflection.capacity}
                          ratio={out.beamLimitStates.deflection.ratio}
                          unit={out.beamLimitStates.deflection.unit}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-2 text-lg">
                        <Row label="Governing case" value={out.governingCase} />
                        <Row label="Design strength" value={`${fmtKips(out.controllingStrength)}`} />
                        <Row label="Demand" value={`${fmtKips(out.demand)}`} />
                      </div>
                    )}
                    <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-3">
                      <p className="text-base font-semibold text-slate-800">Design strengths</p>
                      <div className="mt-2 space-y-2">
                        {Object.entries(out.results).map(([key, value]) => (
                          <div key={key} className="flex items-baseline justify-between gap-2 text-base">
                            <span className="text-slate-700">{value.name}</span>
                            <span className="font-bold text-slate-900">
                              {value.unit === "kip-ft" ? fmtKipFt(value.phiPn) : fmtKips(value.phiPn)} {value.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            ) : null}
          </aside>
        </CardBody>
      </Card>
    </main>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-semibold text-slate-800">{props.label}</span>
      <span className="font-bold text-slate-900">{props.value}</span>
    </div>
  );
}

function LimitRow(props: {
  title: string;
  demand: number;
  capacity: number;
  ratio: number;
  unit: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-sm font-semibold text-slate-800">{props.title}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-700">
        <span>
          Demand {(props.unit === "kip-ft" ? fmtKipFt(props.demand) : fmtKips(props.demand))} / Capacity{" "}
          {(props.unit === "kip-ft" ? fmtKipFt(props.capacity) : fmtKips(props.capacity))} {props.unit}
        </span>
        <span className="font-bold text-slate-900">{(props.ratio * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}
