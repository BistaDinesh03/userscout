# UserScout

> **Find people who actually need what you built.**

UserScout is an open-source user-discovery platform for developers who build open-source
projects but struggle to find real users and meaningful feedback. Point it at a public
GitHub repository and it will:

1. **Analyze** the project via the official GitHub API (metadata, topics, README, languages).
2. **Derive** the likely problem space, target audience, and search vocabulary — deterministically.
3. **Discover** people with *public evidence* of needing the project (open issues asking about the
   problem, related repos they maintain, related projects they contribute to).
4. **Score** each prospect 0–100 with a transparent, deterministic, testable model.
5. **Explain** every score: signal breakdown + links to the exact public activity behind it.
6. Track the human part: **save → personally contact → reply → trial → feedback → user**,
   with private notes, a manual outreach workspace, and a conversion funnel computed from
   your own records only.

**Philosophy: QUALITY > QUANTITY.** UserScout refuses to be a spam platform. See [Hard limits](#hard-limits-what-userscout-will-not-do).

---

## Quick start

```bash
npm install
cp .env.example .env        # optional: add VITE_GITHUB_TOKEN for higher rate limits
npm run dev                 # http://localhost:5173
npm run build               # production build → dist/
npm run typecheck           # strict TypeScript check
```

Create a workspace account (stored locally, PBKDF2-hashed), add your repo, run discovery,
save prospects, and work them through the outreach pipeline.

## Architecture

```
src/
├── core/                    # framework-free business logic (unit-testable)
│   ├── types.ts             # domain model
│   ├── utils.ts             # crypto (PBKDF2), ids, time, errors
│   ├── storage.ts           # StorageAdapter interface + localStorage impl
│   ├── github.ts            # GitHub API client, URL validation, rate limits
│   ├── analysis.ts          # repo → ProjectProfile (keywords/audience/query terms)
│   ├── discovery.ts         # evidence-gathering engine (issues/repos/contributors)
│   ├── scoring.ts           # deterministic, documented scoring model
│   └── services.ts          # auth/projects/prospects/outreach/feedback + ownership guards
├── state/store.tsx          # reactive workspace state over services
├── components/              # icons (hand-drawn SVG), ui primitives, domain widgets, shell
└── pages/                   # Landing, Auth, Dashboard, ProjectNew, ProjectDetail,
                             # Discovery, ProspectDetail, Outreach, Community
```

**Layering rules**

- Business logic lives in `core/` — never in route handlers or components.
- All persistence goes through `StorageAdapter`. The bundled `LocalStorageAdapter` makes this a
  local-first build (everything stays in your browser). Swap in a server-backed adapter
  (PostgreSQL behind an API) without touching services or UI — that's the production path.
- External integrations sit behind interfaces (`GitHubClient`) so the transport is replaceable.

**Data flow:** `GitHub API → analysis → discovery candidates → scoreCandidate → saveResults →
prospects → outreach events / feedback → computeFunnel`.

## Scoring model (deterministic & documented)

| Signal | Max | Rule |
|---|---|---|
| Problem evidence | 30 | Publicly asked for / discussed the exact problem (issue title/body). Question-shaped: 30 · discussion: 20 |
| Related project | 25 | Maintains a repo matching the project's query terms. 15 base + 5 per matched term (max +10) |
| Contributes to related repos | 15 | Recent commits in closely related repos. 12 base, +3 for 2+ repos |
| Technology match | 20 | Language match +8 · topic/keyword overlap +4 each (max +12). *Weak* |
| Recent activity | 15 | ≤30d: 15 · ≤90d: 10 · ≤180d: 6 · ≤1y: 3. *Weak* |
| Audience alignment | 8 | Bio/topics align with derived audience. *Weak* |

- Signals sum, capped at 100.
- **Confidence:** HIGH = score ≥ 70 *and* a strong signal ≥ 20 pts · MEDIUM = score ≥ 45 or any
  strong signal · else LOW.
- **Weak signals alone can never exceed 43/100.** "Uses Python" is context, not intent — a
  weak-only candidate is always a LOW-confidence cold lead.
- Same evidence in → same score out. No randomness, no black box. The model is implemented in
  `src/core/scoring.ts` as pure functions, ready for property-based unit tests.

## GitHub integration & security

- **Official API only**, over HTTPS, fixed host `api.github.com`.
- **SSRF-safe by construction:** repo input is validated against `github.com` with a strict
  allow-list regex (`parseRepoInput` in `src/core/github.ts`); only the extracted `owner/repo`
  is ever interpolated into request paths. Ports, credentials in URLs, and non-GitHub hosts
  are rejected.
- **Secrets via environment** (`VITE_GITHUB_TOKEN`, optional). Tokens are only ever sent to
  `api.github.com` and never logged. `.env` is gitignored.
- **Failures handled gracefully:** timeouts (9s AbortController), 404 (nonexistent/private repo),
  403/429 rate limits with reset times surfaced in the UI, malformed JSON, network errors.
- **Rate limiting respected on the client side:** discovery paces requests (~700ms apart) and
  uses ≤ ~15 calls per run. The UI shows remaining core/search budget live.
- **Passwords:** PBKDF2-SHA256, 150k iterations, random 16-byte salts. Never plaintext.
- **Authorization:** every service call verifies `resource.ownerId === actorId` (IDOR
  protection). Private notes, drafts, outreach history and feedback are never exposed
  publicly; the community index shares only already-public repo metadata + username, and
  only when the owner opts in.
- **Input validation** on usernames, passwords, notes (2k), drafts (5k), ratings (1–5).
- No raw HTML injection; React renders all external strings as text.

## Hard limits — what UserScout will NOT do

- ❌ automatic mass emails or bulk messaging
- ❌ automated outreach campaigns / sequences
- ❌ scraping private information or bypassing auth / API restrictions
- ❌ collecting unnecessary personal data (only public GitHub fields are modeled)
- ❌ selling or sharing personal information
- ❌ inventing statistics — funnel metrics are computed from your own rows, or not shown

The human developer writes every message and presses send themselves, from their own
accounts. UserScout provides *context for personalized outreach*, nothing more.

## Environment variables

See [.env.example](.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `VITE_GITHUB_TOKEN` | No | Personal access token (no scopes needed for public data). Raises limits to 5,000 core/h and 30 search/min. |

## Testing

The scoring engine, URL validation, and discovery aggregation are pure functions in `core/`
designed for direct unit testing (e.g. `vitest run src/core`). Deterministic scoring means
tests can assert exact scores for fixed evidence fixtures.

> **Note on this build:** the sandbox used to generate this repository has no shell access,
> so a test runner is not wired into `package.json` and tests were not executed here.
> Verification was done via strict typecheck + production build + manual flow review.
> Adding `vitest` and fixture tests for `scoreCandidate` / `parseRepoInput` is the
> recommended first contribution — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Production deployment

- `npm run build` produces a static bundle (`dist/`) deployable to any static host
  (Netlify, Vercel, GitHub Pages, S3). Use hash routing (already configured) or configure
  SPA rewrites.
- For multi-device / multi-user production use, implement a server-backed
  `StorageAdapter` (PostgreSQL, row-level ownership) behind your API; `core/services.ts`
  is already organized around ownership-guarded operations and needs no changes.
- Add real OAuth (e.g. GitHub OAuth) server-side; the local PBKDF2 accounts in this build
  demonstrate the ownership model but are device-local by design.

## Known limitations (honest list)

1. **Local-first persistence.** Accounts and CRM data live in `localStorage` on one device.
   Clearing site data clears them. Export-before-clear is a planned feature.
2. **Client-side auth is a demonstration, not a security boundary.** Anyone with device
   access can inspect `localStorage`. Do not treat this build as protecting truly sensitive
   data; wire the server adapter for that.
3. **Unauthenticated GitHub limits** (60 core/h, 10 search/min) throttle heavy discovery use.
   Set `VITE_GITHUB_TOKEN`.
4. **Discovery quality follows repo quality.** Repos with no description/topics yield weak
   query terms and weaker prospects — by design, the engine refuses to guess.
5. Discovery dedupes per project; the same person can appear under two of your projects
   (that's legitimate — different contexts).

## License

MIT — see [LICENSE](LICENSE).
