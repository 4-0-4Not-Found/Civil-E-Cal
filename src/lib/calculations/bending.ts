import type { BeamLimitStates, CalculationOutput } from "@/lib/types/calculation";

export type BendingInput = {
  designMethod: "LRFD" | "ASD";
  E: number;
  Fy: number;
  Zx: number;
  Sx: number;
  Ix: number;
  /** Minor-axis inertia (in⁴) — LTB L_r, r_ts */
  Iy: number;
  /** Radius of gyration about y (in) — L_p */
  ry: number;
  d: number;
  bf: number;
  tf: number;
  lambdaFlange: number;
  lambdaWeb: number;
  h: number;
  tw: number;
  a: number;
  isStiffened: boolean;
  Vu: number;
  Mu: number;
  /** Span / deflection reference length (in) */
  L: number;
  wLive: number;
  deflection: number;
  deflectionAllowable: number;
  /**
   * Unbraced length for lateral-torsional buckling (in).
   * Typical: full span for a simply supported beam with no intermediate bracing.
   */
  Lb: number;
  /** AISC F1: lateral-torsional buckling modification factor (e.g. 1.0 uniform moment, 1.14 uniform load SS). */
  Cb: number;
  /**
   * Rolled W-shape (default) vs rectangular HSS strong-axis — HSS uses wall slenderness limits
   * from Table B4.1b (HSS), thin-walled box J, and shear area on two webs (approximate F7/G5-style checks).
   */
  sectionProfile?: "W" | "HSS";
};

/** Thin-walled rectangular tube torsional constant (in⁴) — midline path. */
function thinWallBoxJ(bf: number, d: number, tMean: number): number {
  const bm = Math.max(bf - tMean, 1e-6);
  const dm = Math.max(d - tMean, 1e-6);
  const A0 = bm * dm;
  const path = 2 * (bm + dm);
  return (4 * A0 * A0 * tMean) / path;
}

function safeRatio(demand: number, capacity: number): number {
  if (!Number.isFinite(capacity) || capacity <= 0) return demand > 0 ? 999 : 0;
  return demand / capacity;
}

function beamGeometryError(input: BendingInput, message: string): CalculationOutput {
  const phiMn = 0;
  const phiVn = 0;
  const beamLimitStates: BeamLimitStates = {
    bending: { demand: input.Mu, capacity: phiMn, ratio: safeRatio(input.Mu, phiMn), unit: "kip-ft" },
    shear: { demand: input.Vu, capacity: phiVn, ratio: safeRatio(input.Vu, phiVn), unit: "kips", cv: 0, cvCase: "—" },
    deflection: {
      demand: input.deflection,
      capacity: input.deflectionAllowable,
      ratio: safeRatio(input.deflection, input.deflectionAllowable),
      unit: "in",
    },
    governing: "bending",
  };
  return {
    steps: [
      {
        id: "b-err",
        label: "Analysis stopped",
        value: message,
        note: "Valid dimensions required (d, b_f, t_f, t_w, h/t_w). W and HSS rectangular use different local-buckling limits.",
      },
    ],
    results: {
      bending: { name: "φM_n (bending)", phiPn: phiMn, unit: "kip-ft" },
      shear: { name: "φV_n (shear)", phiPn: phiVn, unit: "kips" },
    },
    governingCase: "geometry_error",
    controllingStrength: 0,
    demand: input.Mu,
    isSafe: false,
    beamLimitStates,
  };
}

/**
 * AISC 360-16: rolled W-shape strong axis — Table B4.1b (flange) + F6 (FLB), F2 (LTB), G2 (shear), deflection.
 */
export function calculateBendingShearDesign(input: BendingInput): CalculationOutput {
  const E = input.E;
  const Fy = input.Fy;

  if (
    input.Zx <= 0 ||
    input.Sx <= 0 ||
    input.Iy <= 0 ||
    input.ry <= 0 ||
    input.d <= 0 ||
    input.tf <= 0 ||
    input.tw <= 0 ||
    input.bf <= 0 ||
    input.h <= 0
  ) {
    return beamGeometryError(input, "Section properties must be positive (Z_x, S_x, I_y, r_y, d, b_f, t_f, t_w, h).");
  }

  const profile = input.sectionProfile ?? "W";
  const ho = input.d - input.tf;
  const hw = input.d - 2 * input.tf;
  const tMean = (input.tf + input.tw) / 2;
  const J =
    profile === "HSS"
      ? thinWallBoxJ(input.bf, input.d, tMean)
      : (2 * input.bf * input.tf ** 3) / 3 + (hw * input.tw ** 3) / 3;

  if (ho <= 1e-6 || J <= 1e-12) {
    return beamGeometryError(input, "Invalid I-shape depth or torsional constant J — check d, b_f, t_f, t_w.");
  }

  const r_ts = Math.sqrt((input.Iy * ho) / (2 * input.Sx));
  if (!Number.isFinite(r_ts) || r_ts <= 0) {
    return beamGeometryError(input, "Could not compute r_ts for LTB — check I_y, d, t_f, S_x.");
  }

  /** W-flange (B4.1b rolled I) vs HSS wall in flexural compression (Table B4.1b HSS limits — introductory). */
  const lambdaPf = profile === "HSS" ? 1.12 * Math.sqrt(E / Fy) : 0.38 * Math.sqrt(E / Fy);
  const lambdaRf = profile === "HSS" ? 1.4 * Math.sqrt(E / Fy) : 1.0 * Math.sqrt(E / Fy);

  /** When λ_f is missing in data, assume compact flange (conservative for FLB if unknown). */
  const lfRaw = input.lambdaFlange;
  const lf = lfRaw > 1e-6 ? lfRaw : lambdaPf * 0.5;

  const flangeFlexureClass: "Compact" | "Non-Compact" | "Slender" =
    lf <= lambdaPf ? "Compact" : lf < lambdaRf ? "Non-Compact" : "Slender";

  const Mp_kipin = Fy * input.Zx;

  const λwKc = Math.max(input.lambdaWeb, 1e-6);
  const kc = Math.min(0.76, Math.max(0.35, 4 / Math.sqrt(λwKc)));

  let MnFlb_kipin: number;
  if (flangeFlexureClass === "Compact") {
    MnFlb_kipin = Mp_kipin;
  } else if (flangeFlexureClass === "Non-Compact") {
    MnFlb_kipin =
      Mp_kipin -
      (Mp_kipin - 0.7 * Fy * input.Sx) * ((lf - lambdaPf) / (lambdaRf - lambdaPf));
  } else {
    const MnSlender = (0.9 * E * kc * input.Sx) / (lf * lf);
    MnFlb_kipin = Math.min(Mp_kipin, MnSlender);
  }

  const LpRaw = 1.76 * input.ry * Math.sqrt(E / Fy);
  const sxHoOverJ = (input.Sx * ho) / J;
  const inner = 6.76 * ((0.7 * Fy) / E * sxHoOverJ) ** 2;
  const LrRaw =
    1.95 *
    r_ts *
    (E / (0.7 * Fy)) *
    Math.sqrt(J / (input.Sx * ho)) *
    Math.sqrt(1 + Math.sqrt(1 + inner));

  /** F2-5 and F2-6 — use each formula’s value (do not swap); typically L_p < L_r for W-shapes. */
  const Lp = LpRaw;
  const Lr = LrRaw;

  const Lb = Math.max(0, input.Lb);
  const Cb = Math.max(0.1, input.Cb);

  let MnLtb_kipin: number;
  if (Lb <= Lp) {
    MnLtb_kipin = Mp_kipin;
  } else if (Lb <= Lr) {
    const denom = Lr - Lp;
    if (denom <= 1e-9) {
      MnLtb_kipin = Mp_kipin;
    } else {
      MnLtb_kipin = Math.min(
        Mp_kipin,
        Cb * (Mp_kipin - (Mp_kipin - 0.7 * Fy * input.Sx) * ((Lb - Lp) / denom)),
      );
    }
  } else {
    const lbRts = Lb / r_ts;
    const Fcr_ltb =
      ((Cb * Math.PI ** 2 * E) / (lbRts * lbRts)) *
      Math.sqrt(1 + 0.078 * (J / (input.Sx * ho)) * lbRts * lbRts);
    MnLtb_kipin = Math.min(Mp_kipin, Fcr_ltb * input.Sx);
  }

  const Mn_kipin = Math.min(MnFlb_kipin, MnLtb_kipin);
  const mn_ft = Mn_kipin / 12;

  const phiMn = input.designMethod === "LRFD" ? 0.9 * mn_ft : mn_ft / 1.67;

  /** HSS: shear carried by two side webs (G5-style area); W-shape: single web panel. */
  const Aw = profile === "HSS" ? 2 * input.h * input.tw : input.h * input.tw;
  if (Aw <= 0) {
    return beamGeometryError(input, "Shear area A_w = h × t_w must be positive.");
  }

  const kv = input.isStiffened ? (input.h / input.a > 3 ? 5 : 5 + 5 / (input.h / input.a) ** 2) : 5;
  const lambdaV1 = 2.24 * Math.sqrt(E / Fy);
  const lambdaV2 = 1.1 * Math.sqrt((kv * E) / Fy);
  const lambdaV3 = 1.37 * Math.sqrt((kv * E) / Fy);

  const λw = input.lambdaWeb;
  let Cv = 1;
  let shearCase = "Case 1";
  if (λw <= 1e-6) {
    Cv = 1;
    shearCase = "Case 1 (λ web n/a — C_v = 1)";
  } else if (λw <= lambdaV1) {
    Cv = 1;
    shearCase = "Case 1";
  } else if (λw <= lambdaV2) {
    Cv = 1;
    shearCase = "Case 2a";
  } else if (λw <= lambdaV3) {
    Cv = lambdaV2 / λw;
    shearCase = "Case 2b";
  } else {
    /** AISC 360-16 G2-9 — elastic web shear buckling (no TFA): C_v = 0.51 E k_v / (F_y (h/t_w)²). */
    Cv = (0.51 * E * kv) / (λw ** 2 * Fy);
    shearCase = "Case 2c";
  }

  const vn = 0.6 * Fy * Aw * Cv;
  const phiVn = input.designMethod === "LRFD" ? 1.0 * vn : vn / 1.5;

  const ratioBending = safeRatio(input.Mu, phiMn);
  const ratioShear = safeRatio(input.Vu, phiVn);
  const ratioDeflection = safeRatio(input.deflection, input.deflectionAllowable);

  const beamLimitStates = {
    bending: { demand: input.Mu, capacity: phiMn, ratio: ratioBending, unit: "kip-ft" as const },
    shear: {
      demand: input.Vu,
      capacity: phiVn,
      ratio: ratioShear,
      unit: "kips" as const,
      cv: Cv,
      cvCase: shearCase,
    },
    deflection: {
      demand: input.deflection,
      capacity: input.deflectionAllowable,
      ratio: ratioDeflection,
      unit: "in" as const,
    },
    governing: (() => {
      const pairs: Array<["bending" | "shear" | "deflection", number]> = [
        ["bending", ratioBending],
        ["shear", ratioShear],
        ["deflection", ratioDeflection],
      ];
      pairs.sort((a, b) => b[1] - a[1]);
      return pairs[0][0];
    })(),
  } satisfies BeamLimitStates;

  const governingCase: string = beamLimitStates.governing;
  let controllingStrength: number;
  let demand: number;
  if (beamLimitStates.governing === "bending") {
    controllingStrength = phiMn;
    demand = input.Mu;
  } else if (beamLimitStates.governing === "shear") {
    controllingStrength = phiVn;
    demand = input.Vu;
  } else {
    controllingStrength = input.deflectionAllowable;
    demand = input.deflection;
  }

  const isSafe = phiMn >= input.Mu && phiVn >= input.Vu && input.deflection <= input.deflectionAllowable;

  const flexureControl =
    profile === "HSS"
      ? MnFlb_kipin <= MnLtb_kipin
        ? "HSS wall local buckling (approx. λ limits)"
        : "Lateral-torsional buckling (F2-style — verify AISC F7 for HSS)"
      : MnFlb_kipin <= MnLtb_kipin
        ? "Flange local buckling (F6)"
        : "Lateral-torsional buckling (F2)";

  const steps = [
    { id: "b-prof", label: "Section profile", formula: profile === "HSS" ? "HSS rectangular (approx. F7/G)" : "Rolled W", value: profile },
    ...(lfRaw <= 1e-6
      ? [
          {
            id: "b-note",
            label: "Flange / wall slenderness",
            formula: "λ not in database — assumed compact for local buckling",
            value: "See note",
            note: "Using λ ≈ 0.5 λ_pf for classification only.",
          } as const,
        ]
      : []),
    {
      id: "b0",
      label: profile === "HSS" ? "Wall class (HSS flexure, Table B4.1b-style λ)" : "Flange class (flexure, Table B4.1b)",
      formula: "λ vs λ_pf, λ_rf",
      value: flangeFlexureClass,
    },
    {
      id: "b0b",
      label: "Flexure — nominal M_n (local buckling)",
      formula: profile === "HSS" ? "HSS wall limit states (introductory)" : "F6; k_c for slender flange",
      value: MnFlb_kipin / 12,
      unit: "kip-ft",
    },
    { id: "b0c", label: "Flexure — nominal M_n (LTB)", formula: `F2; C_b = ${Cb}, L_b = ${Lb.toFixed(2)} in`, value: MnLtb_kipin / 12, unit: "kip-ft" },
    { id: "b0d", label: "Flexure — governing nominal", formula: flexureControl, value: mn_ft, unit: "kip-ft" },
    { id: "b0e", label: "L_p, L_r (in)", formula: "F2-5, F2-6", value: `${Lp.toFixed(2)}, ${Lr.toFixed(2)}`, unit: "in" },
    { id: "b1", label: "Flexural strength φM_n", formula: "LRFD 0.9 M_n", value: phiMn, unit: "kip-ft" },
    {
      id: "b2",
      label: "Shear case (G2)",
      formula: profile === "HSS" ? "G5/G2-style; A_w = 2 h t_w (two webs)" : "Case 1 / 2a / 2b / 2c",
      value: shearCase,
    },
    { id: "b3", label: "k_v", formula: "AISC G2", value: kv, unit: "-" },
    { id: "b4", label: "C_v", formula: "AISC G2", value: Cv, unit: "-" },
    { id: "b5", label: "Shear strength φV_n / V_n/Ω", formula: "§G2: φ=1.0 LRFD, Ω=1.5 ASD", value: phiVn, unit: "kips" },
    { id: "b6", label: "Deflection", formula: "δ ≤ allowable (live)", value: `${input.deflection} in ≤ ${input.deflectionAllowable} in` },
  ];

  return {
    steps,
    results: {
      bending: { name: "φM_n (bending)", phiPn: phiMn, unit: "kip-ft" },
      shear: { name: "φV_n (shear)", phiPn: phiVn, unit: "kips" },
    },
    governingCase,
    controllingStrength,
    demand,
    isSafe,
    beamLimitStates,
  };
}
