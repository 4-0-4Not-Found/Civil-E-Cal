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
