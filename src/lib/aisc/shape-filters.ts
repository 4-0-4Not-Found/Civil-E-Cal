import type { AiscShape } from "@/lib/aisc/types";

/** Filters aligned with client questionnaire (W, S, C, L, HSS, …) — plus other v16 labels in the JSON. */
export type ShapeFamilyKey =
  | "all"
  | "W"
  | "HSS"
  | "S"
  | "C"
  | "L"
  | "WT"
  | "M"
  | "PIPE"
  | "2L"
  | "OTHER";

export const shapeFamilyOptions: { key: ShapeFamilyKey; label: string }[] = [
  { key: "all", label: "All families (with valid properties)" },
  { key: "W", label: "W — wide flange" },
  { key: "HSS", label: "HSS — box / pipe" },
  { key: "S", label: "S — American Standard beam" },
  { key: "C", label: "C — channel" },
  { key: "L", label: "L — angle" },
  { key: "WT", label: "WT / MT / ST — tee" },
  { key: "M", label: "M — miscellaneous" },
  { key: "PIPE", label: "PIPE" },
  { key: "2L", label: "2L — double angle" },
  { key: "OTHER", label: "Other (from database)" },
];

function hasValidCompressionProps(s: AiscShape): boolean {
  return s.A > 0 && s.rx > 0 && s.ry > 0;
}

function hasValidTensionProps(s: AiscShape): boolean {
  return s.A > 0;
}

/** Filter shapes for axial member pickers. */
export function filterShapesByFamily(
  shapes: AiscShape[],
  family: ShapeFamilyKey,
  mode: "compression" | "tension",
): AiscShape[] {
  const base = mode === "compression" ? shapes.filter(hasValidCompressionProps) : shapes.filter(hasValidTensionProps);
  if (family === "all") return base.slice().sort((a, b) => a.shape.localeCompare(b.shape));
  if (family === "OTHER") {
    const known = new Set(["W", "HSS", "S", "C", "L", "WT", "M", "PIPE", "2L"]);
    return base.filter((s) => !known.has(s.type)).sort((a, b) => a.shape.localeCompare(b.shape));
  }
  return base.filter((s) => s.type === family).sort((a, b) => a.shape.localeCompare(b.shape));
}
