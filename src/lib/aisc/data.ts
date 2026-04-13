import shapes from "@/data/aisc-shapes-v16.json";
import type { AiscShape } from "@/lib/aisc/types";

export const aiscShapes = shapes as AiscShape[];

export const shapeMap = Object.fromEntries(
  aiscShapes.map((shape) => [shape.shape, shape]),
) as Record<string, AiscShape>;
