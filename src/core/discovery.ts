/* ── Discovery engine ───────────────────────────────────────────────────
 * Finds candidate people from *public* GitHub activity only, attaching
 * concrete evidence to every candidate. Sources, in strength order:
 *
 *   1. issues   — people publicly asking about / discussing the problem
 *   2. repos    — maintainers of repos whose name/description/topics match
 *                 the project's query terms
 *   3. contribs — contributors to the closest related repos
 *   4. profiles — public profile enrichment for the top candidates
 *
 * The engine never emails, messages, or contacts anyone. It returns a
 * ranked, explained list; a human decides everything after that.
 */

import type { DiscoveryCandidate, DiscoveryProgress, DiscoveryStep, ProjectProfile, ScoredCandidate } from "./types";
import { GitHubApiError, type GitHubClient, type RepoRef } from "./github";
import { QUESTION_PATTERN, scoreCandidate } from "./scoring";
import { sleep } from "./utils";

const BOT_RE = /\[bot\]$|^(?:dependabot|renovate|github-actions|greenkeeper|snyk-bot|codecov)$/i;

export function buildSearchPlan(profile: ProjectProfile): DiscoveryStep[] {
  const terms = profile.queryTerms;
  const t0 = terms[0] ?? profile.repo;
  const steps: DiscoveryStep[] = [
    {
      id: "issues",
      label: "Public problem evidence",
      kind: "issues",
      detail: `Search open issues mentioning “${terms.slice(0, 2).join("”, “")}” — people actively discussing this problem.`,
    },
    {
      id: "repos",
      label: "Related project maintainers",
      kind: "repos",
      detail: `Search recently updated repos matching “${t0}” by name, description or README.`,
    },
  ];
  if (profile.topics.length) {
    steps.push({
      id: "topic-repos",
      label: "Topic neighbours",
      kind: "repos",
      detail: `Search repos tagged “${profile.topics[0]}” — the project's own topic vocabulary.`,
    });
  }
  steps.push({
    id: "contributors",
    label: "Contributors to closest repos",
    kind: "contributors",
    detail: "Pull recent contributors from the 2 most-starred related repos found above.",
  });
  steps.push({
    id: "profiles",
    label: "Profile enrichment",
    kind: "profiles",
    detail: "Fetch public profiles (name, avatar, bio) for the top candidates only.",
  });
  return steps;
}

interface RunOptions {
  onProgress: (p: DiscoveryProgress) => void;
  onPartial: (scored: ScoredCandidate[]) => void;
}

export async function runDiscovery(
  client: GitHubClient,
  profile: ProjectProfile,
  { onProgress, onPartial }: RunOptions,
): Promise<ScoredCandidate[]> {
  const map = new Map<string, DiscoveryCandidate>();
  const terms = profile.queryTerms;

  const get = (login: string): DiscoveryCandidate => {
    let c = map.get(login);
    if (!c) {
      c = {
        login,
        name: "",
        avatarUrl: `https://github.com/${login}.png`,
        htmlUrl: `https://github.com/${login}`,
        bio: "",
        evidences: [],
        sources: [],
        relatedRepos: [],
        matchedTerms: [],
        lastActivityAt: 0,
        askingTitles: [],
        isAsking: false,
        languages: [],
        repoTopics: [],
      };
      map.set(login, c);
    }
    return c;
  };

  const excluded = (login: string) => !login || BOT_RE.test(login) || login.toLowerCase() === profile.owner.toLowerCase();

  /* ── 1 · issues: strongest intent signal ── */
  onProgress({ stepId: "issues", status: "run", message: `Searching open issues for “${terms.slice(0, 2).join("” OR “")}”…` });
  try {
    const q = `${terms.slice(0, 2).map((t) => `"${t}"`).join(" OR ")} type:issue is:open`;
    const items = await client.searchIssues(q, 20);
    let kept = 0;
    for (const it of items) {
      const login = it.user?.login;
      if (!login || excluded(login) || it.pull_request) continue;
      const repoFull = it.repository_url.replace(/^https:\/\/api\.github\.com\/repos\//, "");
      const c = get(login);
      const issueText = `${it.title}\n${it.body ?? ""}`;
      const asking = QUESTION_PATTERN.test(issueText);
      const created = new Date(it.created_at).getTime();
      c.evidences.push({
        kind: "issue",
        text: asking
          ? `Asked “${it.title}” in ${repoFull} (${timeish(created)}).`
          : `Discussed “${it.title}” in ${repoFull} (${timeish(created)}).`,
        url: it.html_url,
        at: created,
      });
      if (asking) {
        c.isAsking = true;
        c.askingTitles.push(it.title);
      }
      c.sources.push("public-issues");
      c.lastActivityAt = Math.max(c.lastActivityAt, created);
      kept++;
    }
    onProgress({ stepId: "issues", status: "ok", message: `${kept} people discussing the problem in public issues`, count: kept });
  } catch (e) {
    onProgress({ stepId: "issues", status: "err", message: errMsg(e) });
    if (e instanceof GitHubApiError && e.rateLimited) throw e;
  }
  await sleep(700);

  /* ── 2 · repos: maintainers of related projects ── */
  const repoQueries: Array<{ id: string; q: string; label: string }> = [
    { id: "repos", q: `${terms[0] ?? profile.repo} in:name,description,readme`, label: `repos matching “${terms[0] ?? profile.repo}”` },
  ];
  if (profile.topics[0]) repoQueries.push({ id: "topic-repos", q: `topic:${profile.topics[0]}`, label: `repos tagged “${profile.topics[0]}”` });

  const relatedPool: Array<{ ref: RepoRef; stars: number }> = [];

  for (const rq of repoQueries) {
    onProgress({ stepId: rq.id, status: "run", message: `Searching ${rq.label}…` });
    try {
      const items = await client.searchRepos(rq.q, 15);
      let kept = 0;
      for (const r of items) {
        const login = r.owner.login;
        if (excluded(login) || r.full_name.toLowerCase() === profile.fullName.toLowerCase()) continue;
        const matched = matchedTerms(r, terms);
        if (rq.id === "repos" && matched.length === 0) continue; // relevance gate: description must actually match
        const c = get(login);
        c.evidences.push({
          kind: "repo",
          text: `Maintains ${r.full_name}${r.description ? ` — “${truncate(r.description, 90)}”` : ""} (${r.stargazers_count}★).`,
          url: r.html_url,
          at: new Date(r.pushed_at).getTime(),
        });
        c.relatedRepos.push(r.full_name);
        c.matchedTerms.push(...matched, ...(r.topics ?? []).filter((t) => terms.includes(t.toLowerCase())));
        if (r.language) c.languages.push(r.language);
        c.repoTopics.push(...(r.topics ?? []).map((t) => t.toLowerCase()));
        c.sources.push(rq.id);
        c.lastActivityAt = Math.max(c.lastActivityAt, new Date(r.pushed_at).getTime());
        relatedPool.push({ ref: { owner: r.owner.login, repo: r.name, fullName: r.full_name }, stars: r.stargazers_count });
        kept++;
      }
      onProgress({ stepId: rq.id, status: "ok", message: `${kept} maintainers of related repos`, count: kept });
    } catch (e) {
      onProgress({ stepId: rq.id, status: "err", message: errMsg(e) });
      if (e instanceof GitHubApiError && e.rateLimited) throw e;
    }
    await sleep(700);
  }

  /* ── 3 · contributors to the closest related repos ── */
  onProgress({ stepId: "contributors", status: "run", message: "Fetching contributors of the 2 closest related repos…" });
  try {
    const top = [...relatedPool]
      .filter((r, i) => relatedPool.findIndex((x) => x.ref.fullName === r.ref.fullName) === i)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 2);
    let kept = 0;
    for (const { ref } of top) {
      const contribs = await client.getContributors(ref, 10);
      for (const ct of contribs) {
        if (excluded(ct.login) || ct.type !== "User") continue;
        const c = get(ct.login);
        c.evidences.push({ kind: "contribution", text: `Contributes to ${ref.fullName} (${ct.contributions} commits).`, url: `https://github.com/${ref.fullName}` });
        c.sources.push("contributors");
        kept++;
      }
      await sleep(500);
    }
    onProgress({ stepId: "contributors", status: kept ? "ok" : "warn", message: kept ? `${kept} contributor signals collected` : "No contributor data available", count: kept });
  } catch (e) {
    onProgress({ stepId: "contributors", status: "err", message: errMsg(e) });
    if (e instanceof GitHubApiError && e.rateLimited) throw e;
  }

  /* ── rank, then enrich only the top candidates ── */
  const ranked = [...map.values()]
    .map((c) => scoreCandidate(profile, c))
    .sort((a, b) => b.score - a.score || a.candidate.login.localeCompare(b.candidate.login))
    .slice(0, 12);

  onProgress({ stepId: "profiles", status: "run", message: `Enriching public profiles of top ${ranked.length} candidates…` });
  let enriched = 0;
  for (const s of ranked) {
    try {
      const u = await client.getUser(s.candidate.login);
      s.candidate.name = u.name ?? "";
      s.candidate.bio = u.bio ?? "";
      s.candidate.avatarUrl = u.avatar_url || s.candidate.avatarUrl;
      enriched++;
    } catch {
      /* profile fetch is best-effort; candidate stays valid without it */
    }
    await sleep(250);
  }
  onProgress({ stepId: "profiles", status: "ok", message: `${enriched}/${ranked.length} profiles enriched`, count: enriched });

  const final = ranked.map((s) => scoreCandidate(profile, s.candidate)).sort((a, b) => b.score - a.score);
  onPartial(final);
  return final;
}

function matchedTerms(r: { name: string; description: string | null; topics?: string[] }, terms: string[]): string[] {
  const hay = `${r.name} ${r.description ?? ""}`.toLowerCase();
  return terms.filter((t) => hay.includes(t.toLowerCase()));
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function timeish(ts: number): string {
  const d = Math.max(1, Math.round((Date.now() - ts) / 86_400_000));
  return d < 30 ? `${d}d ago` : d < 365 ? `${Math.round(d / 30)}mo ago` : `${Math.round(d / 365)}y ago`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error.";
}
