/**
 * Prints expected outputs from the same calculation modules the app uses.
 * Run: npx tsx scripts/compute-verification-fixtures.ts
 */
import shapes from "../src/data/aisc-shapes-v16.json";
import { calculateBendingShearDesign } from "../src/lib/calculations/bending";
import { calculateCompressionDesign } from "../src/lib/calculations/compression";
import { calculateTensionDesign } from "../src/lib/calculations/tension";
import { staggeredNetWidthInches } from "../src/lib/calculations/net-area";
import type { AiscShape } from "../src/lib/aisc/types";

const round = (n: number, d: number) => Number(n.toFixed(d));

function pickShape(name: string): AiscShape {
  const s = (shapes as AiscShape[]).find((x) => x.shape === name);
  if (!s) throw new Error(`Shape ${name} not found`);
  return s;
}

const E = 29000;
const Fy992 = 50;
const Fu992 = 65;

console.log("=== VERIFICATION FIXTURES (app engine) ===\n");

// --- TENSION ---
console.log("--- T1 LRFD check (A992, W24X131 gross props) ---");
const t1 = calculateTensionDesign({
  designMethod: "LRFD",
  Fy: Fy992,
  Fu: Fu992,
  Ag: 38.6,
  An: 32,
  U: 0.9,
  demandPu: 900,
  Agv: 24,
  Anv: 20,
  Agt: 8,
  Ant: 6.5,
  ubs: 0.5,
});
console.log(
  JSON.stringify(
    {
      governingCase: t1.governingCase,
      controllingStrength: round(t1.controllingStrength, 3),
      demand: t1.demand,
      isSafe: t1.isSafe,
      grossYielding: round(t1.results.grossYielding.phiPn, 3),
      netFracture: round(t1.results.netFracture.phiPn, 3),
      blockShear: round(t1.results.blockShear.phiPn, 3),
    },
    null,
    2,
  ),
);

console.log("\n--- T2 ASD same inputs ---");
const t2 = calculateTensionDesign({
  designMethod: "ASD",
  Fy: Fy992,
  Fu: Fu992,
  Ag: 38.6,
  An: 32,
  U: 0.9,
  demandPu: 900,
  Agv: 24,
  Anv: 20,
  Agt: 8,
  Ant: 6.5,
  ubs: 0.5,
});
console.log(
  JSON.stringify(
    {
      governingCase: t2.governingCase,
      controllingStrength: round(t2.controllingStrength, 3),
      demand: t2.demand,
      isSafe: t2.isSafe,
      grossYielding: round(t2.results.grossYielding.phiPn, 3),
      netFracture: round(t2.results.netFracture.phiPn, 3),
      blockShear: round(t2.results.blockShear.phiPn, 3),
    },
    null,
    2,
  ),
);

console.log("\n--- T3 Staggered net W=10 in, n=2 holes, dh=0.875, s=3, g=3, t=0.75 ---");
const nw = staggeredNetWidthInches({
  grossWidthIn: 10,
  holeDiameterIn: 0.875,
  nHoles: 2,
  staggers: [{ sIn: 3, gIn: 3 }],
});
const an = nw * 0.75;
console.log(JSON.stringify({ netWidth_in: round(nw, 4), An_in2: round(an, 4) }, null, 2));

// --- COMPRESSION ---
const w24 = pickShape("W24X131");
console.log("\n--- C1 LRFD W24X131 K=1 L=240 in Pu=700 ---");
const c1 = calculateCompressionDesign({
  designMethod: "LRFD",
  Fy: Fy992,
  E,
  k: 1,
  L: 240,
  rx: w24.rx,
  ry: w24.ry,
  Ag: w24.A,
  lambdaFlange: w24.bf_2tf,
  lambdaWeb: w24.h_tw,
  demandPu: 700,
});
console.log(
  JSON.stringify(
    {
      KLrx: round((1 * 240) / w24.rx, 3),
      KLry: round((1 * 240) / w24.ry, 3),
      controllingStrength: round(c1.controllingStrength, 3),
      demand: c1.demand,
      isSafe: c1.isSafe,
    },
    null,
    2,
  ),
);

// --- BENDING ---
const hBeam = w24.h && w24.h > 0 ? w24.h : w24.d - 2 * w24.tf;
const wService = (0.8 + 3.2) / 12;
const Lin = 30 * 12;
const delta = (5 / 384) * wService * Lin ** 4 / (E * (w24.Ix || 1));
const wStrLrfd = Math.max(1.4 * 0.8, 1.2 * 0.8 + 1.6 * 3.2);
const MuDer = (wStrLrfd * 30 * 30) / 8;
const VuDer = (wStrLrfd * 30) / 2;

console.log("\n--- B1 LRFD derived loads D=0.8 L=3.2 klf span=30 ft W24X131 ---");
console.log(JSON.stringify({ wStrengthKlf: round(wStrLrfd, 4), MuDer: round(MuDer, 3), VuDer: round(VuDer, 3), wServiceKipIn: round(wService, 6) }, null, 2));

const b1 = calculateBendingShearDesign({
  designMethod: "LRFD",
  E,
  Fy: Fy992,
  Zx: w24.Zx,
  Sx: w24.Sx,
  Ix: w24.Ix,
  Iy: w24.Iy,
  ry: w24.ry,
  d: w24.d,
  bf: w24.bf,
  tf: w24.tf,
  lambdaFlange: w24.bf_2tf,
  lambdaWeb: w24.h_tw,
  h: hBeam,
  tw: w24.tw,
  a: w24.d,
  isStiffened: false,
  Mu: MuDer,
  Vu: VuDer,
  L: Lin,
  wLive: wService,
  deflection: delta,
  deflectionAllowable: Lin / 360,
  Lb: Lin,
  Cb: 1.14,
});
console.log(
  JSON.stringify(
    {
      phiMn: round(b1.results.bending.phiPn, 3),
      phiVn: round(b1.results.shear.phiPn, 3),
      deflection_in: round(delta, 4),
      defAllow_in: round(Lin / 360, 4),
      governing: b1.beamLimitStates?.governing,
      isSafe: b1.isSafe,
    },
    null,
    2,
  ),
);

console.log("\n--- B2 ASD same geometry demand from D+L w ---");
const wAsd = 0.8 + 3.2;
const MuAsd = (wAsd * 30 * 30) / 8;
const VuAsd = (wAsd * 30) / 2;
const b2 = calculateBendingShearDesign({
  designMethod: "ASD",
  E,
  Fy: Fy992,
  Zx: w24.Zx,
  Sx: w24.Sx,
  Ix: w24.Ix,
  Iy: w24.Iy,
  ry: w24.ry,
  d: w24.d,
  bf: w24.bf,
  tf: w24.tf,
  lambdaFlange: w24.bf_2tf,
  lambdaWeb: w24.h_tw,
  h: hBeam,
  tw: w24.tw,
  a: w24.d,
  isStiffened: false,
  Mu: MuAsd,
  Vu: VuAsd,
  L: Lin,
  wLive: wService,
  deflection: delta,
  deflectionAllowable: Lin / 360,
  Lb: Lin,
  Cb: 1.14,
});
console.log(
  JSON.stringify(
    {
      wAsdKlf: wAsd,
      MuAsd: round(MuAsd, 3),
      VuAsd: round(VuAsd, 3),
      MnOverOmega: round(b2.results.bending.phiPn, 3),
      VnOverOmega: round(b2.results.shear.phiPn, 3),
      governing: b2.beamLimitStates?.governing,
      isSafe: b2.isSafe,
    },
    null,
    2,
  ),
);

console.log("\n=== END ===");
