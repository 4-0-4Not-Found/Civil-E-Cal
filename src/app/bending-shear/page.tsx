"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { STORAGE } from "@/lib/storage/keys";
import { AppShell } from "@/components/layout/AppShell";
import { ResultHero } from "@/components/results/ResultHero";
import { PageFooterNav } from "@/components/navigation/PageFooterNav";
import { UtilizationBar } from "@/components/ui/UtilizationBar";
import { TextInputWithUnit } from "@/components/ui/InputGroup";
import { CalculatorActionRail } from "@/components/actions/CalculatorActionRail";
import { PageSectionNav } from "@/components/navigation/PageSectionNav";

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
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE.bending);
      if (!raw) {
        queueMicrotask(() => setHydrated(true));
        return;
      }
      const p = JSON.parse(raw) as Record<string, string>;
      queueMicrotask(() => {
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
      const ts = Date.now();
      localStorage.setItem("ssc:ts:bending", String(ts));
      setSavedAt(ts);
    } catch {
      /* ignore */
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaving(false), 450);
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
    queueMicrotask(() => {
      setShapeName((prev) => {
        const cur = aiscShapes.find((s) => s.shape === prev);
        if (cur?.type === "HSS") {
          const firstW = aiscShapes.find((s) => s.type === "W");
          return firstW?.shape ?? prev;
        }
        return prev;
      });
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
      localStorage.removeItem(STORAGE.bending);
      localStorage.removeItem("ssc:ts:bending");
    } catch {
      /* ignore */
    }
    setDesignMethod("LRFD");
    setMaterial("A36");
    setShapeName("W30X90");
    setMu("450");
    setVu("120");
    setL("360");
    setWLive("0.1");
    setDeadLoadKft("");
    setLiveLoadKft("");
    setSpanFt("");
    setUnbracedLbIn("");
    setCbFactor("1.14");
    setMode("check");
  };

  const invalid = (v: string, min = 0, allowBlank = false) => {
    if (allowBlank && v.trim() === "") return false;
    const n = Number(v);
    return !Number.isFinite(n) || n < min;
  };

  return (
    <AppShell>
      <Card>
        <CardHeader
          title="Bending, Shear & Deflection"
          description="Simply supported strong axis: rolled W-shapes (full F6/F2) or rectangular HSS (approximate F7/G-style limits in-engine). Design mode suggests lightest W only. Inputs save in this browser."
        />
        <CardBody className="grid gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-12 md:hidden">
            <PageSectionNav
              sections={[
                { id: "beam-general", label: "General" },
                { id: "beam-loads", label: "Loads" },
                { id: "beam-check", label: "Checks" },
                { id: "beam-steps", label: "Steps" },
              ]}
            />
          </div>
          <div className="md:col-span-8 grid gap-4">
            <details open className="rounded-2xl border border-slate-200 bg-white" id="beam-general">
              <summary className="min-h-11 cursor-pointer px-4 py-3.5 text-sm font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 sm:px-5 sm:py-4">
                1 · General
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Steel, member selection, check/design mode, and method.
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Units: ksi
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
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
                    hint="AISC v16. HSS uses simplified assumptions; verify critical members with AISC F7."
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

                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                </div>

                {shape ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">Section context</p>
                      <Badge tone="info">{shape.shape}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-4">
                      <span className="tabular-nums">W: {shape.W.toFixed(1)} plf</span>
                      <span className="tabular-nums">Zx: {shape.Zx.toFixed(1)} in³</span>
                      <span className="tabular-nums">Ix: {shape.Ix.toFixed(1)} in⁴</span>
                      <span className="tabular-nums">ry: {shape.ry.toFixed(2)} in</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </details>

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

            <details open className="rounded-2xl border border-slate-200 bg-white" id="beam-loads">
              <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                2 · Loads
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Option A: dead/live/span → auto-derive M, V, service w. Option B: enter M, V, w manually.
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Units: k/ft, ft
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Dead load w_D" hint="Uniform dead load (kips per ft).">
                    <TextInputWithUnit value={deadLoadKft} onChange={setDeadLoadKft} unit="k/ft" placeholder="e.g. 0.8" inputMode="decimal" />
                  </Field>
                  <Field label="Live load w_L" hint="Uniform live load (kips per ft).">
                    <TextInputWithUnit value={liveLoadKft} onChange={setLiveLoadKft} unit="k/ft" placeholder="e.g. 3.2" inputMode="decimal" />
                  </Field>
                  <Field label="Span" hint="Feet (converts to L in inches).">
                    <TextInputWithUnit
                      value={spanFt}
                      onChange={(v) => {
                        setSpanFt(v);
                        const ft = Number(v);
                        if (Number.isFinite(ft) && ft > 0) setL(String(ft * 12));
                      }}
                      unit="ft"
                      placeholder="e.g. 30"
                    />
                  </Field>
                </div>

                {derivedFromLoads ? (
                  <Card className="mt-4 border-[color:var(--brand)]/20 bg-[color:var(--brand)]/5">
                    <CardBody className="space-y-1 text-sm text-slate-900">
                      <p className="font-bold">Derived from your loads ({designMethod})</p>
                      <p className="tabular-nums">
                        w for strength = {derivedFromLoads.wStrengthKlf.toFixed(3)} k/ft
                        {designMethod === "LRFD" ? " (LRFD factored)" : " (ASD D + L)"}
                      </p>
                      <p className="tabular-nums">
                        M_u = {derivedFromLoads.MuDer.toFixed(3)} kip·ft · V_u = {derivedFromLoads.VuDer.toFixed(3)} kips
                      </p>
                      <p className="tabular-nums">Service w for deflection (D+L) = {derivedFromLoads.wServiceKipIn.toFixed(4)} kip/in</p>
                    </CardBody>
                  </Card>
                ) : null}
              </div>
            </details>

            <details open className="rounded-2xl border border-slate-200 bg-white" id="beam-check">
              <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                3 · Member checks (M, V, LTB, deflection)
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Enter demands directly (or use Loads above). L is inches for analysis.
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Units: kip·ft, kips, in
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                <Field label="M_u" hint="Required flexural strength (kip·ft). Filled automatically when dead/live/span are set.">
                  <TextInputWithUnit value={Mu} onChange={setMu} unit="kip·ft" inputMode="decimal" />
                </Field>
                <Field label="V_u" hint="Required shear (kips).">
                  <TextInputWithUnit value={Vu} onChange={setVu} unit="kips" inputMode="decimal" />
                </Field>
                <Field label="Span L" hint="Span in inches." error={invalid(L, 0) ? "Enter a number ≥ 0." : undefined}>
                  <TextInputWithUnit value={L} onChange={setL} unit="in" inputMode="decimal" />
                </Field>
                <Field
                  label="Unbraced L_b (LTB)"
                  hint="Inches along the beam between points braced against twist/lateral displacement. Leave blank to use span L (fully unbraced)."
                  error={invalid(unbracedLbIn, 0, true) ? "Enter a number ≥ 0, or leave blank." : undefined}
                >
                  <TextInputWithUnit value={unbracedLbIn} onChange={setUnbracedLbIn} unit="in" placeholder="default = span" inputMode="decimal" />
                </Field>
                <Field
                  label="C_b (moment gradient)"
                  hint="AISC F1. Uniform moment 1.0; uniform load on simple span ≈ 1.14; others per Table 3-2."
                  error={invalid(cbFactor, 0) ? "Enter a number > 0." : undefined}
                >
                  <TextInput value={cbFactor} onChange={setCbFactor} />
                </Field>
                <Field label="Service w for deflection" hint="Uniform service load in kip/in — with D/L/span above, uses (D+L)/12; manual mode: enter (D+L)/12 or your Excel convention.">
                  <TextInputWithUnit value={wLive} onChange={setWLive} unit="kip/in" inputMode="decimal" />
                </Field>
                </div>
              </div>
            </details>

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
              <details className="rounded-2xl border border-slate-200 bg-white" id="beam-steps">
                <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                  Steps (show math)
                  <span className="mt-1 block text-xs font-semibold text-slate-600">
                    Governing: <span className="text-slate-900">{out.beamLimitStates?.governing ?? out.governingCase}</span>
                  </span>
                </summary>
                <div className="border-t border-slate-200 p-5">
                  <StepsTable
                    steps={out.steps}
                    governingCase={String(out.beamLimitStates?.governing ?? out.governingCase)}
                    tools
                  />
                </div>
              </details>
            ) : null}
          </div>

          <aside className="md:col-span-4">
            {out ? (
              <div className="sticky top-6 md:top-[calc(var(--app-header-h,104px)+16px)] space-y-4">
                <div className="hidden md:block">
                  <PageSectionNav
                    sections={[
                      { id: "beam-general", label: "General" },
                      { id: "beam-loads", label: "Loads" },
                      { id: "beam-check", label: "Checks" },
                      { id: "beam-steps", label: "Steps" },
                    ]}
                  />
                </div>
                <CalculatorActionRail
                  hideMobileBar
                  title="Actions"
                  subtitle={`${shapeName} · ${designMethod} · ${mode === "design" ? "Design" : "Check"}`}
                  savedKey="ssc:ts:bending"
                  saving={saving}
                  savedAt={savedAt}
                  compare={{
                    storageKey: "ssc:compare:beam",
                    getCurrent: () => {
                      const gov = out?.beamLimitStates?.governing ?? out?.governingCase ?? "—";
                      const lines: string[] = [
                        `Method: ${designMethod} · Material: ${mat.key} · Mode: ${mode}`,
                        `Shape: ${shapeName}`,
                        `Mu: ${Mu} kip-ft · Vu: ${Vu} kips · L: ${L} in`,
                        `Governing: ${String(gov)}`,
                      ];
                      if (out?.beamLimitStates) {
                        lines.push(
                          `Bending ratio: ${(out.beamLimitStates.bending.ratio * 100).toFixed(1)}%`,
                          `Shear ratio: ${(out.beamLimitStates.shear.ratio * 100).toFixed(1)}%`,
                          `Deflection ratio: ${(out.beamLimitStates.deflection.ratio * 100).toFixed(1)}%`,
                        );
                      } else if (out) {
                        lines.push(`Capacity: ${fmtKips(out.controllingStrength)} · Demand: ${fmtKips(out.demand)}`);
                      }
                      return { title: `Beam — ${shapeName}`, lines };
                    },
                  }}
                  copyText={() => {
                    if (!out) return "Beam — No results";
                    const lines = [
                      "Beam",
                      `Method: ${designMethod}`,
                      `Material: ${mat.key}`,
                      `Shape: ${shapeName}`,
                      `Governing: ${out.beamLimitStates?.governing ?? out.governingCase}`,
                      `Demand: ${fmtKips(out.demand)}`,
                    ];
                    if (out.beamLimitStates) {
                      lines.push(
                        `Bending ratio: ${(out.beamLimitStates.bending.ratio * 100).toFixed(1)}%`,
                        `Shear ratio: ${(out.beamLimitStates.shear.ratio * 100).toFixed(1)}%`,
                        `Deflection ratio: ${(out.beamLimitStates.deflection.ratio * 100).toFixed(1)}%`,
                      );
                    } else {
                      lines.push(`Capacity: ${fmtKips(out.controllingStrength)}`);
                    }
                    return lines.join("\n");
                  }}
                  onGoResults={() => scrollTo("results")}
                  onGoSteps={() => scrollTo("beam-steps")}
                  json={{ data: { result: out, inputs: { material, shapeName, Mu, Vu, L, wLive, designMethod, unbracedLbIn, cbFactor } } }}
                  onReset={resetInputs}
                />
                {out.governingCase === "geometry_error" ? (
                  <Card className="border-red-300 bg-red-50">
                    <CardBody className="text-sm text-red-950">
                      <p className="font-semibold">Cannot run analysis</p>
                      <p className="mt-1">{String(out.steps[0]?.value ?? "")}</p>
                    </CardBody>
                  </Card>
                ) : null}
                <div id="results">
                <ResultHero
                  status={out.governingCase === "geometry_error" ? "invalid" : out.isSafe ? "safe" : "unsafe"}
                  governing={out.beamLimitStates?.governing ?? out.governingCase}
                  capacityLabel={out.beamLimitStates ? "Max utilization" : "Capacity"}
                  capacity={
                    out.beamLimitStates
                      ? `${(
                          Math.max(
                            out.beamLimitStates.bending.ratio,
                            out.beamLimitStates.shear.ratio,
                            out.beamLimitStates.deflection.ratio,
                          ) * 100
                        ).toFixed(1)}%`
                      : fmtKips(out.controllingStrength)
                  }
                  demandLabel={out.beamLimitStates ? "Demand (overall)" : "Demand"}
                  demand={fmtKips(out.demand)}
                  utilization={
                    out.beamLimitStates
                      ? Math.max(
                          out.beamLimitStates.bending.ratio,
                          out.beamLimitStates.shear.ratio,
                          out.beamLimitStates.deflection.ratio,
                        )
                      : out.controllingStrength > 0
                        ? out.demand / out.controllingStrength
                        : undefined
                  }
                />
                </div>

                {out.beamLimitStates && out.governingCase !== "geometry_error" ? (
                  <Card>
                    <CardBody className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Limit states (utilization)
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
                        title={
                          deadLoadKft.trim() && liveLoadKft.trim() && spanFt.trim()
                            ? "Deflection (service D+L)"
                            : "Deflection (service w)"
                        }
                        demand={out.beamLimitStates.deflection.demand}
                        capacity={out.beamLimitStates.deflection.capacity}
                        ratio={out.beamLimitStates.deflection.ratio}
                        unit={out.beamLimitStates.deflection.unit}
                      />
                    </CardBody>
                  </Card>
                ) : null}

                <Card>
                  <CardBody>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Design strengths</p>
                    <div className="mt-3 space-y-2">
                      {Object.entries(out.results).map(([key, value]) => (
                        <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700">{value.name}</span>
                            <span className="font-semibold tabular-nums text-slate-950">
                              {value.unit === "kip-ft" ? fmtKipFt(value.phiPn) : fmtKips(value.phiPn)} {value.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </div>
            ) : null}
          </aside>
        </CardBody>
      </Card>

      <div className="mt-8 md:mt-10">
      <div id="actions">
      <CalculatorActionRail
        mobileOnly
        subtitle="Beam actions"
        savedKey="ssc:ts:bending"
        saving={saving}
        savedAt={savedAt}
        copyText={() => {
          if (!out) return "Beam — No results";
          const lines = [
            "Beam",
            `Method: ${designMethod}`,
            `Material: ${mat.key}`,
            `Shape: ${shapeName}`,
            `Governing: ${out.beamLimitStates?.governing ?? out.governingCase}`,
            `Demand: ${fmtKips(out.demand)}`,
          ];
          if (out.beamLimitStates) {
            lines.push(
              `Bending ratio: ${(out.beamLimitStates.bending.ratio * 100).toFixed(1)}%`,
              `Shear ratio: ${(out.beamLimitStates.shear.ratio * 100).toFixed(1)}%`,
              `Deflection ratio: ${(out.beamLimitStates.deflection.ratio * 100).toFixed(1)}%`,
            );
          } else {
            lines.push(`Capacity: ${fmtKips(out.controllingStrength)}`);
          }
          return lines.join("\n");
        }}
        onGoResults={() => scrollTo("results")}
        onGoSteps={() => scrollTo("beam-steps")}
        json={
          out
            ? {
                data: {
                  result: out,
                  inputs: { material, shapeName, Mu, Vu, L, wLive, designMethod, unbracedLbIn, cbFactor },
                },
              }
            : undefined
        }
        compare={{
          storageKey: "ssc:compare:beam",
          getCurrent: () => {
            const gov = out?.beamLimitStates?.governing ?? out?.governingCase ?? "—";
            const lines: string[] = [
              `Method: ${designMethod} · Material: ${mat.key} · Mode: ${mode}`,
              `Shape: ${shapeName}`,
              `Mu: ${Mu} kip-ft · Vu: ${Vu} kips · L: ${L} in`,
              `Governing: ${String(gov)}`,
            ];
            if (out?.beamLimitStates) {
              lines.push(
                `Bending ratio: ${(out.beamLimitStates.bending.ratio * 100).toFixed(1)}%`,
                `Shear ratio: ${(out.beamLimitStates.shear.ratio * 100).toFixed(1)}%`,
                `Deflection ratio: ${(out.beamLimitStates.deflection.ratio * 100).toFixed(1)}%`,
              );
            } else if (out) {
              lines.push(`Capacity: ${fmtKips(out.controllingStrength)} · Demand: ${fmtKips(out.demand)}`);
            }
            return { title: `Beam — ${shapeName}`, lines };
          },
        }}
        onReset={resetInputs}
      />
      </div>
      </div>
      <PageFooterNav currentHref="/bending-shear" />
    </AppShell>
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
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{props.title}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-700">
        <span className="tabular-nums">
          Demand {(props.unit === "kip-ft" ? fmtKipFt(props.demand) : fmtKips(props.demand))} / Capacity{" "}
          {(props.unit === "kip-ft" ? fmtKipFt(props.capacity) : fmtKips(props.capacity))} {props.unit}
        </span>
        <span className="font-semibold tabular-nums text-slate-900">{(props.ratio * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-2">
        <UtilizationBar ratio={props.ratio} />
      </div>
    </div>
  );
}
