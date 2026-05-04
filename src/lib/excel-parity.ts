/**
 * Conventions aligned with the course Excel workbooks (formula snapshots under
 * `src/data/excel-logic/Steel Design Programs (Jason, Shaine, Kyla).formulas.json`).
 *
 * Typical patterns: `IF(L9="LRFD", 0.75*..., .../2)` for φ/Ω; uniform beam LRFD uses
 * `max(1.4*D, 1.2*D + 1.6*L)` klf for factored w (same as AISC B2 combinations for DL/LL only).
 */

/** Factored uniform load (kips/ft) for LRFD — DL and LL in klf. */
export function lrfdFactoredUniformLoadKlf(deadLoadKlf: number, liveLoadKlf: number): number {
  return Math.max(1.4 * deadLoadKlf, 1.2 * deadLoadKlf + 1.6 * liveLoadKlf);
}

/** Service uniform load for deflection (kips/ft) — unfactored D + L, as used for δ checks in many class sheets. */
export function serviceUniformLoadKlf(deadLoadKlf: number, liveLoadKlf: number): number {
  return deadLoadKlf + liveLoadKlf;
}

/**
 * Required uniform load (klf) for **ASD strength** when only dead + live are given.
 * ASCE 7-16 ASD load combination 2 (typical floor live): **D + L** — same service w as deflection for that combo,
 * compared to nominal strength with Ω in AISC.
 */
export function asdStrengthUniformLoadKlf(deadLoadKlf: number, liveLoadKlf: number): number {
  return deadLoadKlf + liveLoadKlf;
}

/**
 * Round to a fixed number of decimals (typical course Excel display = 3 places for forces).
 * Use for **presentation / CSV** — underlying calculations stay full precision unless you round earlier.
 */
export function roundLikeExcel(n: number, decimals = 3): number {
  if (!Number.isFinite(n)) return n;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Midspan deflection (feet), simply supported, uniform load — **Steel Design Programs** sheet
 * “Bending, Shear, and Deflection”, cell **Q14** expansion:
 * `(5/384)*R9*R8^4/((29000*R10)*(12^2)*(1/12)^3)` with `R9` = w (kip/ft), `R8` = span (ft), `R10` = I_x (in⁴).
 *
 * Matches spreadsheet numbers directly (worksheet deflection values shown in ft).
 */
export function beamSimplySupportedUniformDeflectionFt(
  wLiveKlf: number,
  spanFt: number,
  EKsi: number,
  ixIn4: number,
): number {
  if (!Number.isFinite(wLiveKlf) || !Number.isFinite(spanFt) || !Number.isFinite(EKsi) || !Number.isFinite(ixIn4)) {
    return 0;
  }
  if (!(spanFt > 0) || !(ixIn4 > 0) || !(EKsi > 0)) return 0;
  return ((5 / 384) * wLiveKlf * spanFt ** 4 * 12) / (EKsi * ixIn4);
}
