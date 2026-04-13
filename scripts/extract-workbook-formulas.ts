import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const sourcePath = process.argv[2];
const outDir = process.argv[3] ?? "src/data/excel-logic";

if (!sourcePath) {
  throw new Error("Usage: npm run excel:formulas -- <workbook-path> [output-dir]");
}

const wb = xlsx.readFile(sourcePath, { cellFormula: true });
const output: Record<string, Array<{ cell: string; formula: string }>> = {};

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const cells = Object.keys(ws).filter((k) => !k.startsWith("!"));
  output[sheetName] = cells
    .filter((cell) => ws[cell]?.f)
    .map((cell) => ({ cell, formula: String(ws[cell].f) }));
}

fs.mkdirSync(path.resolve(outDir), { recursive: true });
const base = path.basename(sourcePath).replace(/\.[^.]+$/, "");
const target = path.resolve(outDir, `${base}.formulas.json`);
fs.writeFileSync(target, JSON.stringify(output, null, 2), "utf8");
console.log(`Saved formulas to ${target}`);
