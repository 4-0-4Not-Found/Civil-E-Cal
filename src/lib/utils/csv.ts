/** Escape a cell for RFC 4180 CSV (Excel-compatible). */
function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Build CSV text from rows of strings. First row may be headers. */
export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map((c) => escapeCell(String(c))).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Flat object → two-column CSV (key, value). */
export function objectToKeyValueRows(obj: Record<string, unknown>): string[][] {
  const rows: string[][] = [["Key", "Value"]];
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      rows.push([k, JSON.stringify(v)]);
    } else {
      rows.push([k, String(v)]);
    }
  }
  return rows;
}
