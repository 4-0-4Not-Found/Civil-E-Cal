/**
 * AISC 360-16 Section D3 — net width for staggered holes on a tension path.
 * Net width = gross width − Σd_h + Σ (s² / 4g) for each stagger between gage lines.
 */

export type StaggeredNetWidthInput = {
  /** Gross width along the failure path (in.) */
  grossWidthIn: number;
  /** Hole diameter d_h (in.) */
  holeDiameterIn: number;
  /** Number of holes cutting the path (integer ≥ 0) */
  nHoles: number;
  /**
   * Optional: one or more stagger corrections. Each entry is pitch s (in.) and gage g (in.)
   * between gage lines for that stagger (g > 0).
   */
  staggers?: ReadonlyArray<{ sIn: number; gIn: number }>;
};

/**
 * Returns net width (in.) for use as A_n = t × net_width when thickness is uniform.
 */
export function staggeredNetWidthInches(input: StaggeredNetWidthInput): number {
  const { grossWidthIn, holeDiameterIn, nHoles, staggers } = input;
  let w = grossWidthIn - nHoles * holeDiameterIn;
  if (staggers && staggers.length > 0) {
    for (const { sIn, gIn } of staggers) {
      if (gIn > 0) w += (sIn * sIn) / (4 * gIn);
    }
  }
  return w;
}
