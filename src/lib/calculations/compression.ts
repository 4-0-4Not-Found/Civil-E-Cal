import type { CalculationOutput } from "@/lib/types/calculation";

export type CompressionInput = {
  Fy: number;
  E: number;
  k: number;
  L: number;
  rx: number;
  ry: number;
  Ag: number;
  lambdaFlange: number;
  lambdaWeb: number;
  demandPu: number;
  /** LRFD (default) or ASD — E3 flexural buckling Ω = 1.67. */
  designMethod?: "LRFD" | "ASD";
};

/**
 * AISC 360-16 E3 flexural buckling with critical stress limited by E7-style local buckling
 * when flange or web is slender (elastic local buckling stress 0.69E/λ²).
 * Stiffened web buckling uses the same form as a simplified lower bound when slender.
 */
export function calculateCompressionDesign(input: CompressionInput): CalculationOutput {
  const KLrx = (input.k * input.L) / input.rx;
  const KLry = (input.k * input.L) / input.ry;
  const KLr = Math.max(KLrx, KLry);
  const Fe = (Math.PI ** 2 * input.E) / (KLr ** 2);
  const limit = 4.71 * Math.sqrt(input.E / input.Fy);

  const lambdaRF = 0.38 * Math.sqrt(input.E / input.Fy);
  const lambdaWF = 1.0 * Math.sqrt(input.E / input.Fy);
  const lambdaRW = 3.76 * Math.sqrt(input.E / input.Fy);
  const lambdaWW = 5.7 * Math.sqrt(input.E / input.Fy);

  const flangeClass =
    input.lambdaFlange <= lambdaRF ? "Compact" : input.lambdaFlange < lambdaWF ? "Non-Compact" : "Slender";
  const webClass =
    input.lambdaWeb <= lambdaRW ? "Compact" : input.lambdaWeb < lambdaWW ? "Non-Compact" : "Slender";

  const FcrColumn =
    KLr <= limit ? (0.658 ** (input.Fy / Fe)) * input.Fy : 0.877 * Fe;

  /** E7-style elastic local buckling limit (ksi) for slender unstiffened/stiffened plate slenderness λ. */
  const localBucklingStress = (lambda: number) => (0.69 * input.E) / (lambda ** 2);

  const FcrFlangeLocal = flangeClass === "Slender" ? localBucklingStress(input.lambdaFlange) : Number.POSITIVE_INFINITY;
  const FcrWebLocal = webClass === "Slender" ? localBucklingStress(input.lambdaWeb) : Number.POSITIVE_INFINITY;

  /** Critical stress (ksi) — flexural buckling of column limited by plate slenderness (conservative min). */
  const Fcr = Math.min(FcrColumn, FcrFlangeLocal, FcrWebLocal);

  const method = input.designMethod ?? "LRFD";
  const nominalPn = Fcr * input.Ag;
  const phiPn = method === "LRFD" ? 0.9 * nominalPn : nominalPn / 1.67;

  const missingSlendernessData = input.lambdaFlange <= 1e-9 && input.lambdaWeb <= 1e-9;

  return {
    steps: [
      ...(missingSlendernessData
        ? [
            {
              id: "c0",
              label: "Local slenderness data",
              formula: "—",
              value:
                "b_f/2t_f and h/t_w are not in this extract — capacity uses member flexural buckling (E3) only. For HSS/Pipe, check wall slenderness per AISC separately.",
            },
          ]
        : []),
      { id: "c1", label: "Member slenderness major", formula: "KL/r_x", value: KLrx, unit: "-" },
      { id: "c1b", label: "Member slenderness minor", formula: "KL/r_y", value: KLry, unit: "-" },
      { id: "c1c", label: "Controlling slenderness", formula: "max(KL/r_x, KL/r_y)", value: KLr, unit: "-" },
      { id: "c2a", label: "Flange class (Table B4.1)", formula: "λ_f vs λ_p, λ_r", value: flangeClass },
      { id: "c2b", label: "Web class (Table B4.1)", formula: "λ_w vs λ_p, λ_r", value: webClass },
      { id: "c2", label: "Elastic buckling stress (E3)", formula: "F_e = π² E / (KL/r)²", value: Fe, unit: "ksi" },
      { id: "c2d", label: "Column buckling stress F_cr, col (E3)", formula: "inelastic or elastic branch", value: FcrColumn, unit: "ksi" },
      ...(flangeClass === "Slender"
        ? [
            {
              id: "c2e",
              label: "Flange local buckling limit (E7-style)",
              formula: "0.69 E / λ_f²",
              value: FcrFlangeLocal,
              unit: "ksi",
            },
          ]
        : []),
      ...(webClass === "Slender"
        ? [
            {
              id: "c2f",
              label: "Web local buckling limit (simplified E7-style)",
              formula: "0.69 E / λ_w²",
              value: FcrWebLocal,
              unit: "ksi",
            },
          ]
        : []),
      { id: "c3", label: "Governing critical stress F_cr", formula: "min(column, local limits)", value: Fcr, unit: "ksi" },
      {
        id: "c4",
        label: method === "LRFD" ? "Design compressive strength" : "Allowable compressive strength",
        formula: method === "LRFD" ? "phi P_n = 0.9 F_cr A_g" : "P_n / Omega = F_cr A_g / 1.67",
        value: phiPn,
        unit: "kips",
      },
    ],
    results: {
      compression: { name: "Compression Capacity", phiPn, unit: "kips" },
    },
    governingCase: "compression",
    controllingStrength: phiPn,
    demand: input.demandPu,
    isSafe: phiPn >= input.demandPu,
  };
}
