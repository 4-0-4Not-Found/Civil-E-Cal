import { describe, expect, it } from "vitest";
import { lrfdFactoredUniformLoadKlf, asdStrengthUniformLoadKlf, serviceUniformLoadKlf } from "@/lib/excel-parity";
import { calculateTensionDesign } from "@/lib/calculations/tension";

describe("excel-parity loads", () => {
  it("LRFD uniform load D=0.5, L=1.0 klf", () => {
    expect(lrfdFactoredUniformLoadKlf(0.5, 1.0)).toBeCloseTo(2.2, 9);
  });
  it("ASD strength and service D+L", () => {
    expect(asdStrengthUniformLoadKlf(0.5, 1.0)).toBeCloseTo(1.5, 9);
    expect(serviceUniformLoadKlf(0.5, 1.0)).toBeCloseTo(1.5, 9);
  });
});

describe("tension LRFD", () => {
  it("governing block shear matches fixture", () => {
    const r = calculateTensionDesign({
      designMethod: "LRFD",
      Fy: 50,
      Fu: 65,
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
    expect(r.controllingStrength).toBeCloseTo(698.4375, 2);
  });
});
