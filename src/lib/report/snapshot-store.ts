import { STORAGE } from "@/lib/storage/keys";
import {
  summarizeBending,
  summarizeCompression,
  summarizeConnectionsFromStorage,
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

/** Connections payload may include booleans (e.g. checkBearing). */
export function parseConnectionsObjectStore(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE.connections);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return typeof o === "object" && o !== null ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Read all four module blobs — call only in the browser after mount. */
export function readModuleStoresFromLocalStorage() {
  return {
    tension: parseModuleStringStore(STORAGE.tension),
    compression: parseModuleStringStore(STORAGE.compression),
    bending: parseModuleStringStore(STORAGE.bending),
    connections: parseConnectionsObjectStore(),
  };
}

/** Summaries used by Report and Workspace (same engine as each calculator). */
export function summarizeModuleStores(stores: ReturnType<typeof readModuleStoresFromLocalStorage>) {
  return {
    tension: summarizeTension(stores.tension),
    compression: summarizeCompression(stores.compression),
    bending: summarizeBending(stores.bending),
    connections: summarizeConnectionsFromStorage(stores.connections),
  };
}
