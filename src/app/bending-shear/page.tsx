"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateBendingShearDesign } from "@/lib/calculations/bending";
import {
  asdStrengthUniformLoadKlf,
  beamSimplySupportedUniformDeflectionFt,
  lrfdFactoredUniformLoadKlf,
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

const editableInputClass = "border-sky-300 bg-sky-50 focus:border-sky-400 focus:ring-sky-500/10";

export default function BendingShearPage() {
  const [designMethod, setDesignMethod] = useState<"LRFD" | "ASD">("LRFD");
  const [material, setMaterial] = useState<SteelMaterialKey>("A36");
  const [shapeName, setShapeName] = useState("W30X90");
  const [Mu, setMu] = useState("0");
  const [Vu, setVu] = useState("0");
  const [L, setL] = useState("360");
  const [wLive, setWLive] = useState("0");
  const [deadLoadKft, setDeadLoadKft] = useState("");
  const [liveLoadKft, setLiveLoadKft] = useState("");
  const [spanFt, setSpanFt] = useState("");
  /** Analysis — maximum deflection (Excel): span (ft) + live load (klf) only. */
  const [deflectionSpanFt, setDeflectionSpanFt] = useState("");
  const [deflectionLiveKlf, setDeflectionLiveKlf] = useState("");
  const [webType, setWebType] = useState<"unstiffened" | "stiffened">("unstiffened");
  const [lateralSpacingA, setLateralSpacingA] = useState("10");
  const [bracingHeightH, setBracingHeightH] = useState("");
  /** Workbook design parity: design shear capacity uses a separate reference member (J5 block). */
  const [designShearShapeName, setDesignShearShapeName] = useState("W21X44");
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
        if (typeof p.deflectionSpanFt === "string") setDeflectionSpanFt(p.deflectionSpanFt);
        if (typeof p.deflectionLiveKlf === "string") setDeflectionLiveKlf(p.deflectionLiveKlf);
        if (p.webType === "unstiffened" || p.webType === "stiffened") setWebType(p.webType);
        if (typeof p.lateralSpacingA === "string") setLateralSpacingA(p.lateralSpacingA);
        if (typeof p.bracingHeightH === "string") setBracingHeightH(p.bracingHeightH);
        if (typeof p.designShearShapeName === "string") setDesignShearShapeName(p.designShearShapeName);
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
          deflectionSpanFt,
          deflectionLiveKlf,
          webType,
          lateralSpacingA,
          bracingHeightH,
          designShearShapeName,
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
    deflectionSpanFt,
    deflectionLiveKlf,
    webType,
    lateralSpacingA,
    bracingHeightH,
    designShearShapeName,
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
  const designShearShapeOptions = useMemo(() => aiscShapes.filter((s) => s.type === "W"), []);

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
    /** Service deflection input per workbook: live load in k/ft (Q14). */
    const wServiceKipIn = LL;
    const Lin = Lft * 12;
    return { wStrengthKlf, MuDer, VuDer, wServiceKipIn, Lin };
  }, [deadLoadKft, liveLoadKft, spanFt, designMethod]);

  const out = useMemo(() => {
    if (mode !== "check") return null;
    if (!shape) return null;
    const spanFtNum = Number(deflectionSpanFt.trim());
    const llNum = Number(deflectionLiveKlf.trim());
    const hasDeflectionInputs =
      Number.isFinite(spanFtNum) &&
      spanFtNum > 0 &&
      Number.isFinite(llNum) &&
      llNum >= 0;

    const Lin = hasDeflectionInputs ? spanFtNum * 12 : (() => {
      const Ln = Number(L);
      return Number.isFinite(Ln) && Ln > 0 ? Ln : 1;
    })();
    const w = hasDeflectionInputs ? llNum : 0;
    const muUse = Mu.trim() === "" ? 0 : (Number.isFinite(Number(Mu)) ? Number(Mu) : 0);
    const vuUse = Vu.trim() === "" ? 0 : (Number.isFinite(Number(Vu)) ? Number(Vu) : 0);

    const delta =
      hasDeflectionInputs && shape.Ix
        ? beamSimplySupportedUniformDeflectionFt(llNum, spanFtNum, 29000, shape.Ix)
        : 0;
    const deflectionAllowable = hasDeflectionInputs ? spanFtNum / 360 : Number.POSITIVE_INFINITY;

    const LbUse = Lin;
    const CbUse = 1.14;
    const aInput = Number(lateralSpacingA);
    const hInput = Number(bracingHeightH);
    const aUse = Number.isFinite(aInput) && aInput > 0 ? aInput : 10;
    const hUse = Number.isFinite(hInput) && hInput > 0 ? hInput : shape.h || shape.d - 2 * shape.tf;
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
      a: aUse,
      isStiffened: webType === "stiffened",
      shearPanelH: hUse,
      Mu: muUse,
      Vu: vuUse,
      L: Lin,
      wLive: w,
      deflection: delta,
      deflectionAllowable,
      Lb: LbUse,
      Cb: CbUse,
      sectionProfile: shape.type === "HSS" ? "HSS" : "W",
      excelParityMode: true,
    });
  }, [
    shape,
    mat,
    Mu,
    Vu,
    L,
    designMethod,
    deflectionSpanFt,
    deflectionLiveKlf,
    lateralSpacingA,
    bracingHeightH,
    webType,
    mode,
  ]);

  /** DESIGN mode only — workbook parity: pick by required Zx and required Ix, then run final check with self-weight. */
  const suggestion = useMemo(() => {
    if (mode !== "design") return null;
    if (!derivedFromLoads) return null;
    const DL = Number(deadLoadKft);
    const LL = Number(liveLoadKft);
    const Lft = Number(spanFt);
    if (!Number.isFinite(DL) || !Number.isFinite(LL) || !Number.isFinite(Lft) || Lft <= 0) return null;

    const Lin = Lft * 12;
    const LbUse = Lin;
    const CbUse = 1.14;
    const aInput = Number(lateralSpacingA);
    const aUse = Number.isFinite(aInput) && aInput > 0 ? aInput : 10;
    const wStrengthBase =
      designMethod === "LRFD" ? lrfdFactoredUniformLoadKlf(DL, LL) : asdStrengthUniformLoadKlf(DL, LL);
    const muBase = (wStrengthBase * Lft * Lft) / 8;
    const reqZx = designMethod === "LRFD" ? (12 * muBase) / (0.9 * mat.Fy) : (12 * muBase * 1.67) / mat.Fy;
    /** Workbook I54: (1800*LL*L^3*(12^2))/(384*E) */
    const reqIx = (1800 * LL * Lft ** 3 * 12 ** 2) / (384 * 29000);
    const wShapes = aiscShapes.filter((s) => s.type === "W").slice();
    const byWeight = wShapes.sort((a, b) => a.W - b.W);
    const byZx = byWeight.find((s) => s.Zx >= reqZx) ?? null;
    const byIx = byWeight.find((s) => s.Ix >= reqIx) ?? null;
    const chosen = byZx && byIx ? (byIx.Zx > byZx.Zx ? byIx : byZx) : byZx ?? byIx;
    if (!chosen) return null;
    const hShape = chosen.h && chosen.h > 0 ? chosen.h : chosen.d - 2 * chosen.tf;
    const hInput = Number(bracingHeightH);
    const hUse = Number.isFinite(hInput) && hInput > 0 ? hInput : hShape;
    const shearRef = aiscShapes.find((s) => s.shape === designShearShapeName && s.type === "W") ?? null;
    const swKlf = chosen.W / 1000;
    const wStrengthKlf =
      designMethod === "LRFD"
        ? lrfdFactoredUniformLoadKlf(DL + swKlf, LL)
        : asdStrengthUniformLoadKlf(DL + swKlf, LL);
    const muUse = (wStrengthKlf * Lft * Lft) / 8;
    const vuUse = (wStrengthKlf * Lft) / 2;
    const delta = beamSimplySupportedUniformDeflectionFt(LL, Lft, 29000, chosen.Ix || 1);
    const check = calculateBendingShearDesign({
      designMethod,
      E: 29000,
      Fy: mat.Fy,
      Zx: chosen.Zx,
      Sx: chosen.Sx,
      Ix: chosen.Ix,
      Iy: chosen.Iy,
      ry: chosen.ry,
      d: chosen.d,
      bf: chosen.bf,
      tf: chosen.tf,
      lambdaFlange: chosen.bf_2tf,
      lambdaWeb: chosen.h_tw,
      h: hShape,
      tw: chosen.tw,
      a: aUse,
      isStiffened: webType === "stiffened",
      shearPanelH: hUse,
      Mu: muUse,
      Vu: vuUse,
      L: Lin,
      wLive: LL,
      deflection: delta,
      deflectionAllowable: Lft / 360,
      Lb: LbUse,
      Cb: CbUse,
      sectionProfile: "W",
      excelParityMode: true,
    });
    if (!shearRef) return { s: chosen, check };
    const shearRefH = shearRef.h && shearRef.h > 0 ? shearRef.h : shearRef.d - 2 * shearRef.tf;
    const shearRefCheck = calculateBendingShearDesign({
      designMethod,
      E: 29000,
      Fy: mat.Fy,
      Zx: shearRef.Zx,
      Sx: shearRef.Sx,
      Ix: shearRef.Ix,
      Iy: shearRef.Iy,
      ry: shearRef.ry,
      d: shearRef.d,
      bf: shearRef.bf,
      tf: shearRef.tf,
      lambdaFlange: shearRef.bf_2tf,
      lambdaWeb: shearRef.h_tw,
      h: shearRefH,
      tw: shearRef.tw,
      a: aUse,
      isStiffened: webType === "stiffened",
      shearPanelH: hUse,
      Mu: 0,
      Vu: vuUse,
      L: Lin,
      wLive: LL,
      deflection: 0,
      deflectionAllowable: Number.POSITIVE_INFINITY,
      Lb: LbUse,
      Cb: CbUse,
      sectionProfile: "W",
      excelParityMode: true,
    });
    const shearCap = shearRefCheck.results.shear.phiPn;
    const updated = {
      ...check,
      results: {
        ...check.results,
        shear: { ...check.results.shear, phiPn: shearCap },
      },
      beamLimitStates: check.beamLimitStates
        ? {
            ...check.beamLimitStates,
            shear: {
              ...check.beamLimitStates.shear,
              capacity: shearCap,
              ratio: shearCap > 0 ? vuUse / shearCap : vuUse > 0 ? 999 : 0,
              cv: shearRefCheck.beamLimitStates?.shear.cv ?? check.beamLimitStates.shear.cv,
              cvCase: shearRefCheck.beamLimitStates?.shear.cvCase ?? check.beamLimitStates.shear.cvCase,
            },
          }
        : check.beamLimitStates,
    };
    if (updated.beamLimitStates) {
      const rb = updated.beamLimitStates.bending.ratio;
      const rs = updated.beamLimitStates.shear.ratio;
      const rd = updated.beamLimitStates.deflection.ratio;
      const governing = rb >= rs && rb >= rd ? "bending" : rs >= rd ? "shear" : "deflection";
      updated.beamLimitStates.governing = governing;
      updated.governingCase = governing;
      updated.isSafe =
        updated.beamLimitStates.bending.demand <= updated.beamLimitStates.bending.capacity &&
        updated.beamLimitStates.shear.demand <= updated.beamLimitStates.shear.capacity &&
        updated.beamLimitStates.deflection.demand <= updated.beamLimitStates.deflection.capacity;
      if (governing === "bending") {
        updated.controllingStrength = updated.beamLimitStates.bending.capacity;
        updated.demand = updated.beamLimitStates.bending.demand;
      } else if (governing === "shear") {
        updated.controllingStrength = updated.beamLimitStates.shear.capacity;
        updated.demand = updated.beamLimitStates.shear.demand;
      } else {
        updated.controllingStrength = updated.beamLimitStates.deflection.capacity;
        updated.demand = updated.beamLimitStates.deflection.demand;
      }
    }
    return { s: chosen, check: updated };
  }, [
    mode,
    derivedFromLoads,
    deadLoadKft,
    liveLoadKft,
    spanFt,
    mat,
    designMethod,
    lateralSpacingA,
    bracingHeightH,
    designShearShapeName,
    webType,
  ]);

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
    setMu("0");
    setVu("0");
    setL("360");
    setWLive("0");
    setDeadLoadKft("");
    setLiveLoadKft("");
    setSpanFt("");
    setDeflectionSpanFt("");
    setDeflectionLiveKlf("");
    setWebType("unstiffened");
    setLateralSpacingA("10");
    setBracingHeightH("");
    setDesignShearShapeName("W21X44");
    setMode("check");
  };

  const invalid = (v: string, min = 0, allowBlank = false) => {
    if (allowBlank && v.trim() === "") return false;
    const n = Number(v);
    return !Number.isFinite(n) || n < min;
  };
  const sectionNavItems =
    mode === "check"
      ? [
          { id: "beam-general", label: "ANALYSIS OF BEAM" },
          { id: "beam-bending", label: "Bending moment capacity" },
          { id: "beam-shear", label: "Shear capacity" },
          { id: "beam-deflection", label: "Maximum deflection" },
          { id: "beam-steps", label: "Steps" },
        ]
      : [
          { id: "beam-general", label: "DESIGN OF BEAM" },
          { id: "beam-loads", label: "Design Parameters" },
          { id: "beam-design-result", label: "AISC Section" },
        ];
  const resultAnchorId = mode === "design" ? "beam-design-result" : "results";

  return (
    <AppShell>
      <Card>
        <CardHeader
          title="Bending, Shear, and Deflection"
          description=""
        />
        <CardBody className="grid gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-12 md:hidden">
            <PageSectionNav sections={sectionNavItems} />
          </div>
          <div className="md:col-span-8 grid gap-4">
            <details open className="rounded-2xl border border-slate-200 bg-white" id="beam-general">
              <summary className="min-h-11 cursor-pointer px-4 py-3.5 text-sm font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 sm:px-5 sm:py-4">
                {mode === "check" ? "ANALYSIS OF BEAM" : "DESIGN OF BEAM"}
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  NOTE:  BLUE FONTS INDICATE USERS INPUT!!
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Units: ksi
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Steel Type" hint="">
                    <SelectInput value={material} onChange={(v) => setMaterial(v as SteelMaterialKey)}>
                      {steelMaterials.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} (Fy = {m.Fy} ksi)
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  {mode === "check" ? (
                    <Field
                      label="Structural Member"
                      hint=""
                    >
                      <SelectInput value={shapeName} onChange={setShapeName}>
                        {shapeOptions.map((s) => (
                          <option key={s.shape} value={s.shape}>
                            {s.shape}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Design Parameters" hint="">
                    <SelectInput value={mode} onChange={(v) => setMode(v as "check" | "design")}>
                      <option value="check">ANALYSIS OF BEAM</option>
                      <option value="design">DESIGN OF BEAM</option>
                    </SelectInput>
                  </Field>
                  <Field label="Design Philosophy:" hint="">
                    <SelectInput value={designMethod} onChange={(v) => setDesignMethod(v as "LRFD" | "ASD")}>
                      <option value="LRFD">LRFD</option>
                      <option value="ASD">ASD</option>
                    </SelectInput>
                  </Field>
                </div>

                {mode === "check" && shape ? (
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

            {mode === "check" && slenderness ? (
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
                      <p className="text-slate-900">Class: {slenderness.flange.class}</p>
                    </div>
                    <div>
                      <p className="font-semibold">{slenderness.web.label}</p>
                      <p>λ = {slenderness.web.lambda.toFixed(2)}, λ_p = {slenderness.web.lambdaP.toFixed(3)}, λ_r = {slenderness.web.lambdaR.toFixed(3)}</p>
                      <p className="text-slate-900">Class: {slenderness.web.class}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {mode === "design" ? (
              <details open className="rounded-2xl border border-slate-200 bg-white" id="beam-loads">
                <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                  Design Parameters
                  <span className="mt-1 block text-xs font-semibold text-slate-600">
                    NOTE: BLUE FONTS INDICATE USERS INPUT!!
                  </span>
                  <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    Units: k/ft, ft
                  </span>
                </summary>
                <div className="border-t border-slate-200 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Dead Load (kips/ft)" hint="">
                      <TextInputWithUnit
                        value={deadLoadKft}
                        onChange={setDeadLoadKft}
                        unit="k/ft"
                        placeholder="e.g. 0.8"
                        inputMode="decimal"
                        className={editableInputClass}
                      />
                    </Field>
                    <Field label="Live Load (kips/ft)" hint="">
                      <TextInputWithUnit
                        value={liveLoadKft}
                        onChange={setLiveLoadKft}
                        unit="k/ft"
                        placeholder="e.g. 2"
                        inputMode="decimal"
                        className={editableInputClass}
                      />
                    </Field>
                    <Field label="Span (ft.)" hint="">
                      <TextInputWithUnit
                        value={spanFt}
                        onChange={(v) => {
                          setSpanFt(v);
                          const ft = Number(v);
                          if (Number.isFinite(ft) && ft > 0) setL(String(ft * 12));
                        }}
                        unit="ft"
                        placeholder="e.g. 35"
                        className={editableInputClass}
                      />
                    </Field>
                    <Field label="Type of web (shear)" hint="">
                      <SelectInput value={webType} onChange={(v) => setWebType(v as "unstiffened" | "stiffened")} className={editableInputClass}>
                        <option value="unstiffened">Unstiffened</option>
                        <option value="stiffened">Stiffened</option>
                      </SelectInput>
                    </Field>
                    <Field label="Lateral spacing, a (in.)" hint="">
                      <TextInputWithUnit value={lateralSpacingA} onChange={setLateralSpacingA} unit="in" inputMode="decimal" className={editableInputClass} />
                    </Field>
                    <Field label="Height of bracing, h (in.)" hint="Defaults to section web depth per trial shape when blank.">
                      <TextInputWithUnit value={bracingHeightH} onChange={setBracingHeightH} unit="in" inputMode="decimal" className={editableInputClass} />
                    </Field>
                    <Field label="Shear reference member (design parity)" hint="Matches workbook J5 / shear block used in design capacity row.">
                      <SelectInput value={designShearShapeName} onChange={setDesignShearShapeName} className={editableInputClass}>
                        {designShearShapeOptions.map((s) => (
                          <option key={s.shape} value={s.shape}>
                            {s.shape}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>

                  {derivedFromLoads ? (
                    <Card className="mt-4 border-[color:var(--brand)]/20 bg-[color:var(--brand)]/5">
                      <CardBody className="space-y-1 text-sm text-slate-900">
                        <p className="font-bold">Derived from your loads ({designMethod}) — slab/dead only in strength w</p>
                        <p className="tabular-nums">
                          w for strength = {derivedFromLoads.wStrengthKlf.toFixed(3)} k/ft
                          {designMethod === "LRFD" ? " (LRFD factored; beam weight added per trial section)" : " (ASD D + L incl. trial beam weight)"}
                        </p>
                        <p className="tabular-nums">
                          Trial M_u = {derivedFromLoads.MuDer.toFixed(3)} kip·ft · Trial V_u = {derivedFromLoads.VuDer.toFixed(3)} kips (before beam weight)
                        </p>
                        <p className="tabular-nums">
                          Service live load for δ check = {derivedFromLoads.wServiceKipIn.toFixed(6)} k/ft
                        </p>
                      </CardBody>
                    </Card>
                  ) : (
                    <p className="mt-4 text-sm font-semibold text-amber-900">
                      Enter dead load, live load, and span (all positive numbers) to run workbook-style section selection. Deflection uses unfactored live load only (Excel convention).
                    </p>
                  )}
                </div>
              </details>
            ) : null}

            {mode === "check" ? (
              <>
                <details open className="rounded-2xl border border-slate-200 bg-white" id="beam-bending">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                    Bending moment capacity
                    <span className="mt-1 block text-xs font-semibold text-slate-600">
                      Uses Structural Member + Steel Type (above). Dead/live loads are not required to obtain φM_n / allowable moment.
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label="M_u (optional demand)"
                        hint="Leave 0 or blank to show capacity only. Enter a required moment (kip·ft) to see utilization."
                      >
                        <TextInputWithUnit value={Mu} onChange={setMu} unit="kip·ft" inputMode="decimal" className={editableInputClass} placeholder="0" />
                      </Field>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                      Capacities appear in results → Design strengths / Limit states when you scroll right.
                    </p>
                  </div>
                </details>

                <details open className="rounded-2xl border border-slate-200 bg-white" id="beam-shear">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                    Shear capacity
                    <span className="mt-1 block text-xs font-semibold text-slate-600">
                      W member + steel type + web type + lateral spacing a + height h (Excel shear worksheet).
                    </span>
                    <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      Units: kips, in.
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label="V_u (optional demand)"
                        hint="Leave 0 or blank for capacity only."
                      >
                        <TextInputWithUnit value={Vu} onChange={setVu} unit="kips" inputMode="decimal" className={editableInputClass} placeholder="0" />
                      </Field>
                      <Field label="Type of web" hint="">
                        <SelectInput value={webType} onChange={(v) => setWebType(v as "unstiffened" | "stiffened")} className={editableInputClass}>
                          <option value="unstiffened">Unstiffened</option>
                          <option value="stiffened">Stiffened</option>
                        </SelectInput>
                      </Field>
                      <Field
                        label="Lateral spacing, a (in.)"
                        hint="For stiffened web (stiffener spacing)."
                        error={invalid(lateralSpacingA, 0) ? "Enter a number > 0." : undefined}
                      >
                        <TextInputWithUnit value={lateralSpacingA} onChange={setLateralSpacingA} unit="in" inputMode="decimal" className={editableInputClass} />
                      </Field>
                      <Field
                        label="Height of bracing, h (in.)"
                        hint="Panel depth for a/h and k_v when stiffened; defaults to section clear web depth."
                        error={bracingHeightH.trim() !== "" && invalid(bracingHeightH, 0) ? "Enter a number > 0." : undefined}
                      >
                        <TextInputWithUnit value={bracingHeightH} onChange={setBracingHeightH} unit="in" inputMode="decimal" className={editableInputClass} />
                      </Field>
                      <Field label="Shear case (auto)" hint="">
                        <TextInput value={out?.beamLimitStates?.shear.cvCase ?? "-"} onChange={() => {}} disabled />
                      </Field>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                      Blue fields are user-editable.
                    </p>
                  </div>
                </details>

                <details open className="rounded-2xl border border-slate-200 bg-white" id="beam-deflection">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                    Maximum deflection
                    <span className="mt-1 block text-xs font-semibold text-slate-600">
                      Structural member + span + live load only (simply supported; δ matches workbook Q14 — LL in klf, span in ft; allowable L/360).
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Span (ft.)" hint="">
                        <TextInputWithUnit
                          value={deflectionSpanFt}
                          onChange={setDeflectionSpanFt}
                          unit="ft"
                          placeholder="e.g. 35"
                          inputMode="decimal"
                          className={editableInputClass}
                        />
                      </Field>
                      <Field label="Live Load (kips/ft)" hint="">
                        <TextInputWithUnit
                          value={deflectionLiveKlf}
                          onChange={setDeflectionLiveKlf}
                          unit="k/ft"
                          placeholder="e.g. 1"
                          inputMode="decimal"
                          className={editableInputClass}
                        />
                      </Field>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                      Leave blank to skip the deflection limit state in the summary (no δ check).
                    </p>
                  </div>
                </details>
              </>
            ) : null}

            {mode === "design" ? (
              <div id="beam-design-result">
              <Card className="border-slate-300 bg-white">
                <CardBody>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-800">Design of Beam (workbook section selection)</p>
                  {suggestion ? (
                    <>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{suggestion.s.shape}</p>
                      <p className="mt-1 text-base font-medium text-slate-800">
                        {suggestion.s.W} lb/ft, Zx = {suggestion.s.Zx.toFixed(1)} in³
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-rose-700">
                      No safe W-shape found for the current demand set. Reduce demand or revise inputs.
                    </p>
                  )}
                </CardBody>
              </Card>
              </div>
            ) : null}

            {mode === "check" && out ? (
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
            <div className="sticky top-6 md:top-[calc(var(--app-header-h,104px)+16px)] space-y-4">
              <div className="hidden md:block">
                <PageSectionNav sections={sectionNavItems} />
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
                      if (mode === "design") {
                        const lines: string[] = [
                          `Method: ${designMethod} · Material: ${mat.key} · Mode: Design`,
                          derivedFromLoads
                            ? `Loads: DL ${deadLoadKft} klf · LL ${liveLoadKft} klf · span ${spanFt} ft (trial sections include beam weight)`
                            : `Loads: enter DL, LL, span in Design Parameters`,
                        ];
                        if (suggestion) {
                          lines.push(
                            `Suggested: ${suggestion.s.shape}`,
                            `Weight: ${suggestion.s.W.toFixed(1)} plf`,
                            `Zx: ${suggestion.s.Zx.toFixed(1)} in^3`,
                          );
                        } else {
                          lines.push("Suggested: none (no safe W-shape found)");
                        }
                        return { title: "Beam — Design", lines };
                      }
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
                    if (mode === "design") {
                      const lines = [
                        "Beam — Design",
                        `Method: ${designMethod}`,
                        `Material: ${mat.key}`,
                        derivedFromLoads
                          ? `DL ${deadLoadKft} klf · LL ${liveLoadKft} klf · span ${spanFt} ft`
                          : "Loads: (enter DL, LL, span)",
                      ];
                      if (suggestion) {
                        lines.push(
                          `Suggested: ${suggestion.s.shape}`,
                          `Weight: ${suggestion.s.W.toFixed(1)} plf`,
                          `Zx: ${suggestion.s.Zx.toFixed(1)} in^3`,
                        );
                      } else {
                        lines.push("Suggested: none (no safe W-shape found)");
                      }
                      return lines.join("\n");
                    }
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
                  onGoResults={() => scrollTo(resultAnchorId)}
                  onGoSteps={() => scrollTo("beam-steps")}
                    json={{
                    data: {
                      result: mode === "design" ? suggestion?.check ?? null : out,
                      inputs: {
                        material,
                        shapeName,
                        Mu,
                        Vu,
                        L,
                        wLive,
                        deflectionSpanFt,
                        deflectionLiveKlf,
                        deadLoadKft,
                        liveLoadKft,
                        spanFt,
                        designMethod,
                        webType,
                        lateralSpacingA,
                        bracingHeightH,
                        mode,
                      },
                    },
                  }}
                  onReset={resetInputs}
                />
                {mode === "check" && out?.governingCase === "geometry_error" ? (
                  <Card className="border-red-300 bg-red-50">
                    <CardBody className="text-sm text-red-950">
                      <p className="font-semibold">Cannot run analysis</p>
                      <p className="mt-1">{String(out.steps[0]?.value ?? "")}</p>
                    </CardBody>
                  </Card>
                ) : null}
                <div id="results">
                {mode === "design" && suggestion?.check?.beamLimitStates ? (
                  <ResultHero
                    status={suggestion.check.isSafe ? "safe" : "unsafe"}
                    governing={suggestion.check.beamLimitStates.governing}
                    capacityLabel="Max utilization (trial section)"
                    capacity={`${(
                      Math.max(
                        suggestion.check.beamLimitStates.bending.ratio,
                        suggestion.check.beamLimitStates.shear.ratio,
                        suggestion.check.beamLimitStates.deflection.ratio,
                      ) * 100
                    ).toFixed(1)}%`}
                    demandLabel="Lightest W"
                    demand={suggestion.s.shape}
                    utilization={Math.max(
                      suggestion.check.beamLimitStates.bending.ratio,
                      suggestion.check.beamLimitStates.shear.ratio,
                      suggestion.check.beamLimitStates.deflection.ratio,
                    )}
                  />
                ) : null}

                {mode === "check" && out ? (
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
                ) : null}
                </div>

                {mode === "design" && suggestion?.check?.beamLimitStates ? (
                  <Card>
                    <CardBody className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Limit states — {suggestion.s.shape} (strength w includes beam weight)
                      </p>
                      <LimitRow
                        title="Bending"
                        demand={suggestion.check.beamLimitStates.bending.demand}
                        capacity={suggestion.check.beamLimitStates.bending.capacity}
                        ratio={suggestion.check.beamLimitStates.bending.ratio}
                        unit={suggestion.check.beamLimitStates.bending.unit}
                      />
                      <LimitRow
                        title={`Shear (${suggestion.check.beamLimitStates.shear.cvCase}, C_v = ${suggestion.check.beamLimitStates.shear.cv.toFixed(4)})`}
                        demand={suggestion.check.beamLimitStates.shear.demand}
                        capacity={suggestion.check.beamLimitStates.shear.capacity}
                        ratio={suggestion.check.beamLimitStates.shear.ratio}
                        unit={suggestion.check.beamLimitStates.shear.unit}
                      />
                      <LimitRow
                        title="Deflection (live load · L/360)"
                        demand={suggestion.check.beamLimitStates.deflection.demand}
                        capacity={suggestion.check.beamLimitStates.deflection.capacity}
                        ratio={suggestion.check.beamLimitStates.deflection.ratio}
                        unit={suggestion.check.beamLimitStates.deflection.unit}
                      />
                    </CardBody>
                  </Card>
                ) : null}

                {mode === "check" && out?.beamLimitStates && out.governingCase !== "geometry_error" ? (
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
                        title="Deflection (live load · L/360)"
                        demand={out.beamLimitStates.deflection.demand}
                        capacity={out.beamLimitStates.deflection.capacity}
                        ratio={out.beamLimitStates.deflection.ratio}
                        unit={out.beamLimitStates.deflection.unit}
                      />
                    </CardBody>
                  </Card>
                ) : null}

                {mode === "design" && suggestion?.check?.results ? (
                  <Card>
                    <CardBody>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Design strengths — {suggestion.s.shape}
                      </p>
                      <div className="mt-3 space-y-2">
                        {Object.entries(suggestion.check.results).map(([key, value]) => (
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
                ) : null}

                {mode === "check" && out ? (
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
                ) : null}
            </div>
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
          if (mode === "design") {
            const lines = [
              "Beam — Design",
              `Method: ${designMethod}`,
              `Material: ${mat.key}`,
              derivedFromLoads
                ? `DL ${deadLoadKft} klf · LL ${liveLoadKft} klf · span ${spanFt} ft`
                : "Loads: (enter DL, LL, span)",
            ];
            if (suggestion) {
              lines.push(
                `Suggested: ${suggestion.s.shape}`,
                `Weight: ${suggestion.s.W.toFixed(1)} plf`,
                `Zx: ${suggestion.s.Zx.toFixed(1)} in^3`,
              );
            } else {
              lines.push("Suggested: none (no safe W-shape found)");
            }
            return lines.join("\n");
          }
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
        json={{
          data: {
            result: mode === "design" ? suggestion?.check ?? null : out,
            inputs: {
              material,
              shapeName,
              Mu,
              Vu,
              L,
              wLive,
              deflectionSpanFt,
              deflectionLiveKlf,
              deadLoadKft,
              liveLoadKft,
              spanFt,
              designMethod,
              webType,
              lateralSpacingA,
              bracingHeightH,
              mode,
            },
          },
        }}
        compare={{
          storageKey: "ssc:compare:beam",
          getCurrent: () => {
            if (mode === "design") {
              const lines: string[] = [
                `Method: ${designMethod} · Material: ${mat.key} · Mode: Design`,
                derivedFromLoads
                  ? `Loads: DL ${deadLoadKft} klf · LL ${liveLoadKft} klf · span ${spanFt} ft`
                  : `Loads: enter DL, LL, span`,
              ];
              if (suggestion) {
                lines.push(`Suggested: ${suggestion.s.shape}`, `Weight: ${suggestion.s.W.toFixed(1)} plf`);
              } else {
                lines.push("Suggested: none");
              }
              return { title: "Beam — Design", lines };
            }
            const gov = out?.beamLimitStates?.governing ?? out?.governingCase ?? "—";
            const lines: string[] = [
              `Method: ${designMethod} · Material: ${mat.key} · Mode: ${mode}`,
              `Shape: ${shapeName}`,
              `Mu: ${Mu} kip-ft · Vu: ${Vu} kips`,
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

function fmtInches(n: number, decimals = 5): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function fmtFeet(n: number, decimals = 6): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function LimitRow(props: {
  title: string;
  demand: number;
  capacity: number;
  ratio: number;
  unit: string;
}) {
  const fmtDem =
    props.unit === "kip-ft"
      ? fmtKipFt(props.demand)
      : props.unit === "in"
        ? fmtInches(props.demand)
        : props.unit === "ft"
          ? fmtFeet(props.demand)
          : fmtKips(props.demand);
  const fmtCap =
    props.unit === "kip-ft"
      ? fmtKipFt(props.capacity)
      : props.unit === "in"
        ? fmtInches(props.capacity)
        : props.unit === "ft"
          ? fmtFeet(props.capacity)
          : fmtKips(props.capacity);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{props.title}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-700">
        <span className="tabular-nums">
          Demand {fmtDem} / Capacity {fmtCap} {props.unit}
        </span>
        <span className="font-semibold tabular-nums text-slate-900">{(props.ratio * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-2">
        <UtilizationBar ratio={props.ratio} />
      </div>
    </div>
  );
}









