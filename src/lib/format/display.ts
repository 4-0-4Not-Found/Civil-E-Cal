/** Display: ~3 decimals on final forces and strengths for readability. */
export const FINAL_DECIMALS = 3;

export function fmtKips(n: number, decimals = FINAL_DECIMALS): string {
  return Number.isFinite(n) ? n.toFixed(decimals) : "—";
}

export function fmtKipFt(n: number, decimals = FINAL_DECIMALS): string {
  return Number.isFinite(n) ? n.toFixed(decimals) : "—";
}
