/* ── GitHub integration ─────────────────────────────────────────────────
 * Only the official GitHub REST API is used, over HTTPS, against a fixed
 * host (api.github.com). Repository owner/name are extracted with a strict
 * allow-list regex before being interpolated into paths, so arbitrary URLs
 * can never redirect requests elsewhere (SSRF-safe by construction).
 * Tokens (optional) come from environment variables and are never logged.
 */

import type { RateInfo } from "./types";

export class GitHubApiError extends Error {
  status: number;
  rateLimited: boolean;
  resetAt: number | null;
  constructor(status: number, message: string, rateLimited = false, resetAt: number | null = null) {
    super(message);
    this.status = status;
    this.rateLimited = rateLimited;
    this.resetAt = resetAt;
  }
}

const NAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|\.(?!\.))*$|^[\w][\w.-]{0,38}$/;
const PATH_RE = /^\/([^/]+)\/([^/]+?)\/?$/;

export interface RepoRef {
  owner: string;
  repo: string;
  fullName: string;
}

/** Validate a GitHub repository URL or `owner/repo` shorthand. Throws with a
 *  human-readable reason on anything that is not a plain public repo URL. */
export function parseRepoInput(raw: string): RepoRef {
  const input = raw.trim();
  if (!input) throw new GitHubApiError(0, "Paste a GitHub repository URL or owner/repo.");
  let owner = "";
  let repo = "";

  if (/^https?:\/\//i.test(input)) {
    let u: URL;
    try {
      u = new URL(input);
    } catch {
      throw new GitHubApiError(0, "That is not a valid URL.");
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "github.com") {
      throw new GitHubApiError(0, "Only github.com repository URLs are accepted.");
    }
    if (u.username || u.password || u.port) {
      throw new GitHubApiError(0, "URLs with credentials or ports are not accepted.");
    }
    const m = PATH_RE.exec(u.pathname);
    if (!m) throw new GitHubApiError(0, "Expected github.com/<owner>/<repo>.");
    owner = m[1];
    repo = m[2];
  } else {
    const parts = input.split("/");
    if (parts.length !== 2) {
      throw new GitHubApiError(0, "Use a full URL or the owner/repo shorthand.");
    }
    owner = parts[0];
    repo = parts[1];
  }

  try {
    owner = decodeURIComponent(owner);
    repo = decodeURIComponent(repo).replace(/\.git$/i, "");
  } catch {
    throw new GitHubApiError(0, "That repository URL contains invalid encoding.");
  }

  if (!NAME_RE.test(owner) || !NAME_RE.test(repo)) {
    throw new GitHubApiError(0, "Owner and repo may only contain letters, digits, '-', '_' or '.'.");
  }
  if (owner === "." || owner === ".." || repo === "." || repo === "..") {
    throw new GitHubApiError(0, "Invalid repository name.");
  }
  return { owner, repo, fullName: `${owner}/${repo}` };
}

const BASE = "https://api.github.com";
const TIMEOUT_MS = 9000;

export interface GitHubClient {
  getRepo(ref: RepoRef): Promise<RawRepo>;
  getReadme(ref: RepoRef): Promise<string>;
  searchIssues(query: string, perPage: number): Promise<RawIssue[]>;
  searchRepos(query: string, perPage: number): Promise<RawRepo[]>;
  getContributors(ref: RepoRef, perPage: number): Promise<RawContributor[]>;
  getUser(login: string): Promise<RawUser>;
}

/* Loose shapes for the parts of the GitHub API we consume. */
export interface RawRepo {
  full_name: string;
  name: string;
  owner: { login: string; avatar_url?: string; type?: string };
  html_url: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id: string | null } | null;
  pushed_at: string;
}
export interface RawIssue {
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  state: string;
  user: { login: string } | null;
  repository_url: string; // https://api.github.com/repos/owner/repo
  pull_request?: unknown;
}
export interface RawContributor {
  login: string;
  contributions: number;
  type: string;
}
export interface RawUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  type: string;
}

export function createGitHubClient(onRate?: (r: RateInfo) => void): GitHubClient {
  const rate: RateInfo = { coreRemaining: null, coreReset: null, searchRemaining: null, searchReset: null };

  async function request<T>(path: string, accept = "application/vnd.github+json"): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = {
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { signal: ctrl.signal, headers });
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new GitHubApiError(0, "GitHub request timed out. Try again.");
      }
      throw new GitHubApiError(0, "Network error while reaching the GitHub API.");
    } finally {
      clearTimeout(timer);
    }

    const isSearch = path.startsWith("/search");
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (!Number.isNaN(remaining) && !Number.isNaN(reset)) {
      if (isSearch) {
        rate.searchRemaining = remaining;
        rate.searchReset = reset * 1000;
      } else {
        rate.coreRemaining = remaining;
        rate.coreReset = reset * 1000;
      }
      onRate?.({ ...rate });
    }

    if (res.status === 404) throw new GitHubApiError(404, "Repository not found. Check the URL — the repo must be public.");
    if (res.status === 403 || res.status === 429) {
      if (remaining === 0) {
        throw new GitHubApiError(res.status, rateLimitMessage(isSearch, reset * 1000), true, reset * 1000);
      }
      throw new GitHubApiError(res.status, "GitHub refused the request (403). It may be rate limiting or the resource is restricted.");
    }
    if (res.status === 422) throw new GitHubApiError(422, "GitHub rejected that search query. Try simpler keywords.");
    if (!res.ok) throw new GitHubApiError(res.status, `GitHub API error (HTTP ${res.status}).`);

    try {
      return (await res.json()) as T;
    } catch {
      throw new GitHubApiError(res.status, "GitHub returned an unexpected response shape.");
    }
  }

  const text = async (ref: RepoRef): Promise<string> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = { Accept: "application/vnd.github.raw" };
    try {
      const res = await fetch(`${BASE}/repos/${ref.owner}/${ref.repo}/readme`, { signal: ctrl.signal, headers });
      if (!res.ok) return "";
      const t = await res.text();
      return t.slice(0, 6000);
    } catch {
      return "";
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    getRepo: (ref) => request<RawRepo>(`/repos/${ref.owner}/${ref.repo}`),
    getReadme: text,
    searchIssues: (q, n) =>
      request<{ items: RawIssue[] }>(`/search/issues?q=${encodeURIComponent(q)}&per_page=${n}&sort=updated&order=desc`).then(
        (r) => r.items ?? [],
      ),
    searchRepos: (q, n) =>
      request<{ items: RawRepo[] }>(`/search/repositories?q=${encodeURIComponent(q)}&per_page=${n}&sort=updated&order=desc`).then(
        (r) => r.items ?? [],
      ),
    getContributors: (ref, n) => request<RawContributor[]>(`/repos/${ref.owner}/${ref.repo}/contributors?per_page=${n}&anon=false`),
    getUser: (login) => request<RawUser>(`/users/${encodeURIComponent(login)}`),
  };
}

function rateLimitMessage(isSearch: boolean, resetMs: number): string {
  const when = resetMs ? `resets ${new Date(resetMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "try again shortly";
  return isSearch
    ? `GitHub search rate limit reached (10/min unauthenticated) — ${when}.`
    : `GitHub API rate limit reached (60/h unauthenticated) — ${when}. Add VITE_GITHUB_TOKEN for higher limits.`;
}
