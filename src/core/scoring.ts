/* Relevance scoring model — deterministic, explainable.
 *
 * Produces:
 *   score              0–100 (compat)
 *   confidence         low | medium | high      (evidence-driven, not score-driven)
 *   evidenceStrength   very_strong | strong | medium | weak
 *   recencyLevel       very_recent | recent | aging | old | unknown
 *   signals[]          explainable signal breakdown
 *   cautionSignals[]   honest reasons you might not contact
 *   whyThisPerson      one-line human summary
 *   whyNow             one-line honest recency summary
 *
 * Weak signals (tech, recency, audience) can never dominate: without at
 * least one strong signal (asking / maintainer / contributor) the maximum
 * reachable score is 43 (LOW band). "Uses Python" is context, not intent.
 */

import type {
  CautionSignal,
  Confidence,
  DiscoveryCandidate,
  Evidence,
  EvidenceStrength,
  ProjectProfile,
  Signal,
  SignalId,
  ScoredCandidate,
} from "./types";
import { clamp, timeAgo } from "./utils";
import {
  annotateCandidate,
  collapseTechEvidence,
  classifyEvidence,
  strongestOf,
} from "./evidence";
import { recencyLevel, type RecencyLevel } from "./recency";

export const QUESTION_PATTERN =
  /\b(how (?:can|do|to)|need help|help with|alternative(?:s)? to|recommend(?:ations?)?|looking for|best (?:way|tool|library)|is there (?:a|any)|anyone (?:knows|used|tried|have)|struggling with|issue with|problem with|replac(?:e|ement) for|what do you use)\b/i;

export const SIGNAL_DOCS: { id: SignalId; label: string; max: number; rule: string }[] = [
  { id: "asking", label: "Problem evidence", max: 30, rule: "Publicly asked for or discussed this exact problem (issue title/body). Question-shaped: 30 · discussion: 20." },
  { id: "maintainer", label: "Related project", max: 25, rule: "Maintains a repo matching the project's query terms. 15 base + 5 per matched term (max +10)." },
  { id: "contributor", label: "Contributes to related repos", max: 15, rule: "Recent commits in closely related repos. 12 base, +3 for 2+ related repos." },
  { id: "tech", label: "Technology match", max: 20, rule: "Primary language match +8; topic/keyword overlap +4 each (max +12). Weak on its own." },
  { id: "recency", label: "Recent relevant activity", max: 15, rule: "Related public activity ≤30d: 15 · ≤90d: 10 · ≤180d: 6 · ≤1y: 3." },
  { id: "audience", label: "Audience alignment", max: 8, rule: "Bio or repo topics align with the derived target audience. Weak on its own." },
];

const DAY = 86_400_000;

export function scoreCandidate(
  rawCandidate: DiscoveryCandidate,
  profile: ProjectProfile,
): ScoredCandidate {
  // Annotate evidence first: classify + dedupe.
  const annotated = annotateCandidate(rawCandidate);
  const collapsed = { ...annotated, evidences: collapseTechEvidence(annotated.evidences) };

  const signals: Signal[] = [];
  const terms = profile.queryTerms.map((t) => t.toLowerCase());
  const lang = profile.primaryLanguage.toLowerCase();

  const add = (id: SignalId, points: number, evidence: Evidence[]) => {
    const meta = SIGNAL_DOCS.find((s) => s.id === id)!;
    if (points > 0) signals.push({ id, label: meta.label, points, maxPoints: meta.max, evidence });
  };

  /* asking — strong */
  const issueEvidence = collapsed.evidences.filter((e) => e.kind === "issue");
  if (issueEvidence.length) {
    const pts = collapsed.isAsking ? 30 : 20;
    add("asking", pts, issueEvidence.slice(0, 3));
  }

  /* maintainer — strong */
  const repoEvidence = collapsed.evidences.filter((e) => e.kind === "repo");
  if (repoEvidence.length) {
    const matched = [...new Set(collapsed.matchedTerms.map((t) => t.toLowerCase()))].filter((t) => terms.includes(t));
    const pts = 15 + 5 * Math.min(2, matched.length);
    add("maintainer", pts, repoEvidence.slice(0, 3));
  }

  /* contributor — strong-ish */
  const contribEvidence = collapsed.evidences.filter((e) => e.kind === "contribution");
  if (contribEvidence.length) {
    add("contributor", contribEvidence.length > 1 ? 15 : 12, contribEvidence.slice(0, 3));
  }

  /* tech — weak (already collapsed) */
  {
    let pts = 0;
    const ev: Evidence[] = [];
    if (lang && collapsed.languages.some((l) => l.toLowerCase() === lang)) {
      pts += 8;
      ev.push({ kind: "profile", text: `Works in ${profile.primaryLanguage}, the project's primary language.`, strength: "weak" });
    }
    const overlap = [...new Set([...collapsed.repoTopics, ...collapsed.matchedTerms].map((t) => t.toLowerCase()))].filter(
      (t) => terms.includes(t),
    );
    pts += Math.min(12, overlap.length * 4);
    if (overlap.length) {
      ev.push({
        kind: "profile",
        text: `Overlapping topics/keywords: ${overlap.slice(0, 4).join(", ")}.`,
        strength: "weak",
      });
    }
    // Cap tech at 20 (documented) — no additional category cap needed since it already has one.
    add("tech", Math.min(20, pts), ev);
  }

  /* recency — weak */
  let recLevel: RecencyLevel = "unknown";
  {
    const age = Date.now() - collapsed.lastActivityAt;
    recLevel = recencyLevel(collapsed.lastActivityAt);
    const pts = age <= 30 * DAY ? 15 : age <= 90 * DAY ? 10 : age <= 180 * DAY ? 6 : age <= 365 * DAY ? 3 : 0;
    add(
      "recency",
      pts,
      pts > 0 ? [{ kind: "profile", text: `Last relevant public activity ${timeAgo(collapsed.lastActivityAt)}.`, strength: "weak" }] : [],
    );
  }

  /* audience — weak */
  {
    const bio = `${collapsed.bio} ${collapsed.repoTopics.join(" ")}`.toLowerCase();
    const hit = profile.audience.find((a) => a.toLowerCase().split(/\s+/).some((w) => w.length > 4 && bio.includes(w)));
    add(
      "audience",
      hit ? 8 : 0,
      hit ? [{ kind: "profile", text: `Profile aligns with target audience: "${hit}".`, strength: "medium" }] : [],
    );
  }

  const raw = signals.reduce((s, x) => s + x.points, 0);
  const score = clamp(raw, 0, 100);

  const allEvidence = signals.flatMap((s) => s.evidence);
  const evidenceStrength: EvidenceStrength = allEvidence.length ? strongestOf(allEvidence) : "weak";

  /* Confidence is evidence-driven, not score-driven (Phase 8). */
  const hasVeryStrong = evidenceStrength === "very_strong";
  const hasStrong = evidenceStrength === "strong" || hasVeryStrong;
  let confidence: Confidence;
  if (hasVeryStrong && score >= 60) confidence = "high";
  else if (hasStrong && score >= 40) confidence = "medium";
  else if (evidenceStrength === "medium" && score >= 55) confidence = "medium";
  else confidence = "low";

  const cautionSignals = buildCautionSignals(collapsed, signals, evidenceStrength, recLevel);
  const whyThisPerson = buildWhyThisPerson(signals, evidenceStrength);
  const whyNow = buildWhyNow(collapsed, recLevel);

  return {
    candidate: collapsed,
    score,
    confidence,
    signals,
    explanation: whyThisPerson,
    evidenceStrength,
    recencyLevel: recLevel,
    cautionSignals,
    whyThisPerson,
    whyNow,
  };
}

function buildWhyThisPerson(signals: Signal[], strength: EvidenceStrength): string {
  const strong = signals.filter((s) => ["asking", "maintainer", "contributor"].includes(s.id));
  if (strong.length) return strong[0].evidence[0]?.text ?? "Public evidence found.";
  if (strength === "medium") return "Some relevance signals exist, but no direct problem discussion.";
  return "Only weak technology or profile overlap found.";
}

function buildWhyNow(c: DiscoveryCandidate, level: RecencyLevel): string {
  if (level === "unknown") return "No dated public activity found.";
  const ago = timeAgo(c.lastActivityAt);
  switch (level) {
    case "very_recent": return `Relevant public activity observed ${ago}.`;
    case "recent": return `Relevant public activity observed ${ago}.`;
    case "aging": return `Most recent relevant activity is ${ago}.`;
    case "old": return `Relevant activity is stale (last seen ${ago}).`;
  }
}

function buildCautionSignals(
  c: DiscoveryCandidate,
  signals: Signal[],
  strength: EvidenceStrength,
  rec: RecencyLevel,
): CautionSignal[] {
  const out: CautionSignal[] = [];
  const hasStrong = signals.some((s) => ["asking", "maintainer", "contributor"].includes(s.id));
  if (!hasStrong) {
    out.push({ type: "tech_only", message: "Only technology or profile overlap found — no direct problem evidence." });
  }
  if (strength === "weak") {
    out.push({ type: "weak_evidence", message: "Underlying evidence is weak." });
  }
  if (rec === "old" || rec === "unknown") {
    out.push({ type: "no_recent_activity", message: "No recent relevant public activity." });
  } else if (rec === "aging") {
    out.push({ type: "old_evidence", message: "Most relevant activity is over 3 months old." });
  }
  // Detect duplicate-ish evidence: same kind counted many times
  const issueCount = c.evidences.filter((e) => e.kind === "issue").length;
  if (issueCount > 3) {
    out.push({ type: "duplicate_evidence", message: "Multiple overlapping issue references — treat as one signal." });
  }
  return out;
}

export const bandOf = (score: number): "high" | "medium" | "low" =>
  score >= 75 ? "high" : score >= 45 ? "medium" : "low";

/* Re-export classification for tests / UI. */
export { classifyEvidence };
