import { STORAGE } from "@/lib/storage/keys";
import {
  summarizeBending,
  summarizeCompression,
  summarizeTension,
} from "@/lib/report/build-summary";

/** Parse a string-keyed module payload from localStorage (tension, compression, bending). */
export function parseModuleStringStore(key: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return typeof o === "object" && o !== null ? (o as Record<string, string>) : null;
  } catch {
    return null;
  }
}

/** Read all module blobs — call only in the browser after mount. */
export function readModuleStoresFromLocalStorage() {
  return {
    tension: parseModuleStringStore(STORAGE.tension),
    compression: parseModuleStringStore(STORAGE.compression),
    bending: parseModuleStringStore(STORAGE.bending),
  };
}

/** Summaries used by Report and Workspace (same engine as each calculator). */
export function summarizeModuleStores(stores: ReturnType<typeof readModuleStoresFromLocalStorage>) {
  return {
    tension: summarizeTension(stores.tension),
    compression: summarizeCompression(stores.compression),
    bending: summarizeBending(stores.bending),
  };
}
