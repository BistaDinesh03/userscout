/* ── Relevance scoring model ────────────────────────────────────────────
 * Deterministic and explainable. Every prospect gets:
 *   score (0–100, capped) · confidence · signals[] · evidence[] · explanation
 *
 * Signal weights (documented — also shown in the UI and README):
 *   asking       max 30   publicly asked for / discussed the exact problem
 *   maintainer   max 25   maintains a repo whose description/topics match
 *                         the project's query terms (15 base + 5 per
 *                         matched term, up to 2 extra terms)
 *   contributor  max 15   contributes to closely related repos (12, +3 for
 *                         more than one related repo)
 *   tech         max 20   primary language match (+8) and topic/keyword
 *                         overlap (+4 each, max +12)
 *   recency      max 15   relevant public activity within 30d/90d/180d/365d
 *                         ←’ 15 / 10 / 6 / 3
 *   audience     max 8    bio/topics align with the derived target audience
 *
 * Weak signals (tech, recency, audience) can never dominate: without at
 * least one strong signal (asking / maintainer / contributor) the maximum
 * reachable score is 43, which lands in the LOW band. This is deliberate —
 * "uses the same language" is not evidence of need.
 *
 * Confidence: HIGH requires score ≥ 70 AND a strong signal ≥ 20 pts.
 *             MEDIUM requires score ≥ 45 or any strong signal.
 *             Otherwise LOW.
 */

import type { Confidence, DiscoveryCandidate, Evidence, ProjectProfile, Signal, SignalId, ScoredCandidate } from "./types";
import { clamp, timeAgo } from "./utils";

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

export function scoreCandidate(profile: ProjectProfile, c: DiscoveryCandidate): ScoredCandidate {
  const signals: Signal[] = [];
  const terms = profile.queryTerms.map((t) => t.toLowerCase());
  const lang = profile.primaryLanguage.toLowerCase();

  const add = (id: SignalId, points: number, evidence: Evidence[]) => {
    const meta = SIGNAL_DOCS.find((s) => s.id === id)!;
    if (points > 0) signals.push({ id, label: meta.label, points, maxPoints: meta.max, evidence });
  };

  /* asking — strong */
  const issueEvidence = c.evidences.filter((e) => e.kind === "issue");
  if (issueEvidence.length) {
    const pts = c.isAsking ? 30 : 20;
    add("asking", pts, issueEvidence.slice(0, 3));
  }

  /* maintainer — strong */
  const repoEvidence = c.evidences.filter((e) => e.kind === "repo");
  if (repoEvidence.length) {
    const matched = [...new Set(c.matchedTerms.map((t) => t.toLowerCase()))].filter((t) => terms.includes(t));
    const pts = 15 + 5 * Math.min(2, matched.length);
    add("maintainer", pts, repoEvidence.slice(0, 3));
  }

  /* contributor — strong-ish */
  const contribEvidence = c.evidences.filter((e) => e.kind === "contribution");
  if (contribEvidence.length) {
    add("contributor", contribEvidence.length > 1 ? 15 : 12, contribEvidence.slice(0, 3));
  }

  /* tech — weak */
  {
    let pts = 0;
    const ev: Evidence[] = [];
    if (lang && c.languages.some((l) => l.toLowerCase() === lang)) {
      pts += 8;
      ev.push({ kind: "profile", text: `Works in ${profile.primaryLanguage}, the project's primary language.` });
    }
    const overlap = [...new Set([...c.repoTopics, ...c.matchedTerms].map((t) => t.toLowerCase()))].filter((t) =>
      terms.includes(t),
    );
    pts += Math.min(12, overlap.length * 4);
    if (overlap.length) ev.push({ kind: "profile", text: `Overlapping topics/keywords: ${overlap.slice(0, 4).join(", ")}.` });
    add("tech", pts, ev);
  }

  /* recency — weak */
  {
    const age = Date.now() - c.lastActivityAt;
    const pts = age <= 30 * DAY ? 15 : age <= 90 * DAY ? 10 : age <= 180 * DAY ? 6 : age <= 365 * DAY ? 3 : 0;
    add(
      "recency",
      pts,
      pts > 0 ? [{ kind: "profile", text: `Last relevant public activity ${timeAgo(c.lastActivityAt)}.` }] : [],
    );
  }

  /* audience — weak */
  {
    const bio = `${c.bio} ${c.repoTopics.join(" ")}`.toLowerCase();
    const hit = profile.audience.find((a) => a.toLowerCase().split(/\s+/).some((w) => w.length > 4 && bio.includes(w)));
    add(
      "audience",
      hit ? 8 : 0,
      hit ? [{ kind: "profile", text: `Profile aligns with target audience: “${hit}”.` }] : [],
    );
  }

  const raw = signals.reduce((s, x) => s + x.points, 0);
  const score = clamp(raw, 0, 100);
  const strong = signals.some((s) => (s.id === "asking" || s.id === "maintainer" || s.id === "contributor") && s.points >= 12);
  const veryStrong = signals.some((s) => (s.id === "asking" || s.id === "maintainer") && s.points >= 20);
  const confidence: Confidence = score >= 70 && veryStrong ? "high" : score >= 45 || strong ? "medium" : "low";

  return { candidate: c, score, confidence, signals, explanation: buildExplanation(c, signals) };
}

function buildExplanation(c: DiscoveryCandidate, signals: Signal[]): string {
  const strong = signals.filter((s) => ["asking", "maintainer", "contributor"].includes(s.id));
  if (strong.length) {
    return strong[0].evidence[0]?.text ?? "Relevant public activity found.";
  }
  const weak = signals.filter((s) => ["tech", "recency", "audience"].includes(s.id) && s.points > 0);
  if (weak.length) {
    return "Technology and profile overlap found, but no direct problem evidence.";
  }
  return "Only weak signals found.";
}

export const bandOf = (score: number): "high" | "medium" | "low" =>
  score >= 75 ? "high" : score >= 45 ? "medium" : "low";

