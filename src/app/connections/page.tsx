"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  calculateBoltShearBearingCombinedLRFD,
  calculateBoltShearTensionInteractionLRFD,
  calculateBoltSlipCritical,
  calculateBoltTensionLRFD,
  calculateFilletWeldLRFD,
  filletWeldMinLegInForDemand,
  lrfdToAsdSamePhiOmega,
} from "@/lib/calculations/connections";
import {
  approximateMinPlateThicknessForPryingLRFD,
  calculateGrooveWeldShearLRFD,
} from "@/lib/calculations/connections-advanced";
import { boltDiametersIn, type BoltGroup, type BoltThreadMode } from "@/lib/data/bolts";
import { ExportJsonButton } from "@/components/ExportJsonButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { STORAGE } from "@/lib/storage/keys";

export default function ConnectionsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [designMethod, setDesignMethod] = useState<"LRFD" | "ASD">("LRFD");
  const [shearMode, setShearMode] = useState<"bearing" | "slip">("bearing");
  const [surfaceClass, setSurfaceClass] = useState<"A" | "B">("A");
  const [slipHf, setSlipHf] = useState("1");
  const [vu, setVu] = useState("120");
  const [tu, setTu] = useState("0");
  const [boltGroup, setBoltGroup] = useState<BoltGroup>("A325");
  const [dBolt, setDBolt] = useState("0.75");
  const [nBolts, setNBolts] = useState("4");
  const [shearPlanes, setShearPlanes] = useState<"1" | "2">("2");
  const [threadMode, setThreadMode] = useState<BoltThreadMode>("N");

  const [checkBearing, setCheckBearing] = useState(true);
  const [plateFu, setPlateFu] = useState("65");
  const [plateT, setPlateT] = useState("0.5");
  const [lcMin, setLcMin] = useState("1.25");

  const [fexx, setFexx] = useState("70");
  const [legIn, setLegIn] = useState("0.25");
  const [weldLen, setWeldLen] = useState("4");
  const [weldDemand, setWeldDemand] = useState("50");

  /** Groove/CJP weld metal in shear on user-entered effective throat × length. */
  const [grooveThroatIn, setGrooveThroatIn] = useState("0.25");
  const [grooveLenIn, setGrooveLenIn] = useState("4");
  const [grooveDemand, setGrooveDemand] = useState("50");
  /** Blank → use T_u / n when T_u &gt; 0. */
  const [pryingTPerBoltOverride, setPryingTPerBoltOverride] = useState("");
  const [pryingBPrimeIn, setPryingBPrimeIn] = useState("1.5");
  const [pryingStripWidthIn, setPryingStripWidthIn] = useState("4");
  const [pryingFyKsi, setPryingFyKsi] = useState("50");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE.connections);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const p = JSON.parse(raw) as Record<string, string>;
      if (typeof p.designMethod === "string") setDesignMethod(p.designMethod as "LRFD" | "ASD");
      if (typeof p.shearMode === "string") setShearMode(p.shearMode as "bearing" | "slip");
      if (typeof p.surfaceClass === "string") setSurfaceClass(p.surfaceClass as "A" | "B");
      if (typeof p.slipHf === "string") setSlipHf(p.slipHf);
      if (typeof p.vu === "string") setVu(p.vu);
      if (typeof p.tu === "string") setTu(p.tu);
      if (typeof p.boltGroup === "string") setBoltGroup(p.boltGroup as BoltGroup);
      if (typeof p.dBolt === "string") setDBolt(p.dBolt);
      if (typeof p.nBolts === "string") setNBolts(p.nBolts);
      if (typeof p.shearPlanes === "string") setShearPlanes(p.shearPlanes as "1" | "2");
      if (typeof p.threadMode === "string") setThreadMode(p.threadMode as BoltThreadMode);
      if (typeof p.checkBearing === "boolean") setCheckBearing(p.checkBearing);
      if (typeof p.plateFu === "string") setPlateFu(p.plateFu);
      if (typeof p.plateT === "string") setPlateT(p.plateT);
      if (typeof p.lcMin === "string") setLcMin(p.lcMin);
      if (typeof p.fexx === "string") setFexx(p.fexx);
      if (typeof p.legIn === "string") setLegIn(p.legIn);
      if (typeof p.weldLen === "string") setWeldLen(p.weldLen);
      if (typeof p.weldDemand === "string") setWeldDemand(p.weldDemand);
      if (typeof p.grooveThroatIn === "string") setGrooveThroatIn(p.grooveThroatIn);
      if (typeof p.grooveLenIn === "string") setGrooveLenIn(p.grooveLenIn);
      if (typeof p.grooveDemand === "string") setGrooveDemand(p.grooveDemand);
      if (typeof p.pryingTPerBoltOverride === "string") setPryingTPerBoltOverride(p.pryingTPerBoltOverride);
      if (typeof p.pryingBPrimeIn === "string") setPryingBPrimeIn(p.pryingBPrimeIn);
      if (typeof p.pryingStripWidthIn === "string") setPryingStripWidthIn(p.pryingStripWidthIn);
      if (typeof p.pryingFyKsi === "string") setPryingFyKsi(p.pryingFyKsi);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload = {
      designMethod,
      shearMode,
      surfaceClass,
      slipHf,
      vu,
      tu,
      boltGroup,
      dBolt,
      nBolts,
      shearPlanes,
      threadMode,
      checkBearing,
      plateFu,
      plateT,
      lcMin,
      fexx,
      legIn,
      weldLen,
      weldDemand,
      grooveThroatIn,
      grooveLenIn,
      grooveDemand,
      pryingTPerBoltOverride,
      pryingBPrimeIn,
      pryingStripWidthIn,
      pryingFyKsi,
    };
    try {
      localStorage.setItem(STORAGE.connections, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [
    hydrated,
    designMethod,
    shearMode,
    surfaceClass,
    slipHf,
    vu,
    tu,
    boltGroup,
    dBolt,
    nBolts,
    shearPlanes,
    threadMode,
    checkBearing,
    plateFu,
    plateT,
    lcMin,
    fexx,
    legIn,
    weldLen,
    weldDemand,
    grooveThroatIn,
    grooveLenIn,
    grooveDemand,
    pryingTPerBoltOverride,
    pryingBPrimeIn,
    pryingStripWidthIn,
    pryingFyKsi,
  ]);

  const boltOut = useMemo(() => {
    if (shearMode !== "bearing") return null;
    const demandVu = Number(vu);
    const n = Number(nBolts);
    const d = Number(dBolt);
    const t = Number(plateT);
    const lc = Number(lcMin);
    const fu = Number(plateFu);
    if (!Number.isFinite(demandVu) || !Number.isFinite(n) || !Number.isFinite(d) || n < 1 || d <= 0) return null;
    return calculateBoltShearBearingCombinedLRFD({
      demandVu,
      boltGroup,
      threadMode,
      dBolt: d,
      nBolts: Math.floor(n),
      shearPlanes: shearPlanes === "2" ? 2 : 1,
      includeBearing: checkBearing,
      lcMinIn: lc,
      plateThicknessIn: t,
      plateFuKsi: fu,
    });
  }, [shearMode, vu, boltGroup, threadMode, dBolt, nBolts, shearPlanes, checkBearing, plateT, lcMin, plateFu]);

  const slipOut = useMemo(() => {
    if (shearMode !== "slip") return null;
    const demandVu = Number(vu);
    const n = Number(nBolts);
    const d = Number(dBolt);
    const hf = Number(slipHf);
    if (!Number.isFinite(demandVu) || !Number.isFinite(n) || !Number.isFinite(d) || n < 1 || d <= 0) return null;
    if (!Number.isFinite(hf) || hf <= 0) return null;
    return calculateBoltSlipCritical({
      demandVu,
      boltGroup,
      dBolt: d,
      nBolts: Math.floor(n),
      slipPlanes: shearPlanes === "2" ? 2 : 1,
      surfaceClass,
      hf,
      designMethod,
    });
  }, [shearMode, vu, boltGroup, dBolt, nBolts, shearPlanes, surfaceClass, slipHf, designMethod]);

  const tensionOut = useMemo(() => {
    const demandTu = Number(tu);
    const n = Number(nBolts);
    const d = Number(dBolt);
    if (!Number.isFinite(demandTu) || demandTu < 0 || !Number.isFinite(n) || !Number.isFinite(d) || n < 1 || d <= 0) return null;
    return calculateBoltTensionLRFD({
      demandTu,
      boltGroup,
      threadMode,
      dBolt: d,
      nBolts: Math.floor(n),
    });
  }, [tu, boltGroup, threadMode, dBolt, nBolts]);

  const interactionOut = useMemo(() => {
    if (!tensionOut) return null;
    const demandVu = Number(vu);
    const demandTu = Number(tu);
    if (!Number.isFinite(demandVu) || !Number.isFinite(demandTu)) return null;
    let capShear = 0;
    if (shearMode === "slip") {
      if (!slipOut) return null;
      capShear = slipOut.availableSlip;
    } else {
      if (!boltOut) return null;
      capShear =
        designMethod === "LRFD"
          ? boltOut.phiRnTotalGoverning
          : lrfdToAsdSamePhiOmega(boltOut.phiRnTotalGoverning);
    }
    const capTension =
      designMethod === "LRFD" ? tensionOut.phiRnTotal : lrfdToAsdSamePhiOmega(tensionOut.phiRnTotal);
    return calculateBoltShearTensionInteractionLRFD({
      demandVu,
      demandTu,
      phiRnShearTotal: capShear,
      phiRnTensionTotal: capTension,
    });
  }, [shearMode, slipOut, boltOut, tensionOut, vu, tu, designMethod]);

  const weldOut = useMemo(() => {
    const f = Number(fexx);
    const a = Number(legIn);
    const L = Number(weldLen);
    const P = Number(weldDemand);
    if (!Number.isFinite(f) || !Number.isFinite(a) || !Number.isFinite(L) || !Number.isFinite(P) || f <= 0 || a <= 0 || L <= 0) return null;
    return calculateFilletWeldLRFD({ fexx: f, legIn: a, lengthIn: L, demand: P });
  }, [fexx, legIn, weldLen, weldDemand]);

  const weldDemandOk = useMemo(() => {
    if (!weldOut) return null;
    const P = Number(weldDemand);
    if (!Number.isFinite(P)) return null;
    const cap = designMethod === "LRFD" ? weldOut.phiRn : lrfdToAsdSamePhiOmega(weldOut.phiRn, 0.75, 2);
    return P <= cap;
  }, [weldOut, weldDemand, designMethod]);

  const weldMinLegIn = useMemo(() => {
    const P = Number(weldDemand);
    const L = Number(weldLen);
    const f = Number(fexx);
    if (!Number.isFinite(P) || !Number.isFinite(L) || !Number.isFinite(f) || L <= 0 || P <= 0) return null;
    return filletWeldMinLegInForDemand(P, f, L);
  }, [weldDemand, weldLen, fexx]);

  /** T per bolt for prying helper: optional override, else T_u / n when T_u &gt; 0. */
  const pryingTPerBoltKips = useMemo(() => {
    const o = pryingTPerBoltOverride.trim();
    if (o !== "") {
      const v = Number(o);
      if (Number.isFinite(v) && v > 0) return v;
      return null;
    }
    const Tu = Number(tu);
    const n = Math.floor(Number(nBolts));
    if (Number.isFinite(Tu) && Tu > 0 && Number.isFinite(n) && n >= 1) return Tu / n;
    return null;
  }, [pryingTPerBoltOverride, tu, nBolts]);

  const grooveOut = useMemo(() => {
    const f = Number(fexx);
    const t = Number(grooveThroatIn);
    const L = Number(grooveLenIn);
    const P = Number(grooveDemand);
    if (!Number.isFinite(f) || !Number.isFinite(t) || !Number.isFinite(L) || !Number.isFinite(P) || f <= 0 || t <= 0 || L <= 0)
      return null;
    return calculateGrooveWeldShearLRFD({
      fexx: f,
      effectiveThroatIn: t,
      lengthIn: L,
      demandKips: P,
      designMethod,
    });
  }, [fexx, grooveThroatIn, grooveLenIn, grooveDemand, designMethod]);

  const pryingOut = useMemo(() => {
    if (pryingTPerBoltKips == null) return null;
    const b = Number(pryingBPrimeIn);
    const w = Number(pryingStripWidthIn);
    const fy = Number(pryingFyKsi);
    if (!Number.isFinite(b) || !Number.isFinite(w) || !Number.isFinite(fy) || b <= 0 || w <= 0 || fy <= 0) return null;
    return approximateMinPlateThicknessForPryingLRFD({
      boltTensionDemandKips: pryingTPerBoltKips,
      bPrimeIn: b,
      stripWidthIn: w,
      fyKsi: fy,
    });
  }, [pryingTPerBoltKips, pryingBPrimeIn, pryingStripWidthIn, pryingFyKsi]);

  /** Design: min bolts for T_u alone (same d, group); compare to shear/slip suggestions below. */
  const tensionNBoltsSuggested = useMemo(() => {
    if (!tensionOut) return null;
    const Tu = Number(tu);
    if (!Number.isFinite(Tu) || Tu <= 0) return null;
    const nInt = Math.max(1, Math.floor(Number(nBolts)));
    const capTotal =
      designMethod === "LRFD" ? tensionOut.phiRnTotal : lrfdToAsdSamePhiOmega(tensionOut.phiRnTotal);
    const perBolt = capTotal / nInt;
    if (perBolt <= 0) return null;
    return Math.max(1, Math.ceil(Tu / perBolt));
  }, [tensionOut, tu, nBolts, designMethod]);

  /** Upper bound on bolt count when one row shares shear + tension (does not replace interaction check). */
  const unifiedNBoltsSuggested = useMemo(() => {
    const parts: number[] = [];
    if (shearMode === "slip" && slipOut) parts.push(slipOut.nBoltsRequired);
    if (shearMode === "bearing" && boltOut) parts.push(boltOut.nBoltsRequiredGoverning);
    if (tensionNBoltsSuggested != null) parts.push(tensionNBoltsSuggested);
    if (parts.length === 0) return null;
    return Math.max(...parts);
  }, [shearMode, slipOut, boltOut, tensionNBoltsSuggested]);

  const shearAdequate = useMemo(() => {
    if (shearMode === "slip") {
      if (!slipOut) return null;
      return slipOut.isSafe;
    }
    if (!boltOut) return null;
    const cap =
      designMethod === "LRFD"
        ? boltOut.phiRnTotalGoverning
        : lrfdToAsdSamePhiOmega(boltOut.phiRnTotalGoverning);
    return Number(vu) <= cap;
  }, [shearMode, slipOut, boltOut, designMethod, vu]);

  const tensionAdequate = useMemo(() => {
    if (!tensionOut) return null;
    const cap =
      designMethod === "LRFD" ? tensionOut.phiRnTotal : lrfdToAsdSamePhiOmega(tensionOut.phiRnTotal);
    return Number(tu) <= cap;
  }, [tensionOut, designMethod, tu]);

  const csvRows = useMemo(() => {
    const rows: string[][] = [
      ["Category", "Item", "Value"],
      ["General", "Design method", designMethod],
      ["General", "Shear mode", shearMode],
      ["Shear", "V_u (kips)", vu],
      ["Tension", "T_u (kips)", tu],
      ["Bolt", "Group", boltGroup],
      ["Bolt", "Thread N/X", threadMode],
      ["Bolt", "d (in)", dBolt],
      ["Bolt", "n", nBolts],
      ["Bolt", "Shear planes", shearPlanes],
      ["Plate", "F_u (ksi)", plateFu],
      ["Plate", "t (in)", plateT],
      ["Plate", "L_c min (in)", lcMin],
    ];
    if (shearMode === "slip" && slipOut) {
      rows.push(["Slip", "Available slip (kips)", String(slipOut.availableSlip.toFixed(3))]);
      rows.push(["Slip", "T_b (kips)", String(slipOut.Tb.toFixed(0))]);
    }
    if (boltOut) {
      rows.push(["Result", "phi R_n governing (kips)", String(boltOut.phiRnTotalGoverning.toFixed(3))]);
      rows.push(["Result", "Controlling", boltOut.controlling]);
    }
    if (tensionOut) {
      rows.push(["Result", "F_nt (ksi)", String(tensionOut.Fnt.toFixed(0))]);
      rows.push(["Result", "phi R_n tension total (kips)", String(tensionOut.phiRnTotal.toFixed(3))]);
    }
    if (interactionOut) {
      rows.push(["Interaction", "(Vu/phiVn)^2+(Tu/phiTn)^2", String(interactionOut.interactionSum.toFixed(4))]);
      rows.push(["Interaction", "OK", interactionOut.isSafe ? "yes" : "no"]);
    }
    if (weldOut) {
      rows.push(["Weld", "phi R_n (kips)", String(weldOut.phiRn.toFixed(3))]);
    }
    if (grooveOut) {
      rows.push(["Groove weld", "A_w (in²)", String(grooveOut.AwIn2.toFixed(4))]);
      rows.push(["Groove weld", "R_n (kips)", String(grooveOut.RnKips.toFixed(3))]);
      rows.push(["Groove weld", designMethod === "LRFD" ? "φR_n or R_a (kips)" : "R_a (kips)", String(grooveOut.phiRnOrAllowableKips.toFixed(3))]);
      rows.push(["Groove weld", "OK", grooveOut.isSafe ? "yes" : "no"]);
    }
    if (pryingOut && pryingTPerBoltKips != null) {
      rows.push(["Prying (approx)", "T/bolt used (kips)", String(pryingTPerBoltKips.toFixed(4))]);
      rows.push(["Prying (approx)", "t_min (in)", String(pryingOut.tMinApproxIn.toFixed(4))]);
    }
    return rows;
  }, [
    vu,
    tu,
    boltGroup,
    threadMode,
    dBolt,
    nBolts,
    shearPlanes,
    plateFu,
    plateT,
    lcMin,
    shearMode,
    slipOut,
    boltOut,
    tensionOut,
    interactionOut,
    weldOut,
    designMethod,
    grooveOut,
    pryingOut,
    pryingTPerBoltKips,
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardHeader
          title="Bolted & welded connections"
          description="LRFD or ASD — bolts, welds, and optional groove/prying helpers. Inputs auto-save in this browser."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <ExportCsvButton filename="connections-export.csv" rows={csvRows} />
              <ExportJsonButton
                label="Copy JSON"
                data={{
                  bolt: boltOut,
                  slip: slipOut,
                  tension: tensionOut,
                  interaction: interactionOut,
                  weld: weldOut,
                  grooveWeld: grooveOut,
                  pryingPlate: pryingOut,
                  inputs: {
                    designMethod,
                    shearMode,
                    surfaceClass,
                    slipHf,
                    vu,
                    tu,
                    boltGroup,
                    threadMode,
                    dBolt,
                    nBolts,
                    shearPlanes,
                    checkBearing,
                    plateFu,
                    plateT,
                    lcMin,
                    fexx,
                    legIn,
                    weldLen,
                    weldDemand,
                    grooveThroatIn,
                    grooveLenIn,
                    grooveDemand,
                    pryingTPerBoltOverride,
                    pryingBPrimeIn,
                    pryingStripWidthIn,
                    pryingFyKsi,
                  },
                }}
              />
              <Link href="/info" className="text-sm font-medium text-slate-600 hover:underline">
                Info
              </Link>
              <Link href="/" className="text-sm font-medium text-blue-700 hover:underline">
                Back
              </Link>
            </div>
          }
        />
        <CardBody className="flex flex-col gap-10 p-4 sm:p-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6">
            <h2 className="text-base font-bold uppercase tracking-wide text-slate-500">1 · Demands &amp; bolt layout</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Choose <strong>bearing-type</strong> (shear in bolts/plate) or <strong>slip-critical</strong> (friction). Slip
              uses J3.8; with <strong>T_u &gt; 0</strong> on slip-critical, check J3.9 reduction outside this tool.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Shear transfer" hint="Slip-critical uses Table J3.1 T_b; use A325/A490.">
                <SelectInput value={shearMode} onChange={(v) => setShearMode(v as "bearing" | "slip")}>
                  <option value="bearing">Bearing-type (shear + optional bearing)</option>
                  <option value="slip">Slip-critical (J3.8)</option>
                </SelectInput>
              </Field>
              <Field label="Design method" hint="LRFD default; ASD uses R_n/Ω for checks.">
                <SelectInput value={designMethod} onChange={(v) => setDesignMethod(v as "LRFD" | "ASD")}>
                  <option value="LRFD">LRFD</option>
                  <option value="ASD">ASD</option>
                </SelectInput>
              </Field>
              <Field label="Required shear V_u" hint="kips — on bolt group">
                <TextInput value={vu} onChange={setVu} placeholder="e.g. 120" />
              </Field>
              <Field label="Required tension T_u" hint="kips — on bolt group (0 if shear-only)">
                <TextInput value={tu} onChange={setTu} placeholder="0" />
              </Field>
              <Field label="Bolt ASTM type" hint={shearMode === "slip" ? "Slip-critical: A325 or A490 (T_b from Table J3.1)." : "Table J3.2"}>
                <SelectInput value={boltGroup} onChange={(v) => setBoltGroup(v as BoltGroup)}>
                  <option value="A307">A307</option>
                  <option value="A325">A325</option>
                  <option value="A490">A490</option>
                </SelectInput>
              </Field>
              {shearMode === "slip" ? (
                <>
                  <Field label="Surface class (μ)" hint="Class A = 0.30, Class B = 0.50 (clean mill scale / blasted).">
                    <SelectInput value={surfaceClass} onChange={(v) => setSurfaceClass(v as "A" | "B")}>
                      <option value="A">Class A (μ = 0.30)</option>
                      <option value="B">Class B (μ = 0.50)</option>
                    </SelectInput>
                  </Field>
                  <Field label="Filler factor h_f" hint="1.0 typical; 0.85 if two or more fillers (AISC).">
                    <TextInput value={slipHf} onChange={setSlipHf} placeholder="1" />
                  </Field>
                </>
              ) : null}
              <Field label="Threads in shear plane" hint="N vs X — affects F_nv and F_nt">
                <SelectInput value={threadMode} onChange={(v) => setThreadMode(v as BoltThreadMode)}>
                  <option value="N">N — threads in shear plane</option>
                  <option value="X">X — threads excluded from shear plane</option>
                </SelectInput>
              </Field>
              <Field label="Bolt diameter" hint="inches (body)">
                <SelectInput value={dBolt} onChange={setDBolt}>
                  {boltDiametersIn.map((d) => (
                    <option key={d} value={String(d)}>
                      {d} in (A_b = {(Math.PI * d * d / 4).toFixed(3)} in²)
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Number of bolts n" hint="Equal share">
                <TextInput value={nBolts} onChange={setNBolts} placeholder="e.g. 4" />
              </Field>
              <Field label="Shear planes per bolt" hint="Single = 1, double = 2">
                <SelectInput value={shearPlanes} onChange={(v) => setShearPlanes(v as "1" | "2")}>
                  <option value="1">1 (single shear)</option>
                  <option value="2">2 (double shear)</option>
                </SelectInput>
              </Field>
              {shearMode === "bearing" ? (
                <Field label="Include bearing check" hint="Uncheck for shear-only">
                  <SelectInput value={checkBearing ? "yes" : "no"} onChange={(v) => setCheckBearing(v === "yes")}>
                    <option value="yes">Yes (govern with shear)</option>
                    <option value="no">No (shear only)</option>
                  </SelectInput>
                </Field>
              ) : null}
              {shearMode === "bearing" ? (
                <>
                  <Field label="Plate F_u" hint="ksi">
                    <TextInput value={plateFu} onChange={setPlateFu} placeholder="65" />
                  </Field>
                  <Field label="Plate thickness t" hint="in">
                    <TextInput value={plateT} onChange={setPlateT} placeholder="0.5" />
                  </Field>
                  <Field
                    label="Min clear L_c"
                    hint="in — clear distance in load direction (J3.10(a)); governs bearing / hole tear-out vs 2.4 d t cap"
                  >
                    <TextInput value={lcMin} onChange={setLcMin} placeholder="1.25" />
                  </Field>
                </>
              ) : null}
            </div>
            {unifiedNBoltsSuggested != null || (weldOut && weldMinLegIn != null) ? (
              <Card className="border-blue-200 bg-blue-50/90">
                <CardBody className="space-y-2 text-sm text-blue-950">
                  <p className="font-bold">Design — quick answers (same checks as below)</p>
                  {unifiedNBoltsSuggested != null ? (
                    <p>
                      <span className="font-semibold">Bolts:</span> use at least{" "}
                      <span className="font-mono tabular-nums">n ≥ {unifiedNBoltsSuggested}</span> for the current V_u / T_u and
                      bolt layout (max of shear/slip, bearing, and tension-only estimates).
                      {tensionNBoltsSuggested != null && tensionNBoltsSuggested > 1 ? (
                        <span className="text-slate-700"> Tension alone would need n ≥ {tensionNBoltsSuggested}.</span>
                      ) : null}
                    </p>
                  ) : null}
                  {weldOut && weldMinLegIn != null && Number(weldDemand) > 0 ? (
                    <p>
                      <span className="font-semibold">Fillet weld:</span> min leg <span className="font-mono">a ≈ {weldMinLegIn.toFixed(4)} in</span> for
                      the stated demand at length {Number(weldLen).toFixed(2)} in — or increase length (see weld card).
                    </p>
                  ) : null}
                  <p className="text-xs text-blue-900/90">
                    Refine with the detailed cards; combined shear–tension interaction may require more bolts than each line
                    alone.
                  </p>
                </CardBody>
              </Card>
            ) : null}
            {shearMode === "slip" && boltGroup === "A307" ? (
              <p className="text-sm text-amber-800">
                Slip-critical pretension T_b is not tabulated for A307 in this tool — select A325 or A490.
              </p>
            ) : null}
            {shearMode === "slip" && Number(tu) > 0 ? (
              <p className="text-sm text-amber-800">
                Combined shear + tension on slip-critical: check J3.9 reduction on slip strength — interaction below uses
                unreduced slip capacity.
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-bold uppercase tracking-wide text-slate-500">2 · Bolt check results</h2>
            <p className="mt-1 text-sm text-slate-500">Capacities vs your V_u and T_u — interaction applies when T_u &gt; 0.</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {shearMode === "slip" && slipOut ? (
              <Card className="border-slate-200 bg-slate-50/80">
                <CardBody className="space-y-2 text-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Slip-critical (J3.8)</span>
                    {shearAdequate ? <Badge tone="good">ADEQUATE</Badge> : <Badge tone="bad">NOT ADEQUATE</Badge>}
                  </div>
                  <p>
                    T_b = {slipOut.Tb.toFixed(0)} kips, μ = {slipOut.mu.toFixed(2)}, R_n per bolt = {slipOut.rnPerBolt.toFixed(3)}{" "}
                    kips
                  </p>
                  <p className="font-semibold">
                    Available slip ({designMethod === "LRFD" ? "φR_n" : "R_n/Ω"}) = {slipOut.availableSlip.toFixed(3)} kips
                  </p>
                  <p className="font-semibold">Suggested n ≥ {slipOut.nBoltsRequired}</p>
                </CardBody>
              </Card>
            ) : null}
            {boltOut ? (
              <Card className="border-slate-200 bg-slate-50/80">
                <CardBody className="space-y-2 text-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Shear / bearing</span>
                    {shearAdequate ? <Badge tone="good">ADEQUATE</Badge> : <Badge tone="bad">NOT ADEQUATE</Badge>}
                  </div>
                  <p>
                    F_nv = {boltOut.shear.Fnv.toFixed(0)} ksi — φR_n (shear) = {boltOut.shear.phiRnTotal.toFixed(3)} kips
                  </p>
                  {boltOut.bearing ? (
                    <p>
                      φR_n (bearing) = {boltOut.bearing.phiRnTotal.toFixed(3)} kips ({boltOut.bearing.limit})
                    </p>
                  ) : (
                    <p className="text-slate-600">Bearing off.</p>
                  )}
                  <p className="font-semibold">
                    Governing {designMethod === "LRFD" ? "φR_n" : "R_a"} ={" "}
                    {(designMethod === "LRFD"
                      ? boltOut.phiRnTotalGoverning
                      : lrfdToAsdSamePhiOmega(boltOut.phiRnTotalGoverning)
                    ).toFixed(3)}{" "}
                    kips ({boltOut.controlling})
                  </p>
                  <p className="font-semibold">Suggested n = {boltOut.nBoltsRequiredGoverning}</p>
                </CardBody>
              </Card>
            ) : null}

            {tensionOut ? (
              <Card className="border-slate-200 bg-slate-50/80">
                <CardBody className="space-y-2 text-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Bolt tension (J3.6)</span>
                    {tensionAdequate ? <Badge tone="good">ADEQUATE</Badge> : <Badge tone="bad">NOT ADEQUATE</Badge>}
                  </div>
                  <p>
                    F_nt = {tensionOut.Fnt.toFixed(0)} ksi — {designMethod === "LRFD" ? "φR_n" : "R_a"} ={" "}
                    {(designMethod === "LRFD"
                      ? tensionOut.phiRnTotal
                      : lrfdToAsdSamePhiOmega(tensionOut.phiRnTotal)
                    ).toFixed(3)}{" "}
                    kips
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {interactionOut && Number(tu) > 0 ? (
              <div className="lg:col-span-2">
                <Card className="border-slate-200 bg-slate-50/80">
                  <CardBody className="space-y-2 text-sm text-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Shear + tension interaction</span>
                      {interactionOut.isSafe ? <Badge tone="good">OK</Badge> : <Badge tone="bad">EXCEEDED</Badge>}
                    </div>
                    <p>
                      Interaction sum = {interactionOut.interactionSum.toFixed(4)} (limit 1.0) — uses governing shear/bearing
                      and tension {designMethod === "LRFD" ? "φR" : "R_a"} capacities.
                    </p>
                    <p className="text-slate-600">
                      Cap_v ={" "}
                      {(shearMode === "slip" && slipOut
                        ? slipOut.availableSlip
                        : designMethod === "LRFD"
                          ? boltOut?.phiRnTotalGoverning
                          : boltOut && lrfdToAsdSamePhiOmega(boltOut.phiRnTotalGoverning)
                      )?.toFixed(3)}{" "}
                      kips; Cap_t ={" "}
                      {(designMethod === "LRFD"
                        ? tensionOut?.phiRnTotal
                        : tensionOut && lrfdToAsdSamePhiOmega(tensionOut.phiRnTotal)
                      )?.toFixed(3)}{" "}
                      kips
                    </p>
                  </CardBody>
                </Card>
              </div>
            ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6">
            <h2 className="text-base font-bold uppercase tracking-wide text-slate-500">3 · Fillet weld</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              R_n = 0.6 F_EXX (0.707 a) L; φ = 0.75. Electrode F_EXX is also used for optional groove checks below.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="F_EXX (electrode)" hint="ksi">
                <SelectInput value={fexx} onChange={setFexx}>
                  <option value="70">70 (E70XX)</option>
                  <option value="80">80 (E80XX)</option>
                </SelectInput>
              </Field>
              <Field label="Leg size a" hint="inches">
                <TextInput value={legIn} onChange={setLegIn} placeholder="0.25" />
              </Field>
              <Field label="Weld length L" hint="inches">
                <TextInput value={weldLen} onChange={setWeldLen} placeholder="4" />
              </Field>
              <Field label="Demand on weld" hint="kips">
                <TextInput value={weldDemand} onChange={setWeldDemand} placeholder="50" />
              </Field>
            </div>
            {weldOut ? (
              <Card className="mt-6 border-slate-200 bg-white shadow-sm">
                <CardBody className="space-y-2 text-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Fillet weld status</span>
                    {weldDemandOk ? <Badge tone="good">ADEQUATE</Badge> : <Badge tone="bad">NOT ADEQUATE</Badge>}
                  </div>
                  <p>
                    Throat = {weldOut.throat.toFixed(4)} in — {designMethod === "LRFD" ? "φR_n" : "R_a"} ={" "}
                    {(designMethod === "LRFD" ? weldOut.phiRn : lrfdToAsdSamePhiOmega(weldOut.phiRn, 0.75, 2)).toFixed(3)}{" "}
                    kips
                  </p>
                  <p className="font-semibold">Min length at this leg ≈ {weldOut.lengthRequiredIn.toFixed(3)} in</p>
                  {weldMinLegIn != null && Number(weldLen) > 0 ? (
                    <p className="text-slate-700">
                      Min leg a at this length for the demand ≈ {weldMinLegIn.toFixed(4)} in (LRFD φ = 0.75)
                    </p>
                  ) : null}
                </CardBody>
              </Card>
            ) : null}
          </section>

          <details className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 open:border-slate-400 open:bg-white">
            <summary className="cursor-pointer list-none px-5 py-4 text-base font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
              Optional — groove weld &amp; plate prying
              <span className="mt-1 block text-sm font-normal text-slate-600">
                CJP / groove metal in shear on an effective throat; simplified prying plate thickness (not full DG4).
              </span>
            </summary>
            <div className="space-y-8 border-t border-slate-200 px-5 pb-6 pt-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Groove weld (shear on throat)</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  R_n = 0.6 F_EXX A_w; uses the same electrode F_EXX as the fillet section ({fexx} ksi). Tension or compression
                  normal to the weld may govern separately.
                </p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Effective throat" hint="in — from detail">
                    <TextInput value={grooveThroatIn} onChange={setGrooveThroatIn} placeholder="0.25" />
                  </Field>
                  <Field label="Length L" hint="in — total effective length in shear">
                    <TextInput value={grooveLenIn} onChange={setGrooveLenIn} placeholder="4" />
                  </Field>
                  <Field label="Shear demand" hint="kips on weld group">
                    <TextInput value={grooveDemand} onChange={setGrooveDemand} placeholder="50" />
                  </Field>
                </div>
                {grooveOut ? (
                  <Card className="mt-4 border-slate-200 bg-white shadow-sm">
                    <CardBody className="space-y-2 text-sm text-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Groove weld metal (shear)</span>
                        {grooveOut.isSafe ? <Badge tone="good">ADEQUATE</Badge> : <Badge tone="bad">NOT ADEQUATE</Badge>}
                      </div>
                      <p>
                        A_w = {grooveOut.AwIn2.toFixed(4)} in² — R_n = {grooveOut.RnKips.toFixed(3)} kips —{" "}
                        {designMethod === "LRFD" ? "φR_n" : "R_a"} = {grooveOut.phiRnOrAllowableKips.toFixed(3)} kips
                      </p>
                      <p className="text-xs text-slate-600">{grooveOut.note}</p>
                    </CardBody>
                  </Card>
                ) : null}
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Prying — approximate plate thickness</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Plastic-hinge strip model (φ = 0.9 for plate yielding). Leave T/bolt blank to use T_u ÷ n when T_u &gt; 0.
                </p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <Field label="T per bolt (optional)" hint="kips — blank uses T_u / n">
                    <TextInput value={pryingTPerBoltOverride} onChange={setPryingTPerBoltOverride} placeholder="" />
                  </Field>
                  <Field label="b′ (lever arm)" hint="in — bolt line to hinge">
                    <TextInput value={pryingBPrimeIn} onChange={setPryingBPrimeIn} placeholder="1.5" />
                  </Field>
                  <Field label="Strip width w" hint="in — gage or tributary width">
                    <TextInput value={pryingStripWidthIn} onChange={setPryingStripWidthIn} placeholder="4" />
                  </Field>
                  <Field label="Plate F_y" hint="ksi">
                    <TextInput value={pryingFyKsi} onChange={setPryingFyKsi} placeholder="50" />
                  </Field>
                </div>
                {pryingOut && pryingTPerBoltKips != null ? (
                  <Card className="mt-4 border-slate-200 bg-white shadow-sm">
                    <CardBody className="space-y-2 text-sm text-slate-800">
                      <p>
                        <span className="font-semibold">T per bolt =</span> {pryingTPerBoltKips.toFixed(4)} kips —{" "}
                        <span className="font-semibold">t_min ≈</span> {pryingOut.tMinApproxIn.toFixed(4)} in
                      </p>
                      <p className="text-xs text-slate-600">{pryingOut.note}</p>
                    </CardBody>
                  </Card>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Enter T/bolt or set T_u and n so T/bolt can be inferred.</p>
                )}
              </div>
            </div>
          </details>
        </CardBody>
      </Card>
    </main>
  );
}
