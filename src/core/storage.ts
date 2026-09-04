/* ── Data access layer ──────────────────────────────────────────────────
 * All persistence goes through the StorageAdapter interface so the
 * localStorage implementation used by this local-first build can be
 * swapped for a server-backed adapter (PostgreSQL, etc.) without
 * touching services or UI. See README → Architecture.
 */

export type Collection =
  | "users"
  | "sessions"
  | "projects"
  | "prospects"
  | "events"
  | "feedback"
  | "drafts";

export interface StorageAdapter {
  read<T>(col: Collection): T[];
  write<T>(col: Collection, rows: T[]): void;
  getMeta(key: string): string | null;
  setMeta(key: string, value: string | null): void;
}

const NS = "userscout:v1";

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return []; // malformed rows never crash boot
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  read<T>(col: Collection): T[] {
    return safeParse<T>(localStorage.getItem(`${NS}:${col}`));
  }
  write<T>(col: Collection, rows: T[]): void {
    try {
      localStorage.setItem(`${NS}:${col}`, JSON.stringify(rows));
    } catch {
      /* quota exceeded — surfaced by caller via thrown AppError */
      throw new Error("storage-full");
    }
  }
  getMeta(key: string): string | null {
    return localStorage.getItem(`${NS}:meta:${key}`);
  }
  setMeta(key: string, value: string | null): void {
    if (value === null) localStorage.removeItem(`${NS}:meta:${key}`);
    else localStorage.setItem(`${NS}:meta:${key}`, value);
  }
}

/* Singleton adapter for the running app. */
export const storage: StorageAdapter = new LocalStorageAdapter();
