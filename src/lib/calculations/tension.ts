import type { CalculationOutput, CalculationResult, CalculationStep } from "@/lib/types/calculation";

export type TensionInput = {
  Fy: number;
  Fu: number;
  Ag: number;
  An: number;
  U: number;
  demandPu: number;
  Agv?: number;
  Anv?: number;
  Agt?: number;
  Ant?: number;
  /** AISC J4.3 U_bs: 1.0 uniform tension stress on net tension area; 0.5 non-uniform. */
  ubs?: number;
  /** LRFD (default) or ASD — AISC D2 / J4.3 Ω factors. */
  designMethod?: "LRFD" | "ASD";
};

const PHI_YIELD = 0.9;
const PHI_RUPTURE = 0.75;
const PHI_BLOCK = 0.75;
/** ASD safety factors — AISC D2 (yield, rupture), J4.3 block shear. */
const OMEGA_YIELD = 1.67;
const OMEGA_RUPTURE = 2.0;
const OMEGA_BLOCK = 2.0;

/**
 * AISC 360-16 J4.3: Rn = min(0.6F_u A_nv + U_bs F_u A_nt , 0.6F_y A_gv + U_bs F_u A_nt).
 * Both limit states use the same tension rupture term U_bs F_u A_nt.
 */
export function calculateTensionDesign(input: TensionInput): CalculationOutput {
  const { Fy, Fu, Ag, An, U, demandPu } = input;
  const method = input.designMethod ?? "LRFD";
  const Ae = An * U;
  const Agv = input.Agv ?? 0;
  const Anv = input.Anv ?? 0;
  const Ant = input.Ant ?? 0;

  const rnYield = Fy * Ag;
  const rnRupture = Fu * Ae;
  const Ubs = input.ubs ?? 0.5;

  const rnShearRuptureTensionRupture = 0.6 * Fu * Anv + Ubs * Fu * Ant;
  const rnShearYieldTensionRupture = 0.6 * Fy * Agv + Ubs * Fu * Ant;

  const hasNetAreas = Anv > 0 && Ant > 0;
  const hasGrossShear = Agv > 0;

  let rnBlock: number;
  let blockNote: string;

  if (!hasNetAreas) {
    rnBlock = Number.POSITIVE_INFINITY;
    blockNote = "Provide A_nv > 0 and A_nt > 0 for block shear (J4.3).";
  } else if (hasGrossShear) {
    rnBlock = Math.min(rnShearRuptureTensionRupture, rnShearYieldTensionRupture);
    blockNote =
      "J4.3: R_n = min(shear rupture + U_bs F_u A_nt, shear yield + U_bs F_u A_nt).";
  } else {
    rnBlock = rnShearRuptureTensionRupture;
    blockNote =
      "A_gv not provided — only the shear-rupture path (first J4.3 expression) is evaluated; add A_gv for the full min().";
  }

  const strengthYield =
    method === "LRFD" ? PHI_YIELD * rnYield : rnYield / OMEGA_YIELD;
  const strengthRupture =
    method === "LRFD" ? PHI_RUPTURE * rnRupture : rnRupture / OMEGA_RUPTURE;
  const strengthBlock =
    hasNetAreas && Number.isFinite(rnBlock) ? (method === "LRFD" ? PHI_BLOCK * rnBlock : rnBlock / OMEGA_BLOCK) : Number.POSITIVE_INFINITY;

  const results: Record<string, CalculationResult> = {
    grossYielding: { name: "Gross Section Yielding", phiPn: strengthYield, unit: "kips" },
    netFracture: { name: "Net Section Rupture", phiPn: strengthRupture, unit: "kips" },
    blockShear: { name: "Block Shear", phiPn: strengthBlock, unit: "kips" },
  };

  const ordered = Object.entries(results).sort((a, b) => a[1].phiPn - b[1].phiPn);
  const governingCase = ordered[0][0];
  const controllingStrength = ordered[0][1].phiPn;

  const blockSteps: CalculationStep[] = hasNetAreas
    ? [
        {
          id: "s4a",
          label: "Block shear — path 1 (shear rupture + tension rupture)",
          formula: "0.6 F_u A_nv + U_bs F_u A_nt",
          value: rnShearRuptureTensionRupture,
          unit: "kips",
          note: `U_bs = ${Ubs}`,
        },
        ...(hasGrossShear
          ? [
              {
                id: "s4b",
                label: "Block shear — path 2 (shear yield + tension rupture)",
                formula: "0.6 F_y A_gv + U_bs F_u A_nt",
                value: rnShearYieldTensionRupture,
                unit: "kips",
              } as CalculationStep,
            ]
          : []),
        {
          id: "s4c",
          label: "Block shear — nominal R_n",
          formula: "min(path 1, path 2) when A_gv > 0",
          value: rnBlock,
          unit: "kips",
          note: blockNote,
        },
        {
          id: "s4d",
          label: method === "LRFD" ? "Block shear — design strength" : "Block shear — allowable",
          formula: method === "LRFD" ? "phi P_n = 0.75 R_n" : "P_n / Ω = R_n / 2.0",
          value: strengthBlock,
          unit: "kips",
        },
      ]
    : [
        {
          id: "s4c",
          label: "Block shear strength",
          formula: "-",
          value: "Not provided",
          note: blockNote,
        },
      ];

  const steps: CalculationStep[] = [
    { id: "s1", label: "Effective net area", formula: "A_e = A_n U", value: Ae, unit: "in^2" },
    {
      id: "s2",
      label: method === "LRFD" ? "Yielding strength" : "Yielding allowable",
      formula: method === "LRFD" ? "phi P_n = 0.9 F_y A_g" : "F_y A_g / 1.67",
      value: strengthYield,
      unit: "kips",
    },
    {
      id: "s3",
      label: method === "LRFD" ? "Rupture strength" : "Rupture allowable",
      formula: method === "LRFD" ? "phi P_n = 0.75 F_u A_e" : "F_u A_e / 2.00",
      value: strengthRupture,
      unit: "kips",
    },
    ...blockSteps,
    {
      id: "s5",
      label: method === "LRFD" ? "Controlling design strength" : "Controlling allowable strength",
      formula: method === "LRFD" ? "phi P_n = min(modes)" : "P_a = min(modes)",
      value: controllingStrength,
      unit: "kips",
    },
  ];

  return {
    steps,
    results,
    governingCase,
    controllingStrength,
    demand: demandPu,
    isSafe: controllingStrength >= demandPu,
  };
}


