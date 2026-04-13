"use client";

import { useCallback, useRef, useState } from "react";
import { STORAGE } from "@/lib/storage/keys";
import { applyBundle, collectBundle } from "@/lib/storage/project-bundle";

export function ProjectBackupPanel() {
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = useCallback(() => {
    const bundle = collectBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `civilecal-project-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Download started — includes inputs saved from each module you have used.");
  }, []);

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (applyBundle(data)) {
          setMsg("Loaded — refresh the page or open each module to see values.");
        } else {
          setMsg("Could not read project file.");
        }
      } catch {
        setMsg("Invalid JSON file.");
      }
      e.target.value = "";
    };
    reader.readAsText(f);
  }, []);

  const clearAll = useCallback(() => {
    Object.values(STORAGE).forEach((k) => localStorage.removeItem(k));
    setMsg("Saved inputs cleared for this browser.");
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">Save / load project</p>
      <p className="mt-1 text-slate-600">
        Each calculator saves its fields to this device as you work. Download one JSON file to back up everything, or load a
        file to restore.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700"
        >
          Download project JSON
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium hover:bg-slate-50">
          Load project JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        <button type="button" onClick={clearAll} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-red-800 hover:bg-red-50">
          Clear saved inputs
        </button>
      </div>

      {msg ? <p className="mt-3 text-slate-600">{msg}</p> : null}
    </div>
  );
}
