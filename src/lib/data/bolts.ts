/** AISC 360-16 Table J3.2 — nominal shear strength F_nv (ksi), threads in vs out of shear plane. */

export type BoltGroup = "A307" | "A325" | "A490";

/** Threads in shear plane (N) vs excluded from shear plane (X) — typical tabulated values. */
export type BoltThreadMode = "N" | "X";

/** F_nv,N and F_nv,X (ksi) per group — course-style values aligned with Table J3.2. */
export const boltFnvPairKsi: Record<BoltGroup, { fnvN: number; fnvX: number }> = {
  A307: { fnvN: 24, fnvX: 24 },
  A325: { fnvN: 54, fnvX: 60 },
  A490: { fnvN: 68, fnvX: 75 },
};

export function boltFnvKsi(group: BoltGroup, mode: BoltThreadMode): number {
  const p = boltFnvPairKsi[group];
  return mode === "N" ? p.fnvN : p.fnvX;
}

/** AISC Table J3.2 — nominal tensile strength F_nt (ksi) for bolt tension limit state. */
export const boltFntPairKsi: Record<BoltGroup, { fntN: number; fntX: number }> = {
  A307: { fntN: 45, fntX: 45 },
  A325: { fntN: 90, fntX: 100 },
  A490: { fntN: 113, fntX: 127 },
};

export function boltFntKsi(group: BoltGroup, mode: BoltThreadMode): number {
  const p = boltFntPairKsi[group];
  return mode === "N" ? p.fntN : p.fntX;
}

/** Standard bolt diameters (in.) with gross area A_b = π d² / 4 (in²) */
export const boltDiametersIn = [0.5, 0.625, 0.75, 0.875, 1] as const;

export function boltAreaIn2(dInches: number): number {
  return (Math.PI * dInches * dInches) / 4;
}

/**
 * AISC 360-16 Table J3.1 — minimum bolt pretension T_b (kips) for fully tightened bolts.
 * Used for slip-critical slip resistance (J3.8 / J3.9). Values for common diameters only.
 */
const TB_A325_KIPS: Record<string, number> = {
  "0.5": 12,
  "0.625": 19,
  "0.75": 28,
  "0.875": 39,
  "1": 51,
};

const TB_A490_KIPS: Record<string, number> = {
  "0.5": 15,
  "0.625": 24,
  "0.75": 35,
  "0.875": 49,
  "1": 64,
};

/** Returns null if group/diameter not used for slip-critical pretension (e.g. A307). */
export function boltMinPretensionTbKips(group: BoltGroup, dBoltInches: number): number | null {
  const key = String(dBoltInches);
  if (group === "A325") return TB_A325_KIPS[key] ?? null;
  if (group === "A490") return TB_A490_KIPS[key] ?? null;
  return null;
}
