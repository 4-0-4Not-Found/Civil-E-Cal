"use client";

import { downloadCsv, rowsToCsv } from "@/lib/utils/csv";

type Props = {
  filename: string;
  rows: string[][];
  label?: string;
};

/** Downloads an Excel-compatible CSV file. */
export function ExportCsvButton(props: Props) {
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
      onClick={() => {
        downloadCsv(props.filename, rowsToCsv(props.rows));
      }}
    >
      {props.label ?? "Download CSV (Excel)"}
    </button>
  );
}
