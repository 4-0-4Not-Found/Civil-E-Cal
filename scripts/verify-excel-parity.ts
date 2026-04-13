/**
 * Quick sanity check: LRFD factored uniform load matches typical course Excel (Jason-style).
 * Run: npx tsx scripts/verify-excel-parity.ts
 */
import {
  asdStrengthUniformLoadKlf,
  lrfdFactoredUniformLoadKlf,
  serviceUniformLoadKlf,
} from "../src/lib/excel-parity";

function assertClose(a: number, b: number, tol = 1e-9, msg = "") {
  if (Math.abs(a - b) > tol) throw new Error(`${msg} expected ${b}, got ${a}`);
}

// Example: D=0.5, L=1.0 → max(0.7, 2.2) = 2.2 klf
assertClose(lrfdFactoredUniformLoadKlf(0.5, 1.0), 2.2, 1e-9, "LRFD w");
assertClose(serviceUniformLoadKlf(0.5, 1.0), 1.5, 1e-9, "service w");
assertClose(asdStrengthUniformLoadKlf(0.5, 1.0), 1.5, 1e-9, "ASD strength w (D+L)");

console.log("verify-excel-parity: OK");
