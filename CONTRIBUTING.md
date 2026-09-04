# Contributing to UserScout

Thanks for wanting to help. UserScout has one non-negotiable: **it must never become a spam
tool.** Contributions that add automated/bulk outreach, scrape private data, or weaken the
ownership guards will be closed.

## Setup

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

## Where things live

- `src/core/*` — pure business logic. **Start here.** No React, no DOM.
- `src/state/store.tsx` — reactive glue between services and UI.
- `src/components/*` — presentation only; no fetches, no writes to storage.

## Good first contributions

1. **Unit tests for the scoring model.** `scoreCandidate` is pure and deterministic: build
   evidence fixtures, assert exact scores/confidence. Suggested runner: `vitest`.
2. **Unit tests for `parseRepoInput`** — the SSRF/URL-validation allow-list (weird URLs,
   ports, `..`, non-GitHub hosts, `owner/repo.git`, unicode).
3. **New discovery sources** — implement the `DiscoveryStep` pattern in
   `src/core/discovery.ts` (e.g. GitHub Discussions). Every source must produce *evidence
   objects with URLs*, never bare usernames.
4. **New signals** — add to `SIGNAL_DOCS` + `scoreCandidate`, keep weights documented in
   README, and preserve the invariant: *weak-only scores ≤ 43*.

## Conventions

- TypeScript strict; no `any` escapes without a comment.
- GitHub requests in this static build are unauthenticated; authenticated use belongs behind a server-side proxy.
- Errors: throw `AppError` (domain) or `GitHubApiError` (external); UI maps them to states.
- No new dependencies without justification in the PR description.
- No `console.log` in committed code; no secrets, ever (pre-commit grep for `ghp_`).
- Components stay accessible: labels, roles, visible focus, keyboard paths.

## PR checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] New logic in `core/` has tests (or a clear follow-up issue)
- [ ] No personal data fields added beyond public GitHub data
- [ ] Docs updated if scoring weights or env vars changed

## Security issues

Do not open public issues for security problems. Report them privately to a maintainer with
reproduction steps. Scope of interest: ownership bypasses, token leakage, SSRF regressions,
XSS via rendered evidence.
