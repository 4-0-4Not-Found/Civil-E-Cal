import { STORAGE } from "@/lib/storage/keys";

function safeJsonParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Single-file backup of all module inputs (same shape as download JSON). */
export function collectBundle() {
  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    tension: safeJsonParse(typeof window !== "undefined" ? localStorage.getItem(STORAGE.tension) : null),
    compression: safeJsonParse(typeof window !== "undefined" ? localStorage.getItem(STORAGE.compression) : null),
    bending: safeJsonParse(typeof window !== "undefined" ? localStorage.getItem(STORAGE.bending) : null),
    connections: safeJsonParse(typeof window !== "undefined" ? localStorage.getItem(STORAGE.connections) : null),
  };
}

export function applyBundle(data: unknown) {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (typeof o.tension === "object" && o.tension !== null) {
    localStorage.setItem(STORAGE.tension, JSON.stringify(o.tension));
  }
  if (typeof o.compression === "object" && o.compression !== null) {
    localStorage.setItem(STORAGE.compression, JSON.stringify(o.compression));
  }
  if (typeof o.bending === "object" && o.bending !== null) {
    localStorage.setItem(STORAGE.bending, JSON.stringify(o.bending));
  }
  if (typeof o.connections === "object" && o.connections !== null) {
    localStorage.setItem(STORAGE.connections, JSON.stringify(o.connections));
  }
  return true;
}
