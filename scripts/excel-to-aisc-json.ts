import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? "src/data/aisc-shapes-v16.json";

if (!sourcePath) {
  throw new Error("Usage: npm run aisc:convert -- <path-to-excel> [output-json-path]");
}

const workbook = xlsx.readFile(sourcePath, { raw: true });
const sheet = workbook.Sheets["Database v16.0"] ?? workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null });
const headers = (rows[0] ?? []).map((item) => String(item ?? "").trim());

const headerIndex: Record<string, number> = {};
for (let i = 0; i < headers.length; i += 1) {
  if (headers[i] && headerIndex[headers[i]] === undefined) headerIndex[headers[i]] = i;
}

const num = (row: (string | number | null)[], header: string) => {
  const idx = headerIndex[header];
  if (idx === undefined) return 0;
  const value = row[idx];
  if (typeof value === "number") return value;
  if (value === null) return 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const txt = (row: (string | number | null)[], header: string) => {
  const idx = headerIndex[header];
  if (idx === undefined) return "";
  const value = row[idx];
  return String(value ?? "").trim();
};

const mapped = rows
  .slice(1)
  .map((row) => ({
    shape: txt(row, "AISC_Manual_Label"),
    type: txt(row, "Type") || "OTHER",
    W: num(row, "W"),
    A: num(row, "A"),
    d: num(row, "d"),
    h: num(row, "h"),
    bf: num(row, "bf"),
    tf: num(row, "tf"),
    tw: num(row, "tw"),
    Ix: num(row, "Ix"),
    Iy: num(row, "Iy"),
    Zx: num(row, "Zx"),
    Sx: num(row, "Sx"),
    Zy: num(row, "Zy"),
    rx: num(row, "rx"),
    ry: num(row, "ry"),
    bf_2tf: num(row, "bf/2tf"),
    h_tw: num(row, "h/tw"),
  }))
  .filter((row) => row.shape.length > 0);

const target = path.resolve(outputPath);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(mapped, null, 2), "utf8");

console.log(`Converted ${mapped.length} shapes to ${target}`);
