import { aiscShapes } from "@/lib/aisc/data";
import { calculateBendingShearDesign } from "@/lib/calculations/bending";
import { calculateCompressionDesign } from "@/lib/calculations/compression";
import {
  calculateBoltShearBearingCombinedLRFD,
  calculateBoltShearTensionInteractionLRFD,
  calculateBoltSlipCritical,
  calculateBoltTensionLRFD,
  calculateFilletWeldLRFD,
  lrfdToAsdSamePhiOmega,
} from "@/lib/calculations/connections";
import {
  approximateMinPlateThicknessForPryingLRFD,
  calculateGrooveWeldShearLRFD,
} from "@/lib/calculations/connections-advanced";
import { calculateTensionDesign } from "@/lib/calculations/tension";
import type { CalculationOutput, CalculationStep } from "@/lib/types/calculation";
import type { BoltGroup, BoltThreadMode } from "@/lib/data/bolts";
import { steelMaterialMap, type SteelMaterialKey } from "@/lib/data/materials";

const toN = (v: string | undefined) => (v !== undefined ? Number(v) || 0 : 0);

const BOLT_GROUPS: BoltGroup[] = ["A307", "A325", "A490"];

function asBoltGroup(v: unknown): BoltGroup {
  const s = String(v);
  return BOLT_GROUPS.includes(s as BoltGroup) ? (s as BoltGroup) : "A325";
}

/** Matches connections page: optional override, else T_u / n. */
function pryingTPerBoltKipsFromConnectionsRaw(raw: Record<string, unknown>): number | null {
  const o = String(raw.pryingTPerBoltOverride ?? "").trim();
  if (o !== "") {
    const v = Number(o);
    if (Number.isFinite(v) && v > 0) return v;
    return null;
  }
  const Tu = Number(raw.tu);
  const n = Math.floor(Number(raw.nBolts));
  if (Number.isFinite(Tu) && Tu > 0 && Number.isFinite(n) && n >= 1) return Tu / n;
  return null;
}

/** Mirrors `src/app/connections/page.tsx` useMemo outputs for the saved localStorage payload. */
export type ConnectionsReportSummary = {
  module: "connections";
  ok: boolean;
  error?: string;
  designMethod?: "LRFD" | "ASD";
  shearMode?: "bearing" | "slip";
  /** Bearing: "shear" | "bearing"; slip: slip label */
  shearLabel?: string;
  boltControlling?: "shear" | "bearing";
  demandVu?: number;
  /** φR_n or available slip (kips), design-method consistent */
  phiRnShearGoverning?: number;
  shearSafe?: boolean;
  demandTu?: number;
  phiRnTension?: number;
  tensionSafe?: boolean;
  interactionSum?: number;
  interactionSafe?: boolean;
  weldDemand?: number;
  phiRnWeld?: number;
  weldSafe?: boolean;
  /** Groove weld metal in shear (optional). */
  grooveDemand?: number;
  phiRnGroove?: number;
  grooveSafe?: boolean;
  /** Approximate prying plate thickness (optional). */
  pryingTPerBoltUsed?: number;
  pryingTMinApproxIn?: number;
  /** Step-by-step lines for print/PDF (same style as other modules). */
  detailSteps?: CalculationStep[];
};

export type TensionSummary =
  | { module: "tension"; ok: true; output: CalculationOutput; materialLabel: string }
  | { module: "tension"; ok: false; error: string };

export type CompressionSummary =
  | { module: "compression"; ok: true; output: CalculationOutput; shapeName: string; materialLabel: string }
  | { module: "compression"; ok: false; error: string };

export type BendingSummary =
  | {
      module: "bending";
      ok: true;
      output: CalculationOutput;
      shapeName: string;
      materialLabel: string;
      /** Rolled shape type from database (e.g. W vs HSS). */
      shapeFamilyLabel: string;
    }
  | { module: "bending"; ok: false; error: string };

export type ModuleSummary = TensionSummary | CompressionSummary | BendingSummary | ConnectionsReportSummary;

export function summarizeTension(p: Record<string, string> | null): TensionSummary {
  if (!p || typeof p.material !== "string") {
    return { module: "tension", ok: false, error: "No saved tension inputs." };
  }
  try {
    const mat = steelMaterialMap[p.material as SteelMaterialKey];
    if (!mat) return { module: "tension", ok: false, error: "Invalid steel type." };
    const r = calculateTensionDesign({
      designMethod: p.designMethod === "ASD" ? "ASD" : "LRFD",
      Fy: mat.Fy,
      Fu: mat.Fu,
      Ag: toN(p.Ag),
      An: toN(p.An),
      U: toN(p.U),
      demandPu: toN(p.Pu),
      Agv: toN(p.Agv),
      Anv: toN(p.Anv),
      Agt: toN(p.Agt),
      Ant: toN(p.Ant),
      ubs: toN(p.ubs) || 0.5,
    });
    return {
      module: "tension",
      ok: true,
      output: r,
      materialLabel: p.material,
    };
  } catch (e) {
    return { module: "tension", ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export function summarizeCompression(p: Record<string, string> | null): CompressionSummary {
  if (!p || typeof p.shapeName !== "string") {
    return { module: "compression", ok: false, error: "No saved compression inputs." };
  }
  try {
    const shape = aiscShapes.find((s) => s.shape === p.shapeName);
    const mat = steelMaterialMap[(p.material as SteelMaterialKey) ?? "A992"];
    if (!shape) return { module: "compression", ok: false, error: "Shape not found." };
    const kBase = toN(p.k) || 1;
    const bu = typeof p.builtUpFactor === "string" ? Number(p.builtUpFactor) : Number(p.builtUpFactor);
    const kEff = Number.isFinite(bu) && bu > 0 ? kBase * bu : kBase;
    const out = calculateCompressionDesign({
      designMethod: p.designMethod === "ASD" ? "ASD" : "LRFD",
      Fy: mat.Fy,
      E: 29000,
      k: kEff,
      L: toN(p.L),
      rx: shape.rx,
      ry: shape.ry,
      Ag: shape.A,
      lambdaFlange: shape.bf_2tf,
      lambdaWeb: shape.h_tw,
      demandPu: toN(p.Pu),
    });
    return {
      module: "compression",
      ok: true,
      output: out,
      shapeName: p.shapeName,
      materialLabel: (p.material as SteelMaterialKey) ?? "A992",
    };
  } catch (e) {
    return { module: "compression", ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export function summarizeBending(p: Record<string, string> | null): BendingSummary {
  if (!p || typeof p.shapeName !== "string") {
    return { module: "bending", ok: false, error: "No saved beam inputs." };
  }
  try {
    const shape = aiscShapes.find((s) => s.shape === p.shapeName);
    const mat = steelMaterialMap[(p.material as SteelMaterialKey) ?? "A36"];
    if (!shape) return { module: "bending", ok: false, error: "Shape not found." };
    const mode = p.mode === "design" ? "design" : "check";
    if (shape.type !== "W" && shape.type !== "HSS") {
      return { module: "bending", ok: false, error: "W or HSS shape required." };
    }
    if (mode === "design" && shape.type !== "W") {
      return { module: "bending", ok: false, error: "Design mode summary requires a W-shape in saved data." };
    }
    const DL = toN(p.deadLoadKft);
    const LL = toN(p.liveLoadKft);
    const Lft = toN(p.spanFt);
    let Lin = toN(p.L);
    let w = toN(p.wLive);
    let muUse = toN(p.Mu);
    let vuUse = toN(p.Vu);
    if (Number.isFinite(DL) && Number.isFinite(LL) && Number.isFinite(Lft) && Lft > 0) {
      const wStr =
        p.designMethod === "ASD"
          ? DL + LL
          : Math.max(1.4 * DL, 1.2 * DL + 1.6 * LL);
      muUse = (wStr * Lft * Lft) / 8;
      vuUse = (wStr * Lft) / 2;
      w = (DL + LL) / 12;
      Lin = Lft * 12;
    }
    const hBeam = shape.h && shape.h > 0 ? shape.h : shape.d - 2 * shape.tf;
    const delta = (5 / 384) * w * Lin ** 4 / (29000 * (shape.Ix || 1));
    const lbParsed = toN(p.unbracedLbIn);
    const LbUse = p.unbracedLbIn?.trim() !== "" && lbParsed > 0 ? lbParsed : Lin;
    const CbUse = Math.max(0.1, toN(p.cbFactor) || 1);
    const out = calculateBendingShearDesign({
      designMethod: p.designMethod === "ASD" ? "ASD" : "LRFD",
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
      h: hBeam,
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
    return {
      module: "bending",
      ok: true,
      output: out,
      shapeName: p.shapeName,
      materialLabel: (p.material as SteelMaterialKey) ?? "A36",
      shapeFamilyLabel: shape.type,
    };
  } catch (e) {
    return { module: "bending", ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export function summarizeConnectionsFromStorage(raw: Record<string, unknown> | null): ConnectionsReportSummary {
  if (!raw) return { module: "connections", ok: false, error: "No saved connection inputs." };

  try {
    const designMethod = raw.designMethod === "ASD" ? "ASD" : "LRFD";
    const shearMode = raw.shearMode === "slip" ? "slip" : "bearing";
    const demandVu = Number(raw.vu);
    const demandTu = Number(raw.tu);
    const nBolts = Math.floor(Number(raw.nBolts));
    const dBolt = Number(raw.dBolt);
    const boltGroup = asBoltGroup(raw.boltGroup);
    const threadMode: BoltThreadMode = raw.threadMode === "X" ? "X" : "N";
    const shearPlanes: 1 | 2 = raw.shearPlanes === "1" ? 1 : 2;
    const checkBearing = typeof raw.checkBearing === "boolean" ? raw.checkBearing : true;
    const plateFu = Number(raw.plateFu);
    const plateT = Number(raw.plateT);
    const lcMin = Number(raw.lcMin);
    const slipHf = Number(raw.slipHf);
    const surfaceClass = raw.surfaceClass === "B" ? "B" : "A";
    const fexx = Number(raw.fexx);
    const legIn = Number(raw.legIn);
    const weldLen = Number(raw.weldLen);
    const weldDemand = Number(raw.weldDemand);
    const grooveThroatIn = Number(raw.grooveThroatIn);
    const grooveLenIn = Number(raw.grooveLenIn);
    const grooveDemandNum = Number(raw.grooveDemand);
    const pryingBPrimeIn = Number(raw.pryingBPrimeIn);
    const pryingStripWidthIn = Number(raw.pryingStripWidthIn);
    const pryingFyKsi = Number(raw.pryingFyKsi);

    if (!Number.isFinite(nBolts) || nBolts < 1 || !Number.isFinite(dBolt) || dBolt <= 0) {
      return { module: "connections", ok: false, error: "Invalid bolt count or diameter in saved data." };
    }

    let boltOut: ReturnType<typeof calculateBoltShearBearingCombinedLRFD> | null = null;
    let slipOut: ReturnType<typeof calculateBoltSlipCritical> | null = null;
    let shearLabel: string | undefined;
    let phiRnShearGoverning: number | undefined;
    let shearSafe: boolean | undefined;
    let boltControlling: "shear" | "bearing" | undefined;

    if (shearMode === "bearing") {
      if (Number.isFinite(demandVu)) {
        boltOut = calculateBoltShearBearingCombinedLRFD({
          demandVu,
          boltGroup,
          threadMode,
          dBolt,
          nBolts,
          shearPlanes,
          includeBearing: checkBearing,
          lcMinIn: lcMin,
          plateThicknessIn: plateT,
          plateFuKsi: plateFu,
        });
        phiRnShearGoverning =
          designMethod === "LRFD" ? boltOut.phiRnTotalGoverning : lrfdToAsdSamePhiOmega(boltOut.phiRnTotalGoverning);
        shearSafe = boltOut.isSafe;
        boltControlling = boltOut.controlling;
        shearLabel = boltOut.controlling === "shear" ? "Bolt shear" : "Bearing";
      }
    } else if (Number.isFinite(demandVu) && Number.isFinite(slipHf) && slipHf > 0) {
      slipOut = calculateBoltSlipCritical({
        demandVu,
        boltGroup,
        dBolt,
        nBolts,
        slipPlanes: shearPlanes,
        surfaceClass,
        hf: slipHf,
        designMethod,
      });
      if (slipOut) {
        phiRnShearGoverning = slipOut.availableSlip;
        shearSafe = slipOut.isSafe;
        shearLabel = "Slip-critical";
      }
    }

    let tensionOut: ReturnType<typeof calculateBoltTensionLRFD> | null = null;
    if (Number.isFinite(demandTu) && demandTu >= 0) {
      tensionOut = calculateBoltTensionLRFD({
        demandTu,
        boltGroup,
        threadMode,
        dBolt,
        nBolts,
      });
    }

    const phiRnTensionDisplay =
      tensionOut !== null
        ? designMethod === "LRFD"
          ? tensionOut.phiRnTotal
          : lrfdToAsdSamePhiOmega(tensionOut.phiRnTotal)
        : undefined;

    const tensionSafe = tensionOut !== null ? tensionOut.isSafe : undefined;

    let interactionSum: number | undefined;
    let interactionSafe: boolean | undefined;
    let interactionOut: ReturnType<typeof calculateBoltShearTensionInteractionLRFD> | null = null;
    if (tensionOut !== null && Number.isFinite(demandVu) && Number.isFinite(demandTu)) {
      let capShear: number | null = null;
      if (shearMode === "slip") {
        if (slipOut) capShear = slipOut.availableSlip;
      } else if (boltOut) {
        capShear =
          designMethod === "LRFD"
            ? boltOut.phiRnTotalGoverning
            : lrfdToAsdSamePhiOmega(boltOut.phiRnTotalGoverning);
      }
      if (capShear !== null) {
        const capTension =
          designMethod === "LRFD" ? tensionOut.phiRnTotal : lrfdToAsdSamePhiOmega(tensionOut.phiRnTotal);
        interactionOut = calculateBoltShearTensionInteractionLRFD({
          demandVu,
          demandTu,
          phiRnShearTotal: capShear,
          phiRnTensionTotal: capTension,
        });
        interactionSum = interactionOut.interactionSum;
        interactionSafe = interactionOut.isSafe;
      }
    }

    let phiRnWeld: number | undefined;
    let weldSafe: boolean | undefined;
    let weldOut: ReturnType<typeof calculateFilletWeldLRFD> | null = null;
    if (
      Number.isFinite(fexx) &&
      Number.isFinite(legIn) &&
      Number.isFinite(weldLen) &&
      Number.isFinite(weldDemand) &&
      fexx > 0 &&
      legIn > 0 &&
      weldLen > 0
    ) {
      weldOut = calculateFilletWeldLRFD({
        fexx,
        legIn,
        lengthIn: weldLen,
        demand: weldDemand,
      });
      phiRnWeld = designMethod === "LRFD" ? weldOut.phiRn : lrfdToAsdSamePhiOmega(weldOut.phiRn, 0.75, 2);
      weldSafe = weldDemand <= (phiRnWeld ?? 0);
    }

    let grooveOut: ReturnType<typeof calculateGrooveWeldShearLRFD> | null = null;
    let phiRnGroove: number | undefined;
    let grooveSafe: boolean | undefined;
    if (
      Number.isFinite(fexx) &&
      Number.isFinite(grooveThroatIn) &&
      Number.isFinite(grooveLenIn) &&
      Number.isFinite(grooveDemandNum) &&
      fexx > 0 &&
      grooveThroatIn > 0 &&
      grooveLenIn > 0
    ) {
      grooveOut = calculateGrooveWeldShearLRFD({
        fexx,
        effectiveThroatIn: grooveThroatIn,
        lengthIn: grooveLenIn,
        demandKips: grooveDemandNum,
        designMethod,
      });
      phiRnGroove = grooveOut.phiRnOrAllowableKips;
      grooveSafe = grooveOut.isSafe;
    }

    const pryingTUsed = pryingTPerBoltKipsFromConnectionsRaw(raw);
    let pryingTMinApproxIn: number | undefined;
    if (
      pryingTUsed != null &&
      Number.isFinite(pryingBPrimeIn) &&
      Number.isFinite(pryingStripWidthIn) &&
      Number.isFinite(pryingFyKsi) &&
      pryingBPrimeIn > 0 &&
      pryingStripWidthIn > 0 &&
      pryingFyKsi > 0
    ) {
      const pr = approximateMinPlateThicknessForPryingLRFD({
        boltTensionDemandKips: pryingTUsed,
        bPrimeIn: pryingBPrimeIn,
        stripWidthIn: pryingStripWidthIn,
        fyKsi: pryingFyKsi,
      });
      if (pr.tMinApproxIn > 0) pryingTMinApproxIn = pr.tMinApproxIn;
    }

    const strengthLabel = designMethod === "LRFD" ? "φR_n (LRFD)" : "Allowable R_n/Ω (ASD)";
    const detailSteps: CalculationStep[] = [
      {
        id: "cx-in-1",
        label: "Design method / shear path",
        formula: "—",
        value: `${designMethod}; ${shearMode === "bearing" ? "bearing-type (shear + optional bearing)" : "slip-critical (J3.8)"}`,
      },
      {
        id: "cx-in-2",
        label: "Bolts — group, d, n, N/X, shear planes",
        formula: "—",
        value: `${boltGroup}; d = ${dBolt} in; n = ${nBolts}; ${threadMode}; ${shearPlanes} plane(s)`,
      },
    ];
    if (shearMode === "bearing") {
      detailSteps.push(
        { id: "cx-in-pl", label: "Plate / bearing inputs", formula: "F_u, t, L_c", value: `F_u = ${plateFu} ksi; t = ${plateT} in; L_c = ${lcMin} in; bearing check = ${checkBearing}` },
      );
    } else {
      detailSteps.push(
        {
          id: "cx-in-sl",
          label: "Slip inputs",
          formula: "h_f, surface class",
          value: `h_f = ${slipHf}; Class ${surfaceClass} (μ = ${surfaceClass === "B" ? "0.50" : "0.30"})`,
        },
      );
    }
    detailSteps.push(
      { id: "cx-in-vu", label: "Required shear V_u", formula: "—", value: demandVu, unit: "kips" },
      { id: "cx-in-tu", label: "Required tension T_u", formula: "—", value: demandTu, unit: "kips" },
    );

    if (shearMode === "bearing" && boltOut) {
      detailSteps.push(
        {
          id: "cx-sh-fnv",
          label: "Bolt shear — F_nv",
          formula: "Table J3.2",
          value: boltOut.shear.Fnv,
          unit: "ksi",
        },
        {
          id: "cx-sh-ab",
          label: "Bolt shear — A_b",
          formula: "—",
          value: boltOut.shear.Ab,
          unit: "in²",
        },
        {
          id: "cx-sh-rnpb",
          label: "Bolt shear — R_n per bolt",
          formula: "F_nv A_b × (shear planes)",
          value: boltOut.shear.RnPerBolt,
          unit: "kips",
        },
        {
          id: "cx-sh-phitot",
          label: "Bolt shear — φR_n (group, shear only)",
          formula: "φ = 0.75",
          value:
            designMethod === "LRFD"
              ? boltOut.shear.phiRnTotal
              : lrfdToAsdSamePhiOmega(boltOut.shear.phiRnTotal),
          unit: "kips",
          note: strengthLabel,
        },
      );
      if (boltOut.bearing) {
        detailSteps.push(
          {
            id: "cx-be-rnpb",
            label: "Bearing — R_n per bolt (governed by)",
            formula: boltOut.bearing.limit,
            value: boltOut.bearing.rnPerBolt,
            unit: "kips",
          },
          {
            id: "cx-be-phi",
            label: "Bearing — φR_n (group)",
            formula: "φ = 0.75",
            value:
              designMethod === "LRFD"
                ? boltOut.bearing.phiRnTotal
                : lrfdToAsdSamePhiOmega(boltOut.bearing.phiRnTotal),
            unit: "kips",
          },
        );
      }
      detailSteps.push(
        {
          id: "cx-sh-gov",
          label: `Governing shear path (${boltOut.controlling})`,
          formula: "min(shear, bearing) per bolt × n × φ",
          value: designMethod === "LRFD" ? boltOut.phiRnTotalGoverning : lrfdToAsdSamePhiOmega(boltOut.phiRnTotalGoverning),
          unit: "kips",
        },
        {
          id: "cx-sh-safe",
          label: "Shear check",
          formula: "V_u vs capacity",
          value: boltOut.isSafe ? "SAFE" : "NOT SAFE",
          note: `V_u = ${demandVu.toFixed(3)} kips`,
        },
      );
    } else if (slipOut) {
      detailSteps.push(
        { id: "cx-sl-tb", label: "Minimum pretension T_b", formula: "Table J3.1", value: slipOut.Tb, unit: "kips" },
        { id: "cx-sl-mu", label: "Slip coefficient μ", formula: "Class A/B", value: slipOut.mu, unit: "—" },
        {
          id: "cx-sl-rnpb",
          label: "Nominal slip R_n per bolt",
          formula: "μ D_u h_f T_b n_s",
          value: slipOut.rnPerBolt,
          unit: "kips",
        },
        { id: "cx-sl-rn", label: "Nominal slip R_n (group)", formula: "n × R_n/bolt", value: slipOut.RnTotal, unit: "kips" },
        {
          id: "cx-sl-avail",
          label: designMethod === "LRFD" ? "Available slip resistance (LRFD)" : "Available slip (ASD)",
          formula: designMethod === "LRFD" ? "φ = 1.00 (J3.8)" : "Ω = 1.50",
          value: slipOut.availableSlip,
          unit: "kips",
        },
        {
          id: "cx-sl-safe",
          label: "Slip check",
          formula: "V_u vs available slip",
          value: slipOut.isSafe ? "SAFE" : "NOT SAFE",
          note: `V_u = ${demandVu.toFixed(3)} kips`,
        },
      );
    }

    if (tensionOut) {
      detailSteps.push(
        { id: "cx-tn-fnt", label: "Bolt tension — F_nt", formula: "Table J3.2", value: tensionOut.Fnt, unit: "ksi" },
        { id: "cx-tn-ab", label: "Bolt tension — A_b", value: tensionOut.Ab, unit: "in²" },
        {
          id: "cx-tn-rn",
          label: "Bolt tension — R_n per bolt",
          formula: "F_nt A_b",
          value: tensionOut.rnPerBolt,
          unit: "kips",
        },
        {
          id: "cx-tn-phi",
          label: `Bolt tension — ${strengthLabel}`,
          formula: "φ = 0.75",
          value: phiRnTensionDisplay ?? tensionOut.phiRnTotal,
          unit: "kips",
        },
        {
          id: "cx-tn-safe",
          label: "Tension check",
          formula: "T_u vs capacity",
          value: tensionOut.isSafe ? "SAFE" : "NOT SAFE",
          note: `T_u = ${demandTu.toFixed(3)} kips`,
        },
      );
    }

    if (interactionOut) {
      detailSteps.push(
        {
          id: "cx-int-rs",
          label: "Interaction — V_u / available shear",
          formula: "—",
          value: interactionOut.ratioShear,
          unit: "—",
        },
        {
          id: "cx-int-rt",
          label: "Interaction — T_u / available tension",
          formula: "—",
          value: interactionOut.ratioTension,
          unit: "—",
        },
        {
          id: "cx-int-sum",
          label: "Interaction — (r_s)² + (r_t)²",
          formula: "J3-7 style",
          value: interactionOut.interactionSum,
          unit: "—",
        },
        {
          id: "cx-int-safe",
          label: "Interaction check",
          formula: "≤ 1.0",
          value: interactionOut.isSafe ? "SAFE" : "NOT SAFE",
        },
      );
    }

    if (weldOut) {
      detailSteps.push(
        {
          id: "cx-w-th",
          label: "Fillet weld — effective throat",
          formula: "0.707 a",
          value: weldOut.throat,
          unit: "in",
        },
        {
          id: "cx-w-rn",
          label: "Fillet weld — nominal R_n",
          formula: "0.6 F_EXX × throat × L",
          value: weldOut.Rn,
          unit: "kips",
        },
        {
          id: "cx-w-phi",
          label: `Fillet weld — ${strengthLabel}`,
          formula: "φ = 0.75",
          value: designMethod === "LRFD" ? weldOut.phiRn : lrfdToAsdSamePhiOmega(weldOut.phiRn, 0.75, 2),
          unit: "kips",
        },
        {
          id: "cx-w-p",
          label: "Fillet weld — demand",
          formula: "—",
          value: weldDemand,
          unit: "kips",
        },
        {
          id: "cx-w-safe",
          label: "Fillet weld check",
          formula: "demand vs capacity",
          value: weldOut.isSafe ? "SAFE" : "NOT SAFE",
          note: `Length required at this leg (hint): ${weldOut.lengthRequiredIn.toFixed(3)} in`,
        },
      );
    }

    if (grooveOut) {
      detailSteps.push(
        {
          id: "cx-gr-aw",
          label: "Groove weld — A_w (effective throat × L)",
          formula: "—",
          value: grooveOut.AwIn2,
          unit: "in²",
        },
        {
          id: "cx-gr-rn",
          label: "Groove weld — R_n (weld metal shear)",
          formula: "0.6 F_EXX A_w",
          value: grooveOut.RnKips,
          unit: "kips",
        },
        {
          id: "cx-gr-cap",
          label: `Groove weld — ${strengthLabel}`,
          formula: "φ = 0.75",
          value: grooveOut.phiRnOrAllowableKips,
          unit: "kips",
        },
        {
          id: "cx-gr-dem",
          label: "Groove weld — demand",
          formula: "—",
          value: grooveDemandNum,
          unit: "kips",
        },
        {
          id: "cx-gr-safe",
          label: "Groove weld check",
          formula: "demand vs capacity",
          value: grooveOut.isSafe ? "SAFE" : "NOT SAFE",
        },
      );
    }

    if (pryingTUsed != null && pryingTMinApproxIn !== undefined) {
      detailSteps.push(
        {
          id: "cx-pr-t",
          label: "Prying — T per bolt (used)",
          formula: "override or T_u / n",
          value: pryingTUsed,
          unit: "kips",
        },
        {
          id: "cx-pr-tmin",
          label: "Prying — approximate t_min (strip model)",
          formula: "See connections module",
          value: pryingTMinApproxIn,
          unit: "in",
        },
      );
    }

    return {
      module: "connections",
      ok: true,
      designMethod,
      shearMode,
      shearLabel,
      boltControlling,
      demandVu: Number.isFinite(demandVu) ? demandVu : undefined,
      phiRnShearGoverning,
      shearSafe,
      demandTu: Number.isFinite(demandTu) ? demandTu : undefined,
      phiRnTension: phiRnTensionDisplay,
      tensionSafe,
      interactionSum,
      interactionSafe,
      weldDemand: Number.isFinite(weldDemand) ? weldDemand : undefined,
      phiRnWeld,
      weldSafe,
      grooveDemand: Number.isFinite(grooveDemandNum) ? grooveDemandNum : undefined,
      phiRnGroove,
      grooveSafe,
      pryingTPerBoltUsed: pryingTUsed ?? undefined,
      pryingTMinApproxIn,
      detailSteps,
    };
  } catch (e) {
    return { module: "connections", ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
