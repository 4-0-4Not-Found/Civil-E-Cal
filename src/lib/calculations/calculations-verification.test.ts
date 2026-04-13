/**
 * Automated regression tests aligned with `src/data/VERIFICATION_TESTS.md`
 * and `scripts/compute-verification-fixtures.ts`.
 *
 * Field names in comments match localStorage / UI state keys in:
 * - `/tension` — material, shapeName, Ag, An, U, Pu, Agv, Anv, Agt, Ant, ubs, designMethod
 * - `/compression` — material, shapeName, k, L, Pu, designMethod
 * - `/bending-shear` — designMethod, material, shapeName, deadLoadKft, liveLoadKft, spanFt, Mu, Vu, L, wLive, unbracedLbIn, cbFactor
 * - `/connections` — designMethod, shearMode, vu, tu, boltGroup, dBolt, nBolts, shearPlanes, threadMode, checkBearing, plateFu, plateT, lcMin, surfaceClass, slipHf, fexx, legIn, weldLen, weldDemand
 */
import { describe, expect, it } from "vitest";
import shapes from "@/data/aisc-shapes-v16.json";
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
import { calculateTensionDesign } from "@/lib/calculations/tension";
import { staggeredNetWidthInches } from "@/lib/calculations/net-area";
import { summarizeConnectionsFromStorage, summarizeTension } from "@/lib/report/build-summary";
import type { AiscShape } from "@/lib/aisc/types";

const E = 29000;
const Fy992 = 50;
const Fu992 = 65;

function pickShape(name: string): AiscShape {
  const s = (shapes as AiscShape[]).find((x) => x.shape === name);
  if (!s) throw new Error(`Shape ${name} not found`);
  return s;
}

describe("Tension (calculateTensionDesign) — fields: material→Fy/Fu via steel map; Ag, An, U, Pu, Agv, Anv, Agt, Ant, ubs, designMethod", () => {
  it("T1 LRFD — governing blockShear, NOT SAFE (Pu=900)", () => {
    const r = calculateTensionDesign({
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
    expect(r.governingCase).toBe("blockShear");
    expect(r.controllingStrength).toBeCloseTo(698.438, 2);
    expect(r.results.grossYielding.phiPn).toBeCloseTo(1737, 2);
    expect(r.results.netFracture.phiPn).toBeCloseTo(1404, 2);
    expect(r.results.blockShear.phiPn).toBeCloseTo(698.438, 2);
    expect(r.isSafe).toBe(false);
  });

  it("T2 ASD — same inputs, lower allowable", () => {
    const r = calculateTensionDesign({
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
    expect(r.governingCase).toBe("blockShear");
    expect(r.controllingStrength).toBeCloseTo(465.625, 2);
    expect(r.results.grossYielding.phiPn).toBeCloseTo(1155.689, 2);
    expect(r.results.netFracture.phiPn).toBeCloseTo(936, 2);
    expect(r.results.blockShear.phiPn).toBeCloseTo(465.625, 2);
    expect(r.isSafe).toBe(false);
  });

  it("T3 staggered net — grossWidthIn, holeDiameterIn, nHoles, staggers s/g; An = netWidth × t", () => {
    const nw = staggeredNetWidthInches({
      grossWidthIn: 10,
      holeDiameterIn: 0.875,
      nHoles: 2,
      staggers: [{ sIn: 3, gIn: 3 }],
    });
    expect(nw).toBeCloseTo(9, 6);
    const an = nw * 0.75;
    expect(an).toBeCloseTo(6.75, 6);
  });

  it("T4 LRFD — Pu=650 SAFE (same capacities as T1)", () => {
    const r = calculateTensionDesign({
      designMethod: "LRFD",
      Fy: Fy992,
      Fu: Fu992,
      Ag: 38.6,
      An: 32,
      U: 0.9,
      demandPu: 650,
      Agv: 24,
      Anv: 20,
      Agt: 8,
      Ant: 6.5,
      ubs: 0.5,
    });
    expect(r.controllingStrength).toBeCloseTo(698.438, 2);
    expect(r.isSafe).toBe(true);
  });
});

describe("Compression (calculateCompressionDesign) — fields: material→Fy; shapeName→section props; k, L, Pu, designMethod", () => {
  const w24 = pickShape("W24X131");

  it("C1 LRFD — φPn ≈ 1077.569, SAFE vs Pu=700", () => {
    const c = calculateCompressionDesign({
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
    expect((1 * 240) / w24.rx).toBeCloseTo(23.529, 2);
    expect((1 * 240) / w24.ry).toBeCloseTo(80.808, 2);
    expect(c.controllingStrength).toBeCloseTo(1077.569, 2);
    expect(c.isSafe).toBe(true);
  });

  it("C2 ASD — allowable ≈ 716.945 vs Pa=700", () => {
    const c = calculateCompressionDesign({
      designMethod: "ASD",
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
    expect(c.controllingStrength).toBeCloseTo(716.945, 2);
    expect(c.isSafe).toBe(true);
  });

  it("C3 LRFD — NOT SAFE at Pu=1200", () => {
    const c = calculateCompressionDesign({
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
      demandPu: 1200,
    });
    expect(c.controllingStrength).toBeCloseTo(1077.569, 2);
    expect(c.isSafe).toBe(false);
  });
});

describe("Bending (calculateBendingShearDesign) — fields: designMethod, material→Fy; shapeName→props; deadLoadKft, liveLoadKft, spanFt OR Mu, Vu, L, wLive, unbracedLbIn, cbFactor", () => {
  const w24 = pickShape("W24X131");
  const hBeam = w24.h && w24.h > 0 ? w24.h : w24.d - 2 * w24.tf;
  const Lin = 30 * 12;
  const wService = (0.8 + 3.2) / 12;
  const delta = (5 / 384) * wService * Lin ** 4 / (E * (w24.Ix || 1));
  const wStrLrfd = Math.max(1.4 * 0.8, 1.2 * 0.8 + 1.6 * 3.2);
  const MuDer = (wStrLrfd * 30 * 30) / 8;
  const VuDer = (wStrLrfd * 30) / 2;

  it("B1 LRFD — D/L/span drives M,V; governing bending SAFE", () => {
    expect(wStrLrfd).toBeCloseTo(6.08, 4);
    expect(MuDer).toBeCloseTo(684, 3);
    expect(VuDer).toBeCloseTo(91.2, 3);
    const b = calculateBendingShearDesign({
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
    expect(b.results.bending.phiPn).toBeCloseTo(1032.333, 2);
    expect(b.results.shear.phiPn).toBeCloseTo(409.827, 2);
    expect(delta).toBeCloseTo(0.625, 2);
    expect(b.beamLimitStates?.governing).toBe("bending");
    expect(b.isSafe).toBe(true);
  });

  it("B2 ASD — w = D+L = 4 klf, M=450, V=60 kips", () => {
    const wAsd = 0.8 + 3.2;
    const MuAsd = (wAsd * 30 * 30) / 8;
    const VuAsd = (wAsd * 30) / 2;
    expect(MuAsd).toBeCloseTo(450, 3);
    expect(VuAsd).toBeCloseTo(60, 3);
    const b = calculateBendingShearDesign({
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
    expect(b.results.bending.phiPn).toBeCloseTo(686.848, 2);
    expect(b.results.shear.phiPn).toBeCloseTo(273.218, 2);
    expect(b.beamLimitStates?.governing).toBe("bending");
    expect(b.isSafe).toBe(true);
  });
});

describe("Connections — fields: designMethod, shearMode, vu, tu, boltGroup, dBolt, nBolts, shearPlanes, threadMode, checkBearing, plateFu, plateT, lcMin, surfaceClass, slipHf, fexx, legIn, weldLen, weldDemand", () => {
  it("N1 bearing — includeBearing false, shear-only SAFE", () => {
    const n1 = calculateBoltShearBearingCombinedLRFD({
      demandVu: 120,
      boltGroup: "A325",
      threadMode: "N",
      dBolt: 0.75,
      nBolts: 4,
      shearPlanes: 2,
      includeBearing: false,
      lcMinIn: 1.25,
      plateThicknessIn: 0.5,
      plateFuKsi: 65,
    });
    expect(n1.shear.Fnv).toBe(54);
    expect(n1.phiRnTotalGoverning).toBeCloseTo(143.139, 2);
    expect(n1.isSafe).toBe(true);
  });

  it("N2 slip-critical — NOT SAFE (Vu > available slip)", () => {
    const n2 = calculateBoltSlipCritical({
      demandVu: 80,
      boltGroup: "A325",
      dBolt: 0.75,
      nBolts: 4,
      slipPlanes: 2,
      surfaceClass: "A",
      hf: 1,
      designMethod: "LRFD",
    });
    expect(n2).not.toBeNull();
    expect(n2!.Tb).toBe(28);
    expect(n2!.availableSlip).toBeCloseTo(75.936, 2);
    expect(n2!.isSafe).toBe(false);
  });

  it("N3 bolt tension — NOT SAFE", () => {
    const n3 = calculateBoltTensionLRFD({
      demandTu: 150,
      boltGroup: "A325",
      threadMode: "N",
      dBolt: 0.75,
      nBolts: 4,
    });
    expect(n3.Fnt).toBe(90);
    expect(n3.phiRnTotal).toBeCloseTo(119.282, 2);
    expect(n3.isSafe).toBe(false);
  });

  it("N4 shear–tension interaction — SAFE", () => {
    const n4b = calculateBoltShearBearingCombinedLRFD({
      demandVu: 60,
      boltGroup: "A325",
      threadMode: "N",
      dBolt: 0.75,
      nBolts: 4,
      shearPlanes: 2,
      includeBearing: true,
      lcMinIn: 1.25,
      plateThicknessIn: 0.5,
      plateFuKsi: 65,
    });
    const n4t = calculateBoltTensionLRFD({
      demandTu: 40,
      boltGroup: "A325",
      threadMode: "N",
      dBolt: 0.75,
      nBolts: 4,
    });
    const int = calculateBoltShearTensionInteractionLRFD({
      demandVu: 60,
      demandTu: 40,
      phiRnShearTotal: n4b.phiRnTotalGoverning,
      phiRnTensionTotal: n4t.phiRnTotal,
    });
    expect(int.interactionSum).toBeCloseTo(0.288, 2);
    expect(int.isSafe).toBe(true);
  });

  it("N5 fillet weld — demand exceeds φRn", () => {
    const n5 = calculateFilletWeldLRFD({ fexx: 70, legIn: 0.25, lengthIn: 4, demand: 50 });
    expect(n5.throat).toBeCloseTo(0.1767, 3);
    expect(n5.phiRn).toBeCloseTo(22.27, 2);
    expect(n5.isSafe).toBe(false);
  });

  it("N6 ASD — N1 shear capacity scales to allowable", () => {
    const n1 = calculateBoltShearBearingCombinedLRFD({
      demandVu: 120,
      boltGroup: "A325",
      threadMode: "N",
      dBolt: 0.75,
      nBolts: 4,
      shearPlanes: 2,
      includeBearing: false,
      lcMinIn: 1.25,
      plateThicknessIn: 0.5,
      plateFuKsi: 65,
    });
    const asd = lrfdToAsdSamePhiOmega(n1.phiRnTotalGoverning);
    expect(asd).toBeCloseTo(n1.phiRnTotalGoverning / (0.75 * 2), 4);
  });
});

describe("Report pipeline — summarizeTension / summarizeConnectionsFromStorage (string payloads like localStorage)", () => {
  it("T1 strings — same controlling strength as calculateTensionDesign", () => {
    const p: Record<string, string> = {
      material: "A992",
      designMethod: "LRFD",
      Ag: "38.6",
      An: "32",
      U: "0.9",
      Pu: "900",
      Agv: "24",
      Anv: "20",
      Agt: "8",
      Ant: "6.5",
      ubs: "0.5",
    };
    const s = summarizeTension(p);
    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.output.controllingStrength).toBeCloseTo(698.438, 2);
      expect(s.output.governingCase).toBe("blockShear");
    }
  });

  it("connections JSON — N1-style payload, shear SAFE", () => {
    const raw: Record<string, unknown> = {
      designMethod: "LRFD",
      shearMode: "bearing",
      vu: "120",
      tu: "0",
      boltGroup: "A325",
      dBolt: "0.75",
      nBolts: "4",
      shearPlanes: "2",
      threadMode: "N",
      checkBearing: false,
      plateFu: "65",
      plateT: "0.5",
      lcMin: "1.25",
      surfaceClass: "A",
      slipHf: "1",
      fexx: "70",
      legIn: "0.25",
      weldLen: "4",
      weldDemand: "50",
    };
    const s = summarizeConnectionsFromStorage(raw);
    expect(s.ok).toBe(true);
    expect(s.phiRnShearGoverning).toBeCloseTo(143.139, 2);
    expect(s.shearSafe).toBe(true);
  });
});
