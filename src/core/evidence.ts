/* Evidence classification and deduplication (Phases 2 + 3).
 *
 * Pure, deterministic. Same input → same output. No AI. */

import type {
  DiscoveryCandidate,
  Evidence,
  EvidenceStrength,
  Signal,
} from "./types";

/** Classify a single evidence item into a strength tier. */
export function classifyEvidence(e: Evidence): EvidenceStrength {
  switch (e.kind) {
    case "issue": {
      // Issue evidence is either "asked for a solution" (very strong)
      // or "discussed" (strong). The text encodes which one the
      // discovery engine chose.
      if (/^\s*Asked\b/i.test(e.text)) return "very_strong";
      return "strong";
    }
    case "repo":
      return "strong";
    case "contribution":
      return "strong";
    case "profile":
      // Profile evidence is either a language/topic overlap (weak)
      // or a bio/audience alignment (medium). Detect by phrasing.
      if (/Overlapping topics|Works in /i.test(e.text)) return "weak";
      if (/audience/i.test(e.text)) return "medium";
      return "weak";
  }
}

const STRENGTH_ORDER: EvidenceStrength[] = ["weak", "medium", "strong", "very_strong"];
export function strongestOf(items: Evidence[]): EvidenceStrength {
  let idx = 0;
  for (const e of items) {
    const s = classifyEvidence(e);
    const i = STRENGTH_ORDER.indexOf(s);
    if (i > idx) idx = i;
  }
  return STRENGTH_ORDER[idx];
}

/** Deterministic dedup fingerprint for an evidence item. */
export function fingerprint(e: Evidence): string {
  const url = (e.url ?? "").replace(/[#?].*$/, "").toLowerCase();
  const text = e.text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
  return `${e.kind}::${url || text}`;
}

/** Deduplicate a flat list of evidence items, preserving order. */
export function dedupeEvidence(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const e of items) {
    const fp = fingerprint(e);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push({ ...e, strength: classifyEvidence(e), fingerprint: fp });
  }
  return out;
}

/** Assign strength + fingerprint to all evidence in a candidate. */
export function annotateCandidate(c: DiscoveryCandidate): DiscoveryCandidate {
  const annotated = dedupeEvidence(c.evidences);
  return { ...c, evidences: annotated };
}

/**
 * Technology-match dedup (Phase 3): collapse repeated tech overlap
 * signals (language, topics, keywords) into a single line before the
 * scorer sees them.
 */
export function collapseTechEvidence(items: Evidence[]): Evidence[] {
  const tech = items.filter((e) => /Works in |Overlapping topics/i.test(e.text));
  if (tech.length <= 1) return items;
  const others = items.filter((e) => !tech.includes(e));
  const langs = tech.filter((e) => /Works in /.test(e.text)).map((e) => e.text);
  const topics = tech.filter((e) => /Overlapping topics/i.test(e.text)).map((e) => e.text);
  const merged: Evidence = {
    kind: "profile",
    text: [...langs, ...topics].join(" "),
    strength: "weak",
    sourceType: "profile",
    relevanceReason: "Technology overlap only — context, not intent.",
  };
  return [...others, merged];
}

/** Highest signal strength in a Signal[] list. */
export function signalStrength(signals: Signal[]): EvidenceStrength {
  if (!signals.length) return "weak";
  const all = signals.flatMap((s) => s.evidence);
  return all.length ? strongestOf(all) : "weak";
}
