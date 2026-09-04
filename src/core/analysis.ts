/* ── Project analysis ───────────────────────────────────────────────────
 * Turns public repository data (description, README excerpt, topics,
 * languages) into a ProjectProfile: keywords, likely problem space,
 * likely audience, and search terms for discovery.
 *
 * Everything here is deterministic and documented: no hidden models,
 * no invented claims. Outputs are labeled "likely" because they are
 * heuristics, not facts.
 */

import type { AnalysisProgress, ProjectProfile } from "./types";
import { GitHubApiError, parseRepoInput, type GitHubClient, type RawRepo, type RepoRef } from "./github";
import { sleep } from "./utils";

const STOPWORDS = new Set(
  (
    "the a an and or of to in for on with by from as is are be been this that it its your you my our their their can will just more most very also into over under out up down about than then so such no not only own same too will would could should may might via per using use used uses new simple small large fast easy based like get make made build building built project tool library app api for the"
  ).split(/\s+/),
);

const AUDIENCE_HINTS: Array<{ match: RegExp; label: string }> = [
  { match: /\b(cli|terminal|console|shell)\b/i, label: "developers who live in the terminal" },
  { match: /\b(test|testing|tdd|e2e|coverage)\b/i, label: "teams investing in automated testing" },
  { match: /\b(ci|cd|pipeline|deploy|deployment)\b/i, label: "engineers owning CI/CD pipelines" },
  { match: /\b(api|rest|graphql|grpc|webhook)\b/i, label: "developers integrating services via APIs" },
  { match: /\b(data|etl|pipeline|csv|sql|database)\b/i, label: "people wrangling data pipelines" },
  { match: /\b(ml|ai|llm|model|embedding|agent)\b/i, label: "builders shipping ML/LLM features" },
  { match: /\b(secur|auth|password|encrypt)\b/i, label: "developers responsible for auth & security" },
  { match: /\b(perf|performance|profil|benchmark|latency)\b/i, label: "engineers chasing performance" },
  { match: /\b(doc(s|umentation)?|readme|markdown)\b/i, label: "maintainers who care about docs" },
  { match: /\b(monitor|observ|log|metric|trace)\b/i, label: "teams running production observability" },
  { match: /\b(game|gamedev|engine|sprite)\b/i, label: "game developers" },
  { match: /\b(web|frontend|react|vue|css|ui)\b/i, label: "frontend engineers" },
  { match: /\b(cron|schedul|job|queue|worker)\b/i, label: "developers orchestrating jobs & queues" },
];

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s\-_]+/)
    .map((w) => w.replace(/^[.#]+|[.#]+$/g, ""))
    .filter((w) => w.length >= 3 && w.length <= 24 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function freq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function deriveKeywords(repo: RawRepo, readme: string): string[] {
  const f = freq([
    ...tokenize(repo.description ?? ""),
    ...tokenize((repo.topics ?? []).join(" ")).map((t) => t),
    ...(repo.topics ?? []).map((t) => t.toLowerCase()),
  ]);
  // topics are explicit maintainer intent → boost
  for (const t of repo.topics ?? []) {
    const k = t.toLowerCase();
    f.set(k, (f.get(k) ?? 0) + 3);
  }
  const rf = freq(tokenize(readme.slice(0, 3000)));
  for (const [k, v] of rf) if (v >= 3) f.set(k, (f.get(k) ?? 0) + 1);

  return [...f.entries()]
    .filter(([k]) => k !== repo.name.toLowerCase())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([k]) => k);
}

function deriveAudience(repo: RawRepo, keywords: string[]): string[] {
  const hay = `${repo.description ?? ""} ${(repo.topics ?? []).join(" ")} ${repo.language ?? ""} ${keywords.join(" ")}`;
  const hits = AUDIENCE_HINTS.filter((h) => h.match.test(hay)).map((h) => h.label);
  const out = [...new Set(hits)].slice(0, 4);
  if (repo.language) out.unshift(`${repo.language.toLowerCase()} developers`);
  return [...new Set(out)].slice(0, 5);
}

function deriveProblemSpace(repo: RawRepo, keywords: string[]): string[] {
  const out: string[] = [];
  const top = keywords.slice(0, 3);
  if (repo.description) out.push(`Solves: ${repo.description}`);
  if (top.length) out.push(`Problem space centers on: ${top.join(", ")}.`);
  if (repo.language) out.push(`Delivered as ${repo.language} tooling, so friction is lowest for ${repo.language.toLowerCase()} users.`);
  return out.slice(0, 3);
}

function deriveQueryTerms(keywords: string[], topics: string[]): string[] {
  // quoted terms used for GitHub code/issue/repo search — deterministic order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...topics.map((t) => t.toLowerCase()), ...keywords]) {
    if (t.length < 3 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 5) break;
  }
  return out;
}

export async function analyzeRepository(
  client: GitHubClient,
  input: string,
  onProgress?: (p: AnalysisProgress) => void,
): Promise<ProjectProfile> {
  onProgress?.({ phase: "validate", message: "Validating repository URL", done: false });
  const ref: RepoRef = parseRepoInput(input); // throws GitHubApiError on bad input
  await sleep(150);
  onProgress?.({ phase: "validate", message: `OK → github.com/${ref.fullName}`, done: true });

  onProgress?.({ phase: "repo", message: `Fetching public metadata for ${ref.fullName}`, done: false });
  const repo = await client.getRepo(ref);
  onProgress?.({ phase: "repo", message: `★ ${repo.stargazers_count} · ${repo.forks_count} forks · ${repo.open_issues_count} open issues`, done: true });

  onProgress?.({ phase: "readme", message: "Reading README (public, truncated)", done: false });
  const readme = await client.getReadme(ref);
  onProgress?.({ phase: "readme", message: readme ? `README parsed (${readme.length.toLocaleString()} chars)` : "No README found — using metadata only", done: true });

  onProgress?.({ phase: "derive", message: "Deriving keywords, audience & query terms", done: false });
  const keywords = deriveKeywords(repo, readme);
  const profile: ProjectProfile = {
    fullName: repo.full_name,
    owner: repo.owner.login,
    repo: repo.name,
    url: repo.html_url,
    description: repo.description ?? "",
    homepage: repo.homepage ?? "",
    primaryLanguage: repo.language ?? "",
    languages: repo.language ? { [repo.language]: 1 } : {},
    topics: (repo.topics ?? []).slice(0, 12),
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    license: repo.license?.spdx_id ?? "",
    readmeExcerpt: readme.slice(0, 480),
    keywords,
    problemSpace: deriveProblemSpace(repo, keywords),
    audience: deriveAudience(repo, keywords),
    queryTerms: deriveQueryTerms(keywords, repo.topics ?? []),
    fetchedAt: Date.now(),
  };
  if (!profile.queryTerms.length) {
    throw new GitHubApiError(
      422,
      "Could not derive any keywords from this repo. Add a description or topics to the repository, then try again.",
    );
  }
  await sleep(200);
  onProgress?.({ phase: "derive", message: `Signal vocabulary ready: ${profile.queryTerms.slice(0, 4).join(", ")}`, done: true });
  return profile;
}
