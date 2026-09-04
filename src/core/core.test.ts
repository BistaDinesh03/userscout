import { describe, expect, it } from "vitest";
import { parseRepoInput } from "./github";
import { scoreCandidate } from "./scoring";
import { ProjectService } from "./services";
import type { Collection, StorageAdapter } from "./storage";
import type { DiscoveryCandidate, ProjectProfile } from "./types";

const profile: ProjectProfile = {
  fullName: "owner/tool",
  owner: "owner",
  repo: "tool",
  url: "https://github.com/owner/tool",
  description: "A Python tool for issue discovery",
  homepage: "",
  primaryLanguage: "Python",
  languages: { Python: 100 },
  topics: ["discovery"],
  stars: 10,
  forks: 2,
  openIssues: 1,
  license: "MIT",
  readmeExcerpt: "",
  keywords: ["issue", "discovery"],
  problemSpace: ["issue discovery"],
  audience: ["Python developers"],
  queryTerms: ["issue", "discovery"],
  fetchedAt: Date.now(),
};

const candidate = (overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  login: "person",
  name: "",
  avatarUrl: "",
  htmlUrl: "https://github.com/person",
  bio: "",
  evidences: [],
  sources: [],
  relatedRepos: [],
  matchedTerms: [],
  lastActivityAt: Date.now(),
  askingTitles: [],
  isAsking: false,
  languages: [],
  repoTopics: [],
  ...overrides,
});

describe("parseRepoInput", () => {
  it("accepts GitHub URLs and shorthand", () => {
    expect(parseRepoInput("https://github.com/owner/tool.git").fullName).toBe("owner/tool");
    expect(parseRepoInput("owner/tool").fullName).toBe("owner/tool");
  });

  it("rejects unsafe and malformed repository inputs with domain errors", () => {
    expect(() => parseRepoInput("https://evil.example/owner/tool")).toThrow("Only github.com");
    expect(() => parseRepoInput("owner/%ZZ")).toThrow("invalid encoding");
    expect(() => parseRepoInput("https://github.com:444/owner/tool")).toThrow("credentials or ports");
  });
});

describe("scoreCandidate", () => {
  it("uses issue body evidence for problem intent", () => {
    const result = scoreCandidate(profile, candidate({
      isAsking: true,
      evidences: [{ kind: "issue", text: "Asked for help in a public issue.", url: "https://github.com/example/issues/1" }],
    }));
    expect(result.signals.find((signal) => signal.id === "asking")?.points).toBe(30);
  });

  it("keeps weak-only candidates low confidence and below the ceiling", () => {
    const result = scoreCandidate(profile, candidate({ languages: ["Python"], repoTopics: ["discovery"] }));
    expect(result.score).toBeLessThanOrEqual(43);
    expect(result.confidence).toBe("low");
  });
});

describe("project ownership", () => {
  it("rejects access by another actor", () => {
    const rows = new Map<Collection, unknown[]>();
    const db: StorageAdapter = {
      read: <T>(collection: Collection) => (rows.get(collection) ?? []) as T[],
      write: <T>(collection: Collection, value: T[]) => { rows.set(collection, value); },
      getMeta: () => null,
      setMeta: () => undefined,
    };
    const service = new ProjectService(db);
    const project = service.create("owner-1", profile);
    expect(() => service.get("owner-2", project.id)).toThrow("don't have access");
  });
});