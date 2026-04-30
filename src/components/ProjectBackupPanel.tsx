"use client";

import { useCallback, useRef, useState } from "react";
import { STORAGE } from "@/lib/storage/keys";
import { applyBundle, collectBundle } from "@/lib/storage/project-bundle";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function ProjectBackupPanel() {
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const toast = useToast();

  const download = useCallback(() => {
    const bundle = collectBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `civilecal-project-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Download started — includes inputs saved from each module you have used.");
    toast.push({ title: "Download started", message: a.download, tone: "info" });
  }, [toast]);

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (applyBundle(data)) {
          setMsg("Loaded — refresh the page or open each module to see values.");
          toast.push({ title: "Loaded", message: "Project restored from JSON.", tone: "good" });
        } else {
          setMsg("Could not read project file.");
          toast.push({ title: "Load failed", message: "Could not read project file.", tone: "bad" });
        }
      } catch {
        setMsg("Invalid JSON file.");
        toast.push({ title: "Invalid file", message: "That JSON file could not be parsed.", tone: "bad" });
      }
      e.target.value = "";
    };
    reader.readAsText(f);
  }, [toast]);

  const clearAll = useCallback(() => {
    setConfirmClearOpen(true);
  }, []);

  const doClearAll = useCallback(() => {
    Object.values(STORAGE).forEach((k) => localStorage.removeItem(k));
    ["tension", "compression", "bending"].forEach((m) =>
      localStorage.removeItem(`ssc:ts:${m}`),
    );
    localStorage.removeItem("ssc:lastRoute");
    setMsg("Saved inputs cleared for this browser.");
    toast.push({ title: "Cleared", message: "Saved inputs removed for this browser.", tone: "info" });
  }, [toast]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <ConfirmDialog
        open={confirmClearOpen}
        contextLabel="localhost:3000"
        title="Clear all saved inputs for this browser?"
        description={
          <p>
            This removes saved fields for every module and cannot be undone.
          </p>
        }
        confirmLabel="OK"
        cancelLabel="Cancel"
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={() => {
          setConfirmClearOpen(false);
          doClearAll();
        }}
      />
      <p className="font-semibold text-slate-900">Save / load project</p>
      <p className="mt-1 text-slate-600">
        Each calculator saves its fields to this device as you work. Download one JSON file to back up everything, or load a
        file to restore.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" onClick={download}>
          Download project JSON
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          Load project JSON
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        <Button type="button" variant="danger" size="sm" onClick={clearAll}>
          Clear saved inputs
        </Button>
      </div>

      {msg ? <p className="mt-3 text-slate-600">{msg}</p> : null}
    </div>
  );
}
