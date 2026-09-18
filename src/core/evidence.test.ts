/* Evidence intelligence tests: classification, dedup, recency, confidence. */

import { describe, expect, it } from "vitest";
import { classifyEvidence, dedupeEvidence, fingerprint, collapseTechEvidence, signalStrength } from "./evidence";
import { recencyLevel } from "./recency";
import { scoreCandidate } from "./scoring";
import type { DiscoveryCandidate, Evidence, ProjectProfile, Signal } from "./types";

const profile: ProjectProfile = {
  fullName: "owner/tool",
  owner: "owner",
  repo: "tool",
  url: "https://github.com/owner/tool",
  description: "A feedback tool for developers",
  homepage: "",
  primaryLanguage: "Python",
  languages: { Python: 100 },
  topics: ["feedback"],
  stars: 10,
  forks: 2,
  openIssues: 1,
  license: "MIT",
  readmeExcerpt: "",
  keywords: ["feedback", "user"],
  problemSpace: ["user feedback"],
  audience: ["python developers"],
  queryTerms: ["feedback", "user"],
  fetchedAt: Date.now(),
};

const candidate = (overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  login: "person", name: "", avatarUrl: "", htmlUrl: "https://github.com/person",
  bio: "", evidences: [], sources: [], relatedRepos: [], matchedTerms: [],
  lastActivityAt: Date.now(), askingTitles: [], isAsking: false,
  languages: [], repoTopics: [], contactChannels: [],
  ...overrides,
});

describe("classifyEvidence", () => {
  it("classifies issue-as-question as very_strong", () => {
    const e: Evidence = { kind: "issue", text: 'Asked "How do I track feedback?" in owner/repo.' };
    expect(classifyEvidence(e)).toBe("very_strong");
  });
  it("classifies issue-discussion as strong", () => {
    const e: Evidence = { kind: "issue", text: 'Discussed "Feedback pipeline" in owner/repo.' };
    expect(classifyEvidence(e)).toBe("strong");
  });
  it("classifies related repo as strong", () => {
    const e: Evidence = { kind: "repo", text: "Maintains owner/feedback-tool." };
    expect(classifyEvidence(e)).toBe("strong");
  });
  it("classifies language overlap as weak", () => {
    const e: Evidence = { kind: "profile", text: "Works in Python, the project's primary language." };
    expect(classifyEvidence(e)).toBe("weak");
  });
  it("classifies audience match as medium", () => {
    const e: Evidence = { kind: "profile", text: 'Profile aligns with target audience: "python developers".' };
    expect(classifyEvidence(e)).toBe("medium");
  });
});

describe("dedupeEvidence", () => {
  it("deduplicates by url", () => {
    const a: Evidence = { kind: "issue", text: "one", url: "https://github.com/x/y/issues/1" };
    const b: Evidence = { kind: "issue", text: "two", url: "https://github.com/x/y/issues/1#comment" };
    const out = dedupeEvidence([a, b]);
    expect(out.length).toBe(1);
    expect(out[0].strength).toBeDefined();
    expect(out[0].fingerprint).toBeDefined();
  });
  it("preserves distinct evidence", () => {
    const a: Evidence = { kind: "issue", text: "one", url: "https://github.com/x/y/issues/1" };
    const b: Evidence = { kind: "issue", text: "two", url: "https://github.com/x/y/issues/2" };
    expect(dedupeEvidence([a, b]).length).toBe(2);
  });
});

describe("collapseTechEvidence", () => {
  it("collapses multiple tech matches into one entry", () => {
    const items: Evidence[] = [
      { kind: "profile", text: "Works in Python, the project's primary language." },
      { kind: "profile", text: "Overlapping topics/keywords: feedback, user." },
      { kind: "issue", text: "Discussed something." },
    ];
    const out = collapseTechEvidence(items);
    const tech = out.filter((e) => /Works in|Overlapping topics/.test(e.text));
    expect(tech.length).toBe(1);
  });
});

describe("recencyLevel", () => {
  const now = Date.now();
  it("marks 5 days as very_recent", () => {
    expect(recencyLevel(now - 5 * 86400000, now)).toBe("very_recent");
  });
  it("marks 20 days as recent", () => {
    expect(recencyLevel(now - 20 * 86400000, now)).toBe("recent");
  });
  it("marks 60 days as aging", () => {
    expect(recencyLevel(now - 60 * 86400000, now)).toBe("aging");
  });
  it("marks 200 days as old", () => {
    expect(recencyLevel(now - 200 * 86400000, now)).toBe("old");
  });
  it("marks missing ts as unknown", () => {
    expect(recencyLevel(null)).toBe("unknown");
    expect(recencyLevel(0)).toBe("unknown");
  });
});

describe("confidence is evidence-driven, not score-driven", () => {
  it("very strong evidence alone yields at least medium confidence", () => {
    const c = candidate({
      isAsking: true,
      evidences: [{ kind: "issue", text: 'Asked "How do I track feedback?" in x/y.', url: "https://github.com/x/y/issues/1" }],
    });
    const r = scoreCandidate(c, profile);
    expect(r.evidenceStrength).toBe("very_strong");
    // honest: 45 points from a single asking signal is meaningful but not "high"
    expect(["medium", "high"]).toContain(r.confidence);
  });

  it("very strong evidence plus related project yields high confidence", () => {
    const c = candidate({
      isAsking: true,
      matchedTerms: ["feedback"],
      evidences: [
        { kind: "issue", text: 'Asked "How do I track feedback?" in x/y.', url: "https://github.com/x/y/issues/1" },
        { kind: "repo", text: "Maintains owner/feedback-tool.", url: "https://github.com/owner/feedback-tool" },
      ],
    });
    const r = scoreCandidate(c, profile);
    expect(r.evidenceStrength).toBe("very_strong");
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.confidence).toBe("high");
  });
  it("weak-only evidence cannot be high confidence even with high score", () => {
    const c = candidate({
      languages: ["Python"],
      repoTopics: ["feedback", "user"],
      matchedTerms: ["feedback", "user"],
    });
    const r = scoreCandidate(c, profile);
    expect(r.evidenceStrength).toBe("weak");
    expect(r.confidence).toBe("low");
  });
});

describe("caution signals", () => {
  it("flags tech-only candidates", () => {
    const c = candidate({ languages: ["Python"], repoTopics: ["feedback"] });
    const r = scoreCandidate(c, profile);
    expect(r.cautionSignals.some((s) => s.type === "tech_only")).toBe(true);
  });
  it("flags old evidence", () => {
    const c = candidate({
      isAsking: true,
      evidences: [{ kind: "issue", text: 'Asked "help?" in x/y.' }],
      lastActivityAt: Date.now() - 200 * 86400000,
    });
    const r = scoreCandidate(c, profile);
    expect(r.cautionSignals.some((s) => s.type === "no_recent_activity" || s.type === "old_evidence")).toBe(true);
  });
});

describe("determinism", () => {
  it("same input produces same output", () => {
    const c = candidate({
      isAsking: true,
      evidences: [{ kind: "issue", text: 'Asked "help?" in x/y.', url: "https://github.com/x/y/issues/1" }],
    });
    const a = scoreCandidate(c, profile);
    const b = scoreCandidate(c, profile);
    expect(a.score).toBe(b.score);
    expect(a.confidence).toBe(b.confidence);
    expect(a.evidenceStrength).toBe(b.evidenceStrength);
    expect(a.whyThisPerson).toBe(b.whyThisPerson);
  });
});
