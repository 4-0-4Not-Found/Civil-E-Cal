/** Flange and web slenderness vs AISC Table B4.1 limits (W-shape flexure context). */

export type SlendernessRow = {
  label: string;
  lambda: number;
  lambdaP: number;
  lambdaR: number;
  class: "Compact" | "Non-Compact" | "Slender";
};

export function flangeWebSlenderness(E: number, Fy: number, bf_2tf: number, h_tw: number): {
  flange: SlendernessRow;
  web: SlendernessRow;
} {
  const lambdaPf = 0.38 * Math.sqrt(E / Fy);
  const lambdaRf = 1.0 * Math.sqrt(E / Fy);
  const lambdaRw = 3.76 * Math.sqrt(E / Fy);
  const lambdaWw = 5.7 * Math.sqrt(E / Fy);

  const flangeClass: SlendernessRow["class"] =
    bf_2tf <= lambdaPf ? "Compact" : bf_2tf < lambdaRf ? "Non-Compact" : "Slender";
  const webClass: SlendernessRow["class"] =
    h_tw <= lambdaRw ? "Compact" : h_tw < lambdaWw ? "Non-Compact" : "Slender";

  return {
    flange: {
      label: "Flange (λ = b_f / 2t_f)",
      lambda: bf_2tf,
      lambdaP: lambdaPf,
      lambdaR: lambdaRf,
      class: flangeClass,
    },
    web: {
      label: "Web (λ = h / t_w)",
      lambda: h_tw,
      lambdaP: lambdaRw,
      lambdaR: lambdaWw,
      class: webClass,
    },
  };
}
