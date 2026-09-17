# UserScout

> **Find people who actually need what you built.**

UserScout is an open-source user-discovery platform for developers who ship open-source projects but struggle to find real users and meaningful feedback. Point it at a public GitHub repository and it will:

1. **Analyze** the project via the official GitHub API (metadata, topics, README, languages).
2. **Derive** the likely problem space, target audience, and search vocabulary — deterministically.
3. **Discover** people with *public evidence* connected to the problem the project solves (open issues asking about the problem, related repos they maintain, related projects they contribute to).
4. **Score** each prospect 0–100 with a transparent, deterministic, testable model.
5. **Explain** every score: signal breakdown + links to the exact public activity behind it.
6. **Enrich** prospects with legitimate public contact paths (GitHub, personal website, LinkedIn, X) with source attribution.
7. Track the human part: **save → personally contact → reply → trial → feedback → user**, with private notes, a manual outreach workspace, and a conversion funnel computed from your own records only.

**Philosophy: QUALITY > QUANTITY.** UserScout refuses to be a spam platform. See [Hard limits](#hard-limits).

---

## Quick start

**Backend (FastAPI + SQLite):**

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
Frontend (React + Vite):

bash
npm install
npm run dev                 # http://localhost:3000
npm run build               # production build → dist/
npm run typecheck           # strict TypeScript check
npm run test                # frontend unit tests
Tests:

bash
# Frontend
npm run test
npm run typecheck

# Backend
cd backend
python -m pytest tests/ -v
Open http://localhost:3000, create a workspace account, add your repo, run discovery, save prospects, and work them through the outreach pipeline.

Architecture
Frontend (React 18 + TypeScript + Vite + Tailwind)

text
src/
├── core/                    # framework-free business logic (unit-testable)
│   ├── types.ts             # domain model
│   ├── utils.ts             # crypto, ids, time, errors
│   ├── api.ts               # HTTP client for the FastAPI backend
│   ├── github.ts            # GitHub API client, URL validation, rate limits
│   ├── analysis.ts          # repo → ProjectProfile (keywords/audience/query terms)
│   ├── discovery.ts         # evidence-gathering engine (issues/repos/contributors)
│   ├── scoring.ts           # deterministic, documented scoring model
│   └── services.ts          # funnel math + shared types
├── state/store.tsx          # reactive workspace state over the API
├── components/              # icons (hand-drawn SVG), ui primitives, domain widgets
└── pages/                   # Landing, Auth, Dashboard, ProjectNew, ProjectDetail,
                             # Discovery, ProspectDetail, Outreach, Community
Backend (FastAPI + SQLAlchemy + SQLite)

text
backend/
├── app/
│   ├── main.py              # API endpoints
│   ├── models.py            # SQLAlchemy models (User, Project, Prospect,
│   │                        # ContactChannel, OutreachEvent, OutreachMessage,
│   │                        # Feedback, EmailIntegration, Session)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── database.py          # engine + session factory
│   ├── config.py            # environment-driven settings
│   ├── auth_utils.py        # Argon2 hashing + session tokens
│   ├── ssrf.py              # SSRF guard for outbound HTTP
│   └── enrichment.py        # public contact discovery service
├── tests/                   # pytest suite
└── data/userscout.db        # persistent SQLite (gitignored)
Layering rules

Business logic lives in core/ — never in route handlers or components.

The browser is not the source of truth. All persistence goes through the FastAPI backend.

Every endpoint verifies ownership server-side; IDOR is prevented by scoping all queries to owner_id.

External integrations sit behind interfaces (GitHubClient, StorageAdapter) so the transport is replaceable.

Data flow: GitHub API → analysis → discovery candidates → scoreCandidate → backend persistence → outreach events / feedback → funnel

Scoring model (deterministic & documented)
SignalMaxRule
Problem evidence30Publicly asked for / discussed the exact problem (issue title/body). Question-shaped: 30 · discussion: 20
Related project25Maintains a repo matching the project's query terms. 15 base + 5 per matched term (max +10)
Contributes to related repos15Recent commits in closely related repos. 12 base, +3 for 2+ repos
Technology match20Language match +8 · topic/keyword overlap +4 each (max +12). Weak
Recent activity15≤30d: 15 · ≤90d: 10 · ≤180d: 6 · ≤1y: 3. Weak
Audience alignment8Bio/topics align with derived audience. Weak
Signals sum, capped at 100.

Confidence: HIGH = score ≥ 70 and a strong signal ≥ 20 pts · MEDIUM = score ≥ 45 or any strong signal · else LOW.

Weak signals alone can never exceed 43/100. "Uses Python" is context, not intent — a weak-only candidate is always a LOW-confidence cold lead.

Same evidence in → same score out. No randomness, no black box.

Public contact enrichment
UserScout helps you find legitimate public contact paths without becoming a data broker.

Sources (in order):

GitHub profile (blog, twitter_username, and /users/{name}/social_accounts)

The one personal website linked from GitHub

On that website only: one /contact or /about page with mailto: and linkedin.com/in/ links

Strict rules:

No email guessing. Only mailto: links literally present on the page.

SSRF-protected. Every outbound URL is validated to resolve to a public IP. Localhost, private ranges, and cloud metadata endpoints are blocked.

Bounded. Max ~4 HTTP requests per prospect, 5s timeout each, 100KB response cap, respects robots.txt.

Provenance. Every channel stores its source URL and source type ("Linked from GitHub", "Found on public website").

Never marked "verified" unless there is a meaningful verification basis.

GitHub integration & security
Official API only, over HTTPS, fixed host api.github.com.

SSRF-safe by construction: repo input is validated against github.com with a strict allow-list regex (parseRepoInput); only the extracted owner/repo is interpolated into request paths. Ports, credentials in URLs, and non-GitHub hosts are rejected.

No browser GitHub secrets. Unauthenticated public API requests only. Authenticated production use requires a server-side proxy — never put a GitHub token in a VITE_* variable.

Failures handled gracefully: timeouts (9s AbortController), 404 (nonexistent/private repo), 403/429 rate limits with reset times surfaced in the UI, malformed JSON, network errors.

Rate limiting respected on the client side: discovery paces requests (~700ms apart) and uses ≤ ~15 calls per run.

Passwords: Argon2id hashing (passlib). Never plaintext, never returned by the API.

Sessions: HttpOnly, SameSite=Lax cookies with 30-day TTL. Cleared on logout.

Authorization: every service call verifies resource.owner_id == actor.id. Private notes, drafts, outreach history, and feedback are never exposed publicly.

Input validation on usernames, passwords, notes (2k), drafts (5k), ratings (1–5).

Hard limits — what UserScout will NOT do
❌ Automatic mass emails or bulk messaging

❌ Automated outreach campaigns / sequences

❌ Scraping private information or bypassing auth / API restrictions

❌ Guessing emails or constructing possible addresses

❌ Collecting unnecessary personal data

❌ Selling or sharing personal information

❌ Inventing statistics — funnel metrics are computed from your own rows, or not shown

The human developer writes every message and presses send themselves. UserScout provides context for personalized outreach, nothing more.

Environment variables
Backend — see backend/.env.example:

VariableDefaultPurpose
DATABASE_URLsqlite:///./data/userscout.dbSQLAlchemy connection string
SECRET_KEYdev-secret-key-change-in-prodSession signing key
ENVIRONMENTdevelopmentproduction enables secure cookies
CORS_ORIGINShttp://localhost:3000Allowed frontend origins
Frontend — VITE_API_URL (defaults to http://localhost:8000).

Known limitations (honest list)
SQLite is single-machine. Persistent on the machine running the backend, but not distributed. Use PostgreSQL for multi-instance deployments.

No OAuth yet. Local Argon2-hashed accounts demonstrate the ownership model, but production should use server-side OAuth (e.g., GitHub).

Unauthenticated GitHub limits (60 core/h, 10 search/min) throttle heavy discovery use. Add a server-side GitHub proxy for authenticated requests.

Discovery quality follows repo quality. Repos with no description/topics yield weak query terms and weaker prospects — by design.

Contact enrichment is intentionally narrow. Only GitHub profile + one linked website. No recursive crawling, no private data, no email guessing.

Production deployment
npm run build produces a static bundle (dist/) deployable to any static host (Netlify, Vercel, GitHub Pages, S3). Use hash routing (already configured) or configure SPA rewrites.

For multi-device / multi-user production use, swap SQLite for PostgreSQL behind a server-backed StorageAdapter with row-level ownership. The service layer is already organized around ownership-guarded operations.

Add real OAuth (e.g., GitHub OAuth) server-side before storing sensitive or multi-device data.

License
MIT — see LICENSE.
