export type SteelMaterialKey = string;

export type SteelMaterial = {
  key: SteelMaterialKey;
  label: string;
  Fy: number;
  Fu: number;
};

/**
 * Steel grades consolidated from client workbook / AISC table snapshots.
 * Keep keys stable (spec + grade) so saved projects remain readable.
 */
export const steelMaterials: SteelMaterial[] = [
  { key: "A36", label: "ASTM A36", Fy: 36, Fu: 58 },
  { key: "A53-B", label: "ASTM A53 Gr. B", Fy: 35, Fu: 60 },
  { key: "A500-B42", label: "ASTM A500 Gr. B (Fy 42)", Fy: 42, Fu: 58 },
  { key: "A500-B46", label: "ASTM A500 Gr. B (Fy 46)", Fy: 46, Fu: 58 },
  { key: "A500-C46", label: "ASTM A500 Gr. C (Fy 46)", Fy: 46, Fu: 62 },
  { key: "A500-C50", label: "ASTM A500 Gr. C (Fy 50)", Fy: 50, Fu: 62 },
  { key: "A501-A36", label: "ASTM A501 Gr. A", Fy: 36, Fu: 58 },
  { key: "A501-B50", label: "ASTM A501 Gr. B", Fy: 50, Fu: 70 },
  { key: "A529-50", label: "ASTM A529 Gr. 50", Fy: 50, Fu: 65 },
  { key: "A529-55", label: "ASTM A529 Gr. 55", Fy: 55, Fu: 70 },
  { key: "A572-42", label: "ASTM A572 Gr. 42", Fy: 42, Fu: 60 },
  { key: "A572-50", label: "ASTM A572 Gr. 50", Fy: 50, Fu: 65 },
  { key: "A572-55", label: "ASTM A572 Gr. 55", Fy: 55, Fu: 70 },
  { key: "A572-60", label: "ASTM A572 Gr. 60", Fy: 60, Fu: 75 },
  { key: "A572-65", label: "ASTM A572 Gr. 65", Fy: 65, Fu: 80 },
  { key: "A618-IaIbII", label: "ASTM A618 Gr. Ia, Ib, II", Fy: 50, Fu: 70 },
  { key: "A618-III", label: "ASTM A618 Gr. III", Fy: 50, Fu: 65 },
  { key: "A709-36", label: "ASTM A709 Gr. 36", Fy: 36, Fu: 58 },
  { key: "A709-50", label: "ASTM A709 Gr. 50", Fy: 50, Fu: 65 },
  { key: "A709-50S", label: "ASTM A709 Gr. 50S", Fy: 50, Fu: 65 },
  { key: "A709-50W", label: "ASTM A709 Gr. 50W", Fy: 50, Fu: 70 },
  { key: "A913-50", label: "ASTM A913 Gr. 50", Fy: 50, Fu: 65 },
  { key: "A913-60", label: "ASTM A913 Gr. 60", Fy: 60, Fu: 75 },
  { key: "A992", label: "ASTM A992 (W)", Fy: 50, Fu: 65 },
  /** Legacy key kept for compatibility with stored projects and older forms. */
  { key: "A572", label: "ASTM A572 Gr.50 (legacy key)", Fy: 50, Fu: 65 },
  /** Legacy key kept for compatibility with stored projects and older forms. */
  { key: "A500", label: "ASTM A500 Gr.C (legacy key)", Fy: 50, Fu: 62 },
];

export const steelMaterialMap = Object.fromEntries(
  steelMaterials.map((material) => [material.key, material]),
) as Record<string, SteelMaterial>;
