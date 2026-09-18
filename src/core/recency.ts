/* Recency thresholds — centralized and configurable (Phase 6). */

export const DAY = 86_400_000;

export const RECENCY_BUCKETS = {
  very_recent_max_ms: 14 * DAY,
  recent_max_ms: 30 * DAY,
  aging_max_ms: 90 * DAY,
  // anything older than this is "old"
} as const;

export type RecencyLevel = "very_recent" | "recent" | "aging" | "old" | "unknown";

export function recencyLevel(ts: number | null | undefined, now: number = Date.now()): RecencyLevel {
  if (!ts || ts <= 0) return "unknown";
  const age = now - ts;
  if (age <= RECENCY_BUCKETS.very_recent_max_ms) return "very_recent";
  if (age <= RECENCY_BUCKETS.recent_max_ms) return "recent";
  if (age <= RECENCY_BUCKETS.aging_max_ms) return "aging";
  return "old";
}

export function recencyLabel(level: RecencyLevel): string {
  switch (level) {
    case "very_recent": return "Very recent";
    case "recent": return "Recent";
    case "aging": return "Aging";
    case "old": return "Old";
    case "unknown": return "Unknown";
  }
}
