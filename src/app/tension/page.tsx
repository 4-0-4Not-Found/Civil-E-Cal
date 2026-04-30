"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { STORAGE } from "@/lib/storage/keys";
import { AppShell } from "@/components/layout/AppShell";
import { ResultHero } from "@/components/results/ResultHero";
import { PageFooterNav } from "@/components/navigation/PageFooterNav";
import { TextInputWithUnit } from "@/components/ui/InputGroup";
import { Button } from "@/components/ui/Button";
import { UtilizationBar } from "@/components/ui/UtilizationBar";
import { CalculatorActionRail } from "@/components/actions/CalculatorActionRail";
import { PageSectionNav } from "@/components/navigation/PageSectionNav";
const toNumber = (v: string) => Number(v) || 0;
/** Client preference: ~3 decimals on final strengths / demands. */
const fmt = (n: number, digits = 3) => (Number.isFinite(n) ? n.toFixed(digits) : "-");

function parseInchSeries(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function netAreaFromPath(params: {
  grossWidth: number;
  holeDiameter: number;
  nHoles: number;
  thickness: number;
  sVals?: number[];
  gVals?: number[];
}) {
  const { grossWidth, holeDiameter, nHoles, thickness } = params;
  if (!(grossWidth > 0) || !(holeDiameter > 0) || !(nHoles >= 0) || !(thickness > 0)) return null;
  const sVals = params.sVals ?? [];
  const gVals = params.gVals ?? [];
  const pairCount = Math.min(sVals.length, gVals.length);
  let staggerAdd = 0;
  for (let i = 0; i < pairCount; i += 1) {
    const s = sVals[i];
    const g = gVals[i];
    if (!(s > 0) || !(g > 0)) continue;
    staggerAdd += (s * s) / (4 * g);
  }
  const netWidth = grossWidth - holeDiameter * nHoles + staggerAdd;
  const area = netWidth * thickness;
  return { netWidth, area, pairCount };
}

function isInvalidNumber(v: string, opts?: { min?: number; allowBlank?: boolean }) {
  const allowBlank = opts?.allowBlank ?? false;
  if (allowBlank && v.trim() === "") return false;
  const n = Number(v);
  if (!Number.isFinite(n)) return true;
  if (opts?.min != null && n < opts.min) return true;
  return false;
}

function scrollTo(id: string) {
  try {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  } catch {
    /* ignore */
  }
}

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
  const [designMinAg, setDesignMinAg] = useState("");
  const [designMinR, setDesignMinR] = useState("");
  const [useDesignFilters, setUseDesignFilters] = useState(false);
  const [comparisonVisibility, setComparisonVisibility] = useState<"show" | "hide">("hide");
  const [comparisonFilter, setComparisonFilter] = useState<"all" | "safe" | "unsafe">("all");
  const [blkVw, setBlkVw] = useState("");
  const [blkVdh, setBlkVdh] = useState("0.875");
  const [blkVn, setBlkVn] = useState("2");
  const [blkVt, setBlkVt] = useState("0.75");
  const [blkVs, setBlkVs] = useState("");
  const [blkVg, setBlkVg] = useState("");
  const [blkTw, setBlkTw] = useState("");
  const [blkTdh, setBlkTdh] = useState("0.875");
  const [blkTn, setBlkTn] = useState("1");
  const [blkTt, setBlkTt] = useState("0.75");
  const [blkTs, setBlkTs] = useState("");
  const [blkTg, setBlkTg] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE.tension);
      if (!raw) {
        queueMicrotask(() => setHydrated(true));
        return;
      }
      const p = JSON.parse(raw) as Record<string, string>;
      queueMicrotask(() => {
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
        if (typeof p.designMinAg === "string") setDesignMinAg(p.designMinAg);
        if (typeof p.designMinR === "string") setDesignMinR(p.designMinR);
        if (p.useDesignFilters === "yes" || p.useDesignFilters === "no") setUseDesignFilters(p.useDesignFilters === "yes");
        if (typeof p.blkVw === "string") setBlkVw(p.blkVw);
        if (typeof p.blkVdh === "string") setBlkVdh(p.blkVdh);
        if (typeof p.blkVn === "string") setBlkVn(p.blkVn);
        if (typeof p.blkVt === "string") setBlkVt(p.blkVt);
        if (typeof p.blkVs === "string") setBlkVs(p.blkVs);
        if (typeof p.blkVg === "string") setBlkVg(p.blkVg);
        if (typeof p.blkTw === "string") setBlkTw(p.blkTw);
        if (typeof p.blkTdh === "string") setBlkTdh(p.blkTdh);
        if (typeof p.blkTn === "string") setBlkTn(p.blkTn);
        if (typeof p.blkTt === "string") setBlkTt(p.blkTt);
        if (typeof p.blkTs === "string") setBlkTs(p.blkTs);
        if (typeof p.blkTg === "string") setBlkTg(p.blkTg);
      });
    } catch {
      /* ignore */
    }
    queueMicrotask(() => setHydrated(true));
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
      designMinAg,
      designMinR,
      useDesignFilters: useDesignFilters ? "yes" : "no",
      blkVw,
      blkVdh,
      blkVn,
      blkVt,
      blkVs,
      blkVg,
      blkTw,
      blkTdh,
      blkTn,
      blkTt,
      blkTs,
      blkTg,
    };
    try {
      setSaving(true);
      localStorage.setItem(STORAGE.tension, JSON.stringify(payload));
      const ts = Date.now();
      localStorage.setItem("ssc:ts:tension", String(ts));
      setSavedAt(ts);
    } catch {
      /* ignore */
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaving(false), 450);
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
    designMinAg,
    designMinR,
    useDesignFilters,
    blkVw,
    blkVdh,
    blkVn,
    blkVt,
    blkVs,
    blkVg,
    blkTw,
    blkTdh,
    blkTn,
    blkTt,
    blkTs,
    blkTg,
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
  const minAgFilter = toNumber(designMinAg);
  const minRFilter = toNumber(designMinR);
  const designPool = useMemo(() => {
    if (!useDesignFilters) return shapeChoices;
    return shapeChoices.filter((s) => s.A >= minAgFilter && Math.min(s.rx, s.ry) >= minRFilter);
  }, [shapeChoices, useDesignFilters, minAgFilter, minRFilter]);

  const designSuggestion = useMemo(() => {
    if (mode !== "design") return null;
    const demand = toNumber(Pu);
    const list = [...designPool].sort((a, b) => a.W - b.W);
    for (const s of list) {
      const r = calculateTensionDesign({
        designMethod,
        Fy: selectedMaterial.Fy,
        Fu: selectedMaterial.Fu,
        Ag: s.A,
        An: s.A,
        U: 1,
        demandPu: demand,
        // Client request: "Design (lightest)" should not depend on Check/Analyze net area or block shear inputs.
        // Omitting block shear inputs makes block shear non-controlling (∞) in calculateTensionDesign.
      });
      if (r.isSafe) return s;
    }
    return null;
  }, [mode, designPool, Pu, selectedMaterial, designMethod]);

  /** Design mode: compare lightest shapes in the current pool (same assumptions as design suggestion). */
  const designComparisonRows = useMemo(() => {
    if (mode !== "design" || designPool.length === 0) return [];
    const demand = toNumber(Pu);
    return [...designPool]
      .sort((a, b) => a.W - b.W)
      .map((s) => {
        const r = calculateTensionDesign({
          designMethod,
          Fy: selectedMaterial.Fy,
          Fu: selectedMaterial.Fu,
          Ag: s.A,
          An: s.A,
          U: 1,
          demandPu: demand,
          // Design comparison also ignores Check/Analyze net area + block shear inputs (client request).
        });
        return {
          shape: s.shape,
          W: s.W,
          strength: r.controllingStrength,
          safe: r.isSafe,
          gov: r.governingCase,
        };
      });
  }, [mode, designPool, Pu, selectedMaterial, designMethod]);

  const safeDesignRows = useMemo(() => designComparisonRows.filter((r) => r.safe), [designComparisonRows]);
  const unsafeDesignRows = useMemo(() => designComparisonRows.filter((r) => !r.safe), [designComparisonRows]);
  const filteredDesignRows = useMemo(() => {
    if (comparisonFilter === "safe") return safeDesignRows;
    if (comparisonFilter === "unsafe") return unsafeDesignRows;
    return designComparisonRows;
  }, [comparisonFilter, designComparisonRows, safeDesignRows, unsafeDesignRows]);

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
    const t = toNumber(stagT);
    const sVals = parseInchSeries(stagS);
    const gVals = parseInchSeries(stagG);
    if (!stagW.trim() || W <= 0 || dh <= 0 || n < 0 || t <= 0) return null;

    const pairCount = Math.min(sVals.length, gVals.length);
    const staggers = pairCount > 0 ? Array.from({ length: pairCount }, (_, i) => ({ sIn: sVals[i], gIn: gVals[i] })) : undefined;

    const nw = staggeredNetWidthInches({
      grossWidthIn: W,
      holeDiameterIn: dh,
      nHoles: n,
      staggers,
    });

    return { netWidth: nw, an: nw * t, staggerPairsUsed: pairCount };
  }, [stagW, stagDh, stagN, stagS, stagG, stagT]);

  const blockShearGeom = useMemo(() => {
    const v = netAreaFromPath({
      grossWidth: toNumber(blkVw),
      holeDiameter: toNumber(blkVdh),
      nHoles: toNumber(blkVn),
      thickness: toNumber(blkVt),
      sVals: parseInchSeries(blkVs),
      gVals: parseInchSeries(blkVg),
    });
    const t = netAreaFromPath({
      grossWidth: toNumber(blkTw),
      holeDiameter: toNumber(blkTdh),
      nHoles: toNumber(blkTn),
      thickness: toNumber(blkTt),
      sVals: parseInchSeries(blkTs),
      gVals: parseInchSeries(blkTg),
    });
    if (!v && !t) return null;
    return { v, t };
  }, [blkVw, blkVdh, blkVn, blkVt, blkVs, blkVg, blkTw, blkTdh, blkTn, blkTt, blkTs, blkTg]);

  const failureModeRows = useMemo(() => {
    const demand = result.demand;
    return Object.entries(result.results)
      .map(([key, value]) => {
        const cap = value.phiPn;
        const ratio = Number.isFinite(cap) && cap > 0 ? demand / cap : Number.POSITIVE_INFINITY;
        return { key, name: value.name, unit: value.unit, cap, ratio };
      })
      .sort((a, b) => b.ratio - a.ratio);
  }, [result]);

  const resetInputs = () => {
    try {
      localStorage.removeItem(STORAGE.tension);
      localStorage.removeItem("ssc:ts:tension");
    } catch {
      /* ignore */
    }
    setMaterial("A992");
    setShapeName("W24X131");
    setAg("38.5");
    setAn("32");
    setU("0.9");
    setPu("900");
    setAgv("24");
    setAnv("20");
    setAgt("8");
    setAnt("6.5");
    setUbs("0.5");
    setStagW("");
    setStagDh("0.875");
    setStagN("2");
    setStagS("3");
    setStagG("3");
    setStagT("0.75");
    setShapeFamily("all");
    setDesignMethod("LRFD");
    setMode("check");
    setDesignMinAg("");
    setDesignMinR("");
    setUseDesignFilters(false);
    setBlkVw("");
    setBlkVdh("0.875");
    setBlkVn("2");
    setBlkVt("0.75");
    setBlkVs("");
    setBlkVg("");
    setBlkTw("");
    setBlkTdh("0.875");
    setBlkTn("1");
    setBlkTt("0.75");
    setBlkTs("");
    setBlkTg("");
  };

  return (
    <AppShell>
      <Card>
        <CardHeader
          title="Tension Analysis & Design"
          description="Yielding, rupture, block shear (J4.3), optional staggered net width. Check or design mode. Inputs save in this browser."
        />
        <CardBody className="grid gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-12 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Quick workflow</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Set steel, shape, mode, and required axial demand in General.</li>
              <li>Fill net area and block shear values (use Net Area Solver / Geometry Helper if needed).</li>
              <li>Review Result, governing limit state, and Steps before exporting.</li>
            </ol>
          </div>
          <div className="md:col-span-12 md:hidden">
            <PageSectionNav
              sections={[
                { id: "tension-general", label: "General" },
                { id: "tension-net-area", label: "Net area" },
                { id: "tension-block-shear", label: "Block shear" },
                { id: "tension-steps", label: "Steps" },
              ]}
            />
          </div>
          <div className="md:col-span-8 grid gap-4">
            <details open className="rounded-2xl border border-slate-200 bg-white" id="tension-general">
              <summary className="min-h-11 cursor-pointer px-4 py-3.5 text-sm font-extrabold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand)]/10 sm:px-5 sm:py-4">
                1 · General
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Steel, shape selection, method, and required Pu. Blue fields are user input; section snapshot and results update automatically.
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Units: kips, ksi, in²
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
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
                  <Field label="AISC Shape" hint="Ag and section properties auto-update from the selected shape.">
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

                  <Field label="Mode" hint="Check a section, or get a lightest-weight suggestion in the chosen family.">
                    <SelectInput value={mode} onChange={(v) => setMode(v as "check" | "design")}>
                      <option value="check">Check / analyze</option>
                      <option value="design">Design (lightest shape)</option>
                    </SelectInput>
                  </Field>
                  {mode === "design" ? (
                    <Field label="Apply design filters?" hint="Optional: require minimum Ag and minimum radius of gyration r.">
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
                      <Field label="Min r" hint="in (uses min(rx, ry) per shape)">
                        <TextInputWithUnit value={designMinR} onChange={setDesignMinR} unit="in" inputMode="decimal" />
                      </Field>
                    </>
                  ) : null}

                  <Field label="Design method" hint="LRFD (default) or ASD.">
                    <SelectInput value={designMethod} onChange={(v) => setDesignMethod(v as "LRFD" | "ASD")}>
                      <option value="LRFD">LRFD</option>
                      <option value="ASD">ASD</option>
                    </SelectInput>
                  </Field>

                  <Field
                    label="Required Pu / Pa"
                    hint="Required axial (kips) — LRFD Pu or ASD Pa depending on method."
                    error={isInvalidNumber(Pu, { min: 0 }) ? "Enter a number ≥ 0." : undefined}
                  >
                    <TextInputWithUnit
                      value={Pu}
                      onChange={setPu}
                      unit="kips"
                      placeholder="e.g. 900"
                      inputMode="decimal"
                      className={isInvalidNumber(Pu, { min: 0 }) ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10" : undefined}
                    />
                  </Field>
                </div>

                {shape ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">Section context</p>
                      <Badge tone="info">{shape.shape}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-4">
                      <span className="tabular-nums">W: {fmt(shape.W, 1)} plf</span>
                      <span className="tabular-nums">Ag: {fmt(shape.A, 3)} in²</span>
                      <span className="tabular-nums">rx: {fmt(shape.rx, 3)} in</span>
                      <span className="tabular-nums">ry: {fmt(shape.ry, 3)} in</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </details>

            <details open className="rounded-2xl border border-slate-200 bg-white" id="tension-net-area">
              <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                2 · Net area (yielding / rupture)
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Enter areas and U. Use quick defaults for early sizing.
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Units: in²
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setU("0.90")}
                  >
                    Typical U = 0.90
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setAn(Ag)}
                  >
                    Set An = Ag (no holes yet)
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Shear lag factor U" hint="dimensionless">
                    <TextInput
                      value={U}
                      onChange={setU}
                      placeholder="e.g. 0.90"
                    />
                  </Field>
                  <Field label="Ag" hint="gross area (in²) — auto from selected shape">
                    <TextInputWithUnit
                      value={Ag}
                      onChange={() => {}}
                      unit="in²"
                      disabled
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="An" hint="net area (in²)" error={isInvalidNumber(An, { min: 0 }) ? "Enter a number ≥ 0." : undefined}>
                    <TextInputWithUnit
                      value={An}
                      onChange={setAn}
                      unit="in²"
                      inputMode="decimal"
                      className={isInvalidNumber(An, { min: 0 }) ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10" : undefined}
                    />
                  </Field>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Tip</p>
                    <p className="mt-1 text-sm">
                      If you don’t have hole details yet, use <strong>An ≈ Ag</strong> for quick sizing, then refine in Check mode.
                    </p>
                  </div>
                </div>

                <Card className="mt-4 shadow-none border border-dashed border-slate-300 bg-white">
                  <CardBody className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Net Area Solver (AISC D3)</p>
                        <p className="mt-1 text-sm text-slate-700">
                          Computes net width for a plate strip. Enter one or more pitch/gage values (comma-separated) and copy A<sub>n</sub> to the net area field.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Gross width W" hint="in — along failure path">
                        <TextInputWithUnit value={stagW} onChange={setStagW} unit="in" placeholder="e.g. 8" inputMode="decimal" />
                      </Field>
                      <Field label="Hole dia d_h" hint="in">
                        <TextInputWithUnit value={stagDh} onChange={setStagDh} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Number of holes n" hint="on that path">
                        <TextInput value={stagN} onChange={setStagN} />
                      </Field>
                      <Field label="Thickness t" hint="in">
                        <TextInputWithUnit value={stagT} onChange={setStagT} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Pitch s" hint="in — one or more values (comma-separated)">
                        <TextInputWithUnit value={stagS} onChange={setStagS} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Gage g" hint="in — one or more values (comma-separated)">
                        <TextInputWithUnit value={stagG} onChange={setStagG} unit="in" inputMode="decimal" />
                      </Field>
                    </div>

                    {staggerHelp ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                        <span className="tabular-nums">
                          Net width = {staggerHelp.netWidth.toFixed(4)} in → A<sub>n</sub> = {staggerHelp.an.toFixed(4)} in²{staggerHelp.staggerPairsUsed > 0 ? ` (using ${staggerHelp.staggerPairsUsed} s/g pair${staggerHelp.staggerPairsUsed === 1 ? "" : "s"})` : ""}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(staggerHelp.netWidth.toFixed(4));
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            Copy net width
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            type="button"
                            onClick={() => setAn(String(Math.round(staggerHelp.an * 10000) / 10000))}
                          >
                            Copy A_n to net area
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">Enter W, d_h, t, and n to compute. Add optional s/g lists for stagger corrections.</p>
                    )}
                  </CardBody>
                </Card>
              </div>
            </details>

            {designSuggestion ? (
              <Card className="border-[color:var(--brand)]/20 bg-[color:var(--brand)]/5">
                <CardBody>
                  <p className="text-sm font-semibold text-slate-950">Suggested section (lightest in family that passes)</p>
                  <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">{designSuggestion.shape}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {designSuggestion.W} lb/ft — based on required Pu/Pa and optional min Ag / min r filters. Switch to Check to enter net area and block shear inputs for the chosen section.
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {mode === "design" && designComparisonRows.length > 0 ? (
              <Card className="shadow-none border border-slate-200">
                <CardBody className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Section comparison (lightest first, gross = net){useDesignFilters ? " · filters applied" : ""}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    SAFE: {safeDesignRows.length} · NOT SAFE: {unsafeDesignRows.length}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Table</p>
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant={comparisonVisibility === "show" ? "secondary" : "primary"}
                          size="sm"
                          onClick={() => setComparisonVisibility(comparisonVisibility === "show" ? "hide" : "show")}
                        >
                          {comparisonVisibility === "show" ? "Hide comparison table" : "Show comparison table"}
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quick filters</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" variant={comparisonFilter === "all" ? "primary" : "secondary"} size="sm" onClick={() => setComparisonFilter("all")}>
                          All
                        </Button>
                        <Button type="button" variant={comparisonFilter === "safe" ? "primary" : "secondary"} size="sm" onClick={() => setComparisonFilter("safe")}>
                          SAFE
                        </Button>
                        <Button type="button" variant={comparisonFilter === "unsafe" ? "primary" : "secondary"} size="sm" onClick={() => setComparisonFilter("unsafe")}>
                          NOT SAFE
                        </Button>
                      </div>
                    </div>
                  </div>
                  {comparisonVisibility === "show" ? (
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
                          {filteredDesignRows.map((row) => (
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
                  ) : null}
                  {comparisonVisibility === "show" && filteredDesignRows.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-700">No rows match the selected filter.</p>
                  ) : null}
                </CardBody>
              </Card>
            ) : null}

            <details id="tension-block-shear" className="rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                3 · Block shear
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Block shear (J4.3). Use the Geometry Helper below to compute Agv/Anv/Agt/Ant.
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" type="button" onClick={() => setUbs("0.50")}>
                    Typical Ubs = 0.50
                  </Button>
                </div>

                <Card className="shadow-none border border-slate-200">
                  <CardBody className="grid gap-4 md:grid-cols-2">
                    <Field label="Agv" hint="gross shear area (in²)">
                      <TextInputWithUnit value={Agv} onChange={setAgv} unit="in²" inputMode="decimal" />
                    </Field>
                    <Field label="Anv" hint="net shear area (in²)">
                      <TextInputWithUnit value={Anv} onChange={setAnv} unit="in²" inputMode="decimal" />
                    </Field>
                    <Field label="Agt" hint="gross tension area (in²)">
                      <TextInputWithUnit value={Agt} onChange={setAgt} unit="in²" inputMode="decimal" />
                    </Field>
                    <Field label="Ant" hint="net tension area (in²)">
                      <TextInputWithUnit value={Ant} onChange={setAnt} unit="in²" inputMode="decimal" />
                    </Field>
                    <Field
                      label="Ubs (block shear)"
                      hint="AISC J4.3 U_bs: 0.5 non-uniform tension on A_nt (typical); 1.0 uniform"
                      className="md:col-span-2"
                    >
                      <TextInput
                        value={ubs}
                        onChange={setUbs}
                        placeholder="0.5"
                      />
                    </Field>
                  </CardBody>
                </Card>
                <Card className="shadow-none border border-dashed border-slate-300 bg-white">
                  <CardBody className="space-y-3">
                    <p className="text-sm font-semibold text-slate-950">Block Shear Geometry Helper (Agv/Anv/Agt/Ant)</p>
                    <p className="text-sm text-slate-700">
                      Compute area terms from path geometry, including optional stagger contributions. Decimal hole counts are accepted per client note.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Agv/Anv gross path width or length" hint="parallel to tension, in">
                        <TextInputWithUnit value={blkVw} onChange={setBlkVw} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agv/Anv hole diameter" hint="in">
                        <TextInputWithUnit value={blkVdh} onChange={setBlkVdh} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agv/Anv no. of holes on path" hint="can be decimal">
                        <TextInput value={blkVn} onChange={setBlkVn} inputMode="decimal" />
                      </Field>
                      <Field label="Agv/Anv thickness" hint="in">
                        <TextInputWithUnit value={blkVt} onChange={setBlkVt} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agv/Anv Pitch s (optional list)" hint="comma-separated, in">
                        <TextInputWithUnit value={blkVs} onChange={setBlkVs} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agv/Anv Gage g (optional list)" hint="comma-separated, in">
                        <TextInputWithUnit value={blkVg} onChange={setBlkVg} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agt/Ant gross path width or length" hint="normal to tension, in">
                        <TextInputWithUnit value={blkTw} onChange={setBlkTw} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agt/Ant hole diameter" hint="in">
                        <TextInputWithUnit value={blkTdh} onChange={setBlkTdh} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agt/Ant no. of holes on path" hint="can be decimal">
                        <TextInput value={blkTn} onChange={setBlkTn} inputMode="decimal" />
                      </Field>
                      <Field label="Agt/Ant thickness" hint="in">
                        <TextInputWithUnit value={blkTt} onChange={setBlkTt} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agt/Ant Pitch s (optional list)" hint="comma-separated, in">
                        <TextInputWithUnit value={blkTs} onChange={setBlkTs} unit="in" inputMode="decimal" />
                      </Field>
                      <Field label="Agt/Ant Gage g (optional list)" hint="comma-separated, in">
                        <TextInputWithUnit value={blkTg} onChange={setBlkTg} unit="in" inputMode="decimal" />
                      </Field>
                    </div>
                    {blockShearGeom ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="font-semibold text-slate-900">Agv / Anv path</p>
                          <p className="mt-1 tabular-nums text-slate-800">Agv = {(toNumber(blkVw) * toNumber(blkVt)).toFixed(4)} in²</p>
                          <p className="tabular-nums text-slate-800">Anv = {blockShearGeom.v ? blockShearGeom.v.area.toFixed(4) : "-"} in²</p>
                          <Button className="mt-2" variant="secondary" size="sm" type="button" onClick={() => { setAgv(String(Math.round(toNumber(blkVw) * toNumber(blkVt) * 10000) / 10000)); if (blockShearGeom.v) setAnv(String(Math.round(blockShearGeom.v.area * 10000) / 10000)); }}>
                            Copy to Agv / Anv
                          </Button>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="font-semibold text-slate-900">Agt / Ant path</p>
                          <p className="tabular-nums text-slate-800">Agt = {(toNumber(blkTw) * toNumber(blkTt)).toFixed(4)} in²</p>
                          <p className="tabular-nums text-slate-800">Ant = {blockShearGeom.t ? blockShearGeom.t.area.toFixed(4) : "-"} in²</p>
                          <Button className="mt-2" variant="secondary" size="sm" type="button" onClick={() => { setAgt(String(Math.round(toNumber(blkTw) * toNumber(blkTt) * 10000) / 10000)); if (blockShearGeom.t) setAnt(String(Math.round(blockShearGeom.t.area * 10000) / 10000)); }}>
                            Copy to Agt / Ant
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">Enter geometry values above to compute helper areas.</p>
                    )}
                  </CardBody>
                </Card>

              </div>
            </details>

            <details id="tension-steps" className="rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold tracking-tight text-slate-950">
                Steps (show math)
                <span className="mt-1 block text-xs font-semibold text-slate-600">
                  Governing: <span className="text-slate-900">{result.governingCase}</span> · Capacity{" "}
                  <span className="tabular-nums text-slate-900">{fmt(result.controllingStrength)} kips</span>
                </span>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Tip: use “Key steps only” for faster review
                </span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <StepsTable steps={result.steps} governingCase={String(result.governingCase)} tools />
              </div>
            </details>
          </div>

          <aside className="md:col-span-4">
            <div className="sticky top-6 md:top-[calc(var(--app-header-h,104px)+16px)] space-y-4">
              <div className="hidden md:block">
                <PageSectionNav
                  sections={[
                    { id: "tension-general", label: "General" },
                    { id: "tension-net-area", label: "Net area" },
                    { id: "tension-block-shear", label: "Block shear" },
                    { id: "tension-steps", label: "Steps" },
                  ]}
                />
              </div>
              <CalculatorActionRail
                desktopClassName="hidden md:block"
                hideMobileBar
                title="Actions"
                subtitle={`${shapeName} · ${designMethod} · ${mode === "design" ? "Design" : "Check"}`}
                savedKey="ssc:ts:tension"
                saving={saving}
                savedAt={savedAt}
                compare={{
                  storageKey: "ssc:compare:tension",
                  getCurrent: () => ({
                    title: `Tension — ${shapeName}`,
                    lines: [
                      `Method: ${designMethod} · Material: ${selectedMaterial.key}`,
                      `Mode: ${mode}`,
                      `Pu = ${Pu} kips`,
                      `Governing: ${result.governingCase}`,
                      `Capacity: ${fmt(result.controllingStrength)} kips`,
                      `Demand: ${fmt(result.demand)} kips`,
                      `Utilization: ${
                        result.controllingStrength > 0 ? ((result.demand / result.controllingStrength) * 100).toFixed(1) : "-"
                      }%`,
                    ],
                  }),
                }}
                copyText={() =>
                  [
                    `Tension — ${shapeName}`,
                    `Method: ${designMethod} · Material: ${selectedMaterial.key}`,
                    `Mode: ${mode}`,
                    `Pu = ${Pu} kips`,
                    `Governing: ${result.governingCase}`,
                    `Capacity: ${fmt(result.controllingStrength)} kips`,
                    `Demand: ${fmt(result.demand)} kips`,
                    `Utilization: ${
                      result.controllingStrength > 0 ? ((result.demand / result.controllingStrength) * 100).toFixed(1) : "-"
                    }%`,
                  ].join("\n")
                }
                onGoResults={() => scrollTo("results")}
                onGoSteps={() => scrollTo("tension-steps")}
                csv={{ filename: "tension-export.csv", rows: csvRows }}
                json={{ data: { result, inputs: { material, shapeName, designMethod, mode, Ag, An, U, Pu, Agv, Anv, Agt, Ant, ubs } } }}
                onReset={resetInputs}
              />
              <div id="results">
              <ResultHero
                status={result.isSafe ? "safe" : "unsafe"}
                governing={result.governingCase}
                capacityLabel={designMethod === "LRFD" ? "Design strength (φPn)" : "Allowable (Pa)"}
                capacity={`${fmt(result.controllingStrength)} kips`}
                demandLabel={designMethod === "LRFD" ? "Demand Pu" : "Demand Pa"}
                demand={`${fmt(result.demand)} kips`}
                utilization={result.controllingStrength > 0 ? result.demand / result.controllingStrength : undefined}
                metaRight={<Badge tone="info">{selectedMaterial.key}</Badge>}
              />
              </div>

              <Card className="border-slate-200">
                <CardBody>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Failure modes</p>
                  <div className="mt-3 space-y-2">
                    {failureModeRows.map((row) => (
                      <div
                        key={row.key}
                        className={[
                          "rounded-xl border p-3",
                        row.name.toLowerCase().includes(String(result.governingCase).toLowerCase())
                            ? "border-[color:var(--brand)]/25 bg-[color:var(--brand)]/5"
                            : "border-slate-200 bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-700">{row.name}</div>
                            <div className="mt-1 text-base font-extrabold tabular-nums text-slate-950">
                              {fmt(row.cap)} {row.unit}
                            </div>
                          </div>
                          <div className="text-right text-xs font-semibold text-slate-700">
                            <div>Util.</div>
                            <div className="tabular-nums text-slate-950">{(row.ratio * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <UtilizationBar ratio={row.ratio} />
                        </div>
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
      <div className="mt-8 md:mt-10">
      <div id="actions">
      <CalculatorActionRail
        mobileOnly
        subtitle="Tension actions"
        savedKey="ssc:ts:tension"
        saving={saving}
        savedAt={savedAt}
        compare={{
          storageKey: "ssc:compare:tension",
          getCurrent: () => ({
            title: `Tension — ${shapeName}`,
            lines: [
              `Method: ${designMethod} · Material: ${selectedMaterial.key}`,
              `Mode: ${mode}`,
              `Pu = ${Pu} kips`,
              `Governing: ${result.governingCase}`,
              `Capacity: ${fmt(result.controllingStrength)} kips`,
              `Demand: ${fmt(result.demand)} kips`,
              `Utilization: ${
                result.controllingStrength > 0 ? ((result.demand / result.controllingStrength) * 100).toFixed(1) : "-"
              }%`,
            ],
          }),
        }}
        copyText={() =>
          [
            `Tension — ${shapeName}`,
            `Method: ${designMethod} · Material: ${selectedMaterial.key}`,
            `Mode: ${mode}`,
            `Pu = ${Pu} kips`,
            `Governing: ${result.governingCase}`,
            `Capacity: ${fmt(result.controllingStrength)} kips`,
            `Demand: ${fmt(result.demand)} kips`,
          ].join("\n")
        }
        onGoResults={() => scrollTo("results")}
        onGoSteps={() => scrollTo("tension-steps")}
        csv={{ filename: "tension-export.csv", rows: csvRows }}
        json={{ data: { result, inputs: { material, shapeName, designMethod, mode, Ag, An, U, Pu, Agv, Anv, Agt, Ant, ubs } } }}
        onReset={resetInputs}
      />
      </div>
      </div>
      <PageFooterNav currentHref="/tension" />
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






