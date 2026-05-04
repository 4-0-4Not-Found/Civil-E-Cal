export type CalculationStep = {
  id: string;
  label: string;
  formula?: string;
  value: number | string;
  unit?: string;
  note?: string;
};

export type CalculationResult = {
  name: string;
  phiPn: number;
  unit: string;
};

/** Per–limit-state checks for bending/shear/deflection (selected member only). */
export type BeamLimitStates = {
  bending: { demand: number; capacity: number; ratio: number; unit: "kip-ft" };
  shear: { demand: number; capacity: number; ratio: number; unit: "kips"; cv: number; cvCase: string };
  deflection: { demand: number; capacity: number; ratio: number; unit: "ft" };
  governing: "bending" | "shear" | "deflection";
};

export type CalculationOutput = {
  steps: CalculationStep[];
  results: Record<string, CalculationResult>;
  governingCase: string;
  controllingStrength: number;
  demand: number;
  isSafe: boolean;
  beamLimitStates?: BeamLimitStates;
};
