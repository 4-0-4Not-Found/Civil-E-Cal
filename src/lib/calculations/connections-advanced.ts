/**
 * Additional connection checks (groove welds, prying plate thickness) — introductory / educational.
 * Fillet welds remain in `connections.ts`. Verify critical work against AISC 360 & project specs.
 */
import { lrfdToAsdSamePhiOmega } from "@/lib/calculations/connections";

const PHI_WELD = 0.75;

export type GrooveWeldShearInput = {
  fexx: number;
  /** Effective throat of groove weld (in.) — user measured / detail */
  effectiveThroatIn: number;
  lengthIn: number;
  demandKips: number;
  designMethod?: "LRFD" | "ASD";
};

export type GrooveWeldShearOutput = {
  AwIn2: number;
  RnKips: number;
  phiRnOrAllowableKips: number;
  isSafe: boolean;
  note: string;
};

/**
 * CJP / groove weld metal in **shear** on the effective throat area (introductory).
 * R_n = 0.6 F_EXX A_w; φ = 0.75 (LRFD) same spirit as fillet weld metal shear (AISC J2).
 */
export function calculateGrooveWeldShearLRFD(input: GrooveWeldShearInput): GrooveWeldShearOutput {
  const Aw = Math.max(0, input.effectiveThroatIn * input.lengthIn);
  const Rn = 0.6 * input.fexx * Aw;
  const method = input.designMethod ?? "LRFD";
  const phiRn = PHI_WELD * Rn;
  const allowable = lrfdToAsdSamePhiOmega(phiRn, PHI_WELD, 2);
  const cap = method === "LRFD" ? phiRn : allowable;
  return {
    AwIn2: Aw,
    RnKips: Rn,
    phiRnOrAllowableKips: cap,
    isSafe: cap >= input.demandKips,
    note: "Groove geometry and load direction must match your detail; tension/compression normal to weld may govern separately.",
  };
}

export type PryingPlateThicknessInput = {
  /** Required tension per bolt (kips) before prying */
  boltTensionDemandKips: number;
  /** Lever arm from bolt line to prying hinge (in), e.g. edge distance minus half hole */
  bPrimeIn: number;
  /** Effective plate strip width resisting bending (in) — often gage g or spacing */
  stripWidthIn: number;
  /** Plate yield (ksi) */
  fyKsi: number;
};

export type PryingPlateThicknessOutput = {
  /** Approximate minimum thickness (in) from plastic hinge line model — compare to DG 4 / course Excel */
  tMinApproxIn: number;
  note: string;
};

/**
 * Simplified **cantilever plate** model: M = T·b′ ≈ φ F_y (w t²)/4  →  t_req ≈ √(4 T b′ / (φ F_y w)).
 * LRFD φ = 0.9 for yielding element (plate); use for **preliminary** plate thickness when prying is significant.
 */
export function approximateMinPlateThicknessForPryingLRFD(input: PryingPlateThicknessInput): PryingPlateThicknessOutput {
  const phi = 0.9;
  const { boltTensionDemandKips: T, bPrimeIn: b, stripWidthIn: w, fyKsi: Fy } = input;
  if (T <= 0 || b <= 0 || w <= 0 || Fy <= 0) {
    return {
      tMinApproxIn: 0,
      note: "Positive T, b′, w, and F_y are required.",
    };
  }
  const t = Math.sqrt((4 * T * b) / (phi * Fy * w));
  return {
    tMinApproxIn: t,
    note: "Simplified plastic hinge on a strip — not a full T-stub / end-plate prying solution. Compare to AISC Design Guide 4 or your workbook.",
  };
}
