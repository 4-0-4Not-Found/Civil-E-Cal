import {
  boltAreaIn2,
  boltFntKsi,
  type BoltGroup,
  boltFnvKsi,
  boltMinPretensionTbKips,
  type BoltThreadMode,
} from "@/lib/data/bolts";

const PHI_SHEAR = 0.75;
const PHI_WELD = 0.75;
const PHI_BEARING = 0.75;
const PHI_TENSION = 0.75;
/** AISC J3 / J4: typical Ω for bolt shear, bearing, tension; weld — use with matching φ. */
const OMEGA_BOLT = 2.0;
/** Slip-critical (J3.8) — standard holes: LRFD φ = 1.00, ASD Ω = 1.50 (AISC Table J3.1). */
const PHI_SLIP_LRFD = 1.0;
const OMEGA_SLIP_ASD = 1.5;
/** Mean slip coefficient — Class A / B faying surfaces (AISC J3.8). */
const SLIP_MU = { A: 0.3, B: 0.5 } as const;
/** Ratio of installed to minimum pretension D_u (AISC J3.8). */
const SLIP_DU = 1.13;

/**
 * Convert LRFD design strength (φR_n) to ASD allowable (R_n/Ω) when φ and Ω apply to the same limit state.
 * R_n = (φ R_n) / φ; allowable = R_n / Ω = (φ R_n) / (φ × Ω).
 */
export function lrfdToAsdSamePhiOmega(lrfdStrength: number, phi = PHI_SHEAR, omega = OMEGA_BOLT): number {
  return lrfdStrength / (phi * omega);
}

export type BoltShearInput = {
  demandVu: number;
  boltGroup: BoltGroup;
  /** AISC Table J3.2: N = threads in shear plane, X = threads excluded from shear plane */
  threadMode: BoltThreadMode;
  /** Nominal bolt body diameter (in.) */
  dBolt: number;
  /** Number of bolts sharing shear (same line / assumed equal share) */
  nBolts: number;
  /** Shear planes per bolt (1 = single, 2 = double shear) */
  shearPlanes: 1 | 2;
};

export type BoltShearOutput = {
  Fnv: number;
  Ab: number;
  RnPerBolt: number;
  phiRnTotal: number;
  isSafe: boolean;
  /** Smallest integer bolt count that would work at this diameter/planes — shear-only hint */
  nBoltsRequired: number;
};

/**
 * LRFD bolt shear: φR_n = φ n F_nv A_b × (shear planes), φ = 0.75 (AISC J3).
 */
export function calculateBoltShearLRFD(input: BoltShearInput): BoltShearOutput {
  const Fnv = boltFnvKsi(input.boltGroup, input.threadMode);
  const Ab = boltAreaIn2(input.dBolt);
  const RnPerBolt = Fnv * Ab * input.shearPlanes;
  const phiRnTotal = PHI_SHEAR * input.nBolts * RnPerBolt;
  const phiRnOne = PHI_SHEAR * RnPerBolt;
  const nBoltsRequired =
    input.demandVu <= 0 || phiRnOne <= 0 ? 1 : Math.max(1, Math.ceil(input.demandVu / phiRnOne));
  return {
    Fnv,
    Ab,
    RnPerBolt,
    phiRnTotal,
    isSafe: phiRnTotal >= input.demandVu,
    nBoltsRequired,
  };
}

/** AISC J3.10(a): R_n = min(1.2 L_c t F_u, 2.4 d t F_u) — d = bolt body diameter (in.). */
export type BoltBearingInput = {
  dBolt: number;
  nBolts: number;
  /** Minimum clear distance L_c (in.) from hole edge to edge of material or next hole, in direction of force */
  lcMinIn: number;
  plateThicknessIn: number;
  /** Plate tensile strength F_u (ksi) */
  plateFuKsi: number;
  demandVu: number;
};

export type BoltBearingOutput = {
  rnPerBolt: number;
  phiRnTotal: number;
  isSafe: boolean;
  nBoltsRequired: number;
  /** Which limit on R_n per bolt: bearing deformation vs hole ovalization cap */
  limit: "1.2 Lc t Fu" | "2.4 d t Fu";
};

export function calculateBoltBearingLRFD(input: BoltBearingInput): BoltBearingOutput {
  const { dBolt, nBolts, lcMinIn, plateThicknessIn, plateFuKsi, demandVu } = input;
  const t = plateThicknessIn;
  const Fu = plateFuKsi;
  const r1 = 1.2 * lcMinIn * t * Fu;
  const r2 = 2.4 * dBolt * t * Fu;
  const rnPerBolt = Math.min(r1, r2);
  const limit = r1 <= r2 ? ("1.2 Lc t Fu" as const) : ("2.4 d t Fu" as const);
  const phiRnTotal = PHI_BEARING * nBolts * rnPerBolt;
  const phiRnOne = PHI_BEARING * rnPerBolt;
  const nBoltsRequired =
    demandVu <= 0 || phiRnOne <= 0 ? 1 : Math.max(1, Math.ceil(demandVu / phiRnOne));
  return {
    rnPerBolt,
    phiRnTotal,
    isSafe: phiRnTotal >= demandVu,
    nBoltsRequired,
    limit,
  };
}

export type BoltShearBearingCombinedInput = BoltShearInput &
  BoltBearingInput & {
    /** Set false to skip bearing check (shear only). */
    includeBearing: boolean;
  };

export type BoltShearBearingCombinedOutput = {
  shear: BoltShearOutput;
  bearing: BoltBearingOutput | null;
  /** Nominal strength per bolt (min of shear and bearing nominal resistances). */
  rnPerBoltGoverning: number;
  phiRnTotalGoverning: number;
  isSafe: boolean;
  controlling: "shear" | "bearing";
  nBoltsRequiredGoverning: number;
};

/**
 * Governing bolt group strength: φ n min(R_n,shear, R_n,bearing per bolt) when bearing is included.
 * Shear and bearing both use φ = 0.75 per AISC J3/J4.
 */
export function calculateBoltShearBearingCombinedLRFD(
  input: BoltShearBearingCombinedInput,
): BoltShearBearingCombinedOutput {
  const shear = calculateBoltShearLRFD(input);
  if (!input.includeBearing || input.lcMinIn <= 0 || input.plateThicknessIn <= 0 || input.plateFuKsi <= 0) {
    return {
      shear,
      bearing: null,
      rnPerBoltGoverning: shear.RnPerBolt,
      phiRnTotalGoverning: shear.phiRnTotal,
      isSafe: shear.isSafe,
      controlling: "shear",
      nBoltsRequiredGoverning: shear.nBoltsRequired,
    };
  }
  const bearing = calculateBoltBearingLRFD(input);
  const rnShear = shear.RnPerBolt;
  const rnBear = bearing.rnPerBolt;
  const controlling = rnShear <= rnBear ? "shear" : "bearing";
  const rnPerBoltGoverning = Math.min(rnShear, rnBear);
  const phiRnTotalGoverning = PHI_SHEAR * input.nBolts * rnPerBoltGoverning;
  const phiRnOne = PHI_SHEAR * rnPerBoltGoverning;
  const nBoltsRequiredGoverning =
    input.demandVu <= 0 || phiRnOne <= 0 ? 1 : Math.max(1, Math.ceil(input.demandVu / phiRnOne));
  return {
    shear,
    bearing,
    rnPerBoltGoverning,
    phiRnTotalGoverning,
    isSafe: phiRnTotalGoverning >= input.demandVu,
    controlling,
    nBoltsRequiredGoverning,
  };
}

/** Bolt tension (J3.6): φR_n = φ n F_nt A_b — same φ as shear/bearing. */
export type BoltTensionInput = {
  demandTu: number;
  boltGroup: BoltGroup;
  threadMode: BoltThreadMode;
  dBolt: number;
  nBolts: number;
};

export type BoltTensionOutput = {
  Fnt: number;
  Ab: number;
  rnPerBolt: number;
  phiRnTotal: number;
  isSafe: boolean;
};

export function calculateBoltTensionLRFD(input: BoltTensionInput): BoltTensionOutput {
  const Fnt = boltFntKsi(input.boltGroup, input.threadMode);
  const Ab = boltAreaIn2(input.dBolt);
  const RnPerBolt = Fnt * Ab;
  const phiRnTotal = PHI_TENSION * input.nBolts * RnPerBolt;
  return {
    Fnt,
    Ab,
    rnPerBolt: RnPerBolt,
    phiRnTotal,
    isSafe: phiRnTotal >= input.demandTu,
  };
}

/**
 * Combined shear + tension on bolt group (AISC J3-7 style interaction for high-strength bolts):
 * (V_u / φR_nv)² + (T_u / φR_nt)² ≤ 1.0
 * Uses total group capacities φR_nv (min shear/bearing) and φR_nt (tension).
 */
export type BoltShearTensionInteractionInput = {
  demandVu: number;
  demandTu: number;
  /** Total available shear strength φR_n (governing of shear & bearing), kips */
  phiRnShearTotal: number;
  /** Total available tension strength φ n F_nt A_b, kips */
  phiRnTensionTotal: number;
};

export type BoltShearTensionInteractionOutput = {
  ratioShear: number;
  ratioTension: number;
  interactionSum: number;
  isSafe: boolean;
};

export type BoltSlipCriticalInput = {
  demandVu: number;
  boltGroup: BoltGroup;
  dBolt: number;
  nBolts: number;
  /** Slip planes per bolt (same role as shear planes for symmetric slip). */
  slipPlanes: 1 | 2;
  /** Class A (μ = 0.30) or B (μ = 0.50). */
  surfaceClass: keyof typeof SLIP_MU;
  /** Filler factor h_f — 1.0 with no / one filler; 0.85 with two+ (AISC). */
  hf: number;
  designMethod?: "LRFD" | "ASD";
};

export type BoltSlipCriticalOutput = {
  Tb: number;
  mu: number;
  rnPerBolt: number;
  RnTotal: number;
  /** Available slip resistance for the group (LRFD φR_n or ASD R_n/Ω). */
  availableSlip: number;
  isSafe: boolean;
  nBoltsRequired: number;
};

/**
 * AISC 360-16 J3.8 — slip resistance at required strength (standard holes).
 * R_n = n × (μ D_u h_f T_b n_s). LRFD: φ = 1.00; ASD: Ω = 1.50 for slip limit state.
 * Does not apply J3.9 tension reduction when T_u > 0 — reduce slip manually or extend later.
 */
export function calculateBoltSlipCritical(input: BoltSlipCriticalInput): BoltSlipCriticalOutput | null {
  const Tb = boltMinPretensionTbKips(input.boltGroup, input.dBolt);
  if (Tb === null) return null;
  const mu = SLIP_MU[input.surfaceClass];
  const rnPerBolt = mu * SLIP_DU * input.hf * Tb * input.slipPlanes;
  const RnTotal = rnPerBolt * input.nBolts;
  const method = input.designMethod ?? "LRFD";
  const availableSlip =
    method === "LRFD" ? PHI_SLIP_LRFD * RnTotal : RnTotal / OMEGA_SLIP_ASD;
  const phiRnPerBolt = method === "LRFD" ? PHI_SLIP_LRFD * rnPerBolt : rnPerBolt / OMEGA_SLIP_ASD;
  const nBoltsRequired =
    input.demandVu <= 0 || phiRnPerBolt <= 0 ? 1 : Math.max(1, Math.ceil(input.demandVu / phiRnPerBolt));
  return {
    Tb,
    mu,
    rnPerBolt,
    RnTotal,
    availableSlip,
    isSafe: availableSlip >= input.demandVu,
    nBoltsRequired,
  };
}

export function calculateBoltShearTensionInteractionLRFD(
  input: BoltShearTensionInteractionInput,
): BoltShearTensionInteractionOutput {
  const rs =
    input.phiRnShearTotal > 0 ? input.demandVu / input.phiRnShearTotal : input.demandVu > 0 ? 999 : 0;
  const rt =
    input.phiRnTensionTotal > 0 ? input.demandTu / input.phiRnTensionTotal : input.demandTu > 0 ? 999 : 0;
  const interactionSum = rs * rs + rt * rt;
  return {
    ratioShear: rs,
    ratioTension: rt,
    interactionSum,
    isSafe: interactionSum <= 1.0001,
  };
}

export type FilletWeldInput = {
  /** Electrode classification F_EXX (ksi), e.g. 70 for E70XX */
  fexx: number;
  /** Leg size a (in.) */
  legIn: number;
  /** Total effective length of weld (in.) — one line or sum of segments */
  lengthIn: number;
  demand: number;
};

export type FilletWeldOutput = {
  throat: number;
  /** Nominal strength per AISC: 0.6 F_EXX × 0.707 a × L */
  Rn: number;
  phiRn: number;
  isSafe: boolean;
  /** Length needed at this leg and F_EXX (in.) — design hint */
  lengthRequiredIn: number;
};

/** Minimum fillet leg (in.) so φR_n ≥ demand at given F_EXX and length (LRFD, φ = 0.75). */
export function filletWeldMinLegInForDemand(demandKips: number, fexx: number, lengthIn: number, phi = PHI_WELD): number {
  const denom = phi * 0.6 * fexx * 0.707 * lengthIn;
  return denom <= 0 ? 0 : demandKips / denom;
}

/** Fillet weld — LRFD φ = 0.75 on nominal shear on effective throat (introductory check). */
export function calculateFilletWeldLRFD(input: FilletWeldInput): FilletWeldOutput {
  const throat = 0.707 * input.legIn;
  const Rn = 0.6 * input.fexx * throat * input.lengthIn;
  const phiRn = PHI_WELD * Rn;
  const RnPerIn = 0.6 * input.fexx * throat;
  const phiRnPerIn = PHI_WELD * RnPerIn;
  const lengthRequiredIn = phiRnPerIn <= 0 ? 0 : input.demand / phiRnPerIn;
  return {
    throat,
    Rn,
    phiRn,
    isSafe: phiRn >= input.demand,
    lengthRequiredIn,
  };
}
