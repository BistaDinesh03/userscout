<p align="center">
  <img src="docs/userscout-logo.svg" alt="UserScout radar logo" width="72" />
</p>

<h1 align="center">UserScout</h1>

<p align="center"><strong>Find people who actually need what you built.</strong></p>

<p align="center">
  Open-source user discovery for developers. Point UserScout at a public GitHub repository and it finds people with public evidence connected to the problem your project solves — then helps you reach out personally.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-f2a93b?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square" alt="React 18" />
  <img src="https://img.shields.io/badge/FastAPI-Python-009688?style=flat-square" alt="FastAPI" />
  <img src="https://img.shields.io/badge/database-SQLite-003b57?style=flat-square" alt="SQLite" />
</p>

---

## What it does

UserScout answers the hardest question after you ship something: **who actually needs this?**

It walks through one loop:

1. **Analyze** your public GitHub repository — metadata, topics, README, languages.
2. **Derive** the likely problem space, target audience, and search vocabulary — deterministically, no AI.
3. **Discover** people with public evidence connected to the problem you solve — issues they opened, related repos they maintain, projects they contribute to.
4. **Score** each prospect 0–100 with a transparent, testable model you can inspect.
5. **Explain** every score: signal breakdown plus links to the exact public activity behind it.
6. **Enrich** prospects with legitimate public contact paths — GitHub, personal site, LinkedIn, X — each with its source.
7. **Track** the human part: save → personally contact → reply → trial → feedback → user. Notes, drafts, and conversion data stay on your machine.

**Quality over quantity.** UserScout refuses to be a spam platform. See [Hard limits](#hard-limits).

---

## Screenshots

| Discovery | Prospect detail |
| :---: | :---: |
| ![Discovery](screenshots/screenshot-discovery.png) | ![Prospect detail](screenshots/screenshot-prospect.png) |

![Landing page](screenshots/screenshot-landing.png)

---

## Quick start

### Backend (FastAPI + SQLite)

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend (React + Vite)

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build → dist/
npm run typecheck    # strict TypeScript check
npm run test         # frontend unit tests
```

### Tests

```bash
# Frontend
npm run test
npm run typecheck

# Backend
cd backend
python -m pytest tests/ -v
```

Open [http://localhost:3000](http://localhost:3000), create a workspace account, add your repository, run discovery, save prospects, and work them through the outreach pipeline.

---

## Architecture

### Frontend — React 18 + TypeScript + Vite + Tailwind

```text
src/
├── core/                    # Framework-free business logic (unit-testable)
│   ├── types.ts             # Domain model
│   ├── utils.ts             # Crypto, IDs, time, errors
│   ├── api.ts               # HTTP client for the FastAPI backend
│   ├── github.ts            # GitHub API client, URL validation, rate limits
│   ├── analysis.ts          # Repo → ProjectProfile (keywords / audience / query terms)
│   ├── discovery.ts         # Evidence-gathering engine (issues / repos / contributors)
│   ├── scoring.ts           # Deterministic scoring + dimensions
│   ├── evidence.ts          # Evidence classification, dedup, tech-collapse
│   ├── recency.ts           # Centralized recency buckets
│   └── services.ts          # Funnel math + shared types
├── state/store.tsx          # Reactive workspace state over the API
├── components/              # Icons, UI primitives, domain widgets, AppShell
└── pages/                   # Landing, Auth, Home, Dashboard, ProjectNew, ProjectDetail,
                             # Discovery, ProspectDetail, Prospects, Outreach, Community
```

### Backend — FastAPI + SQLAlchemy + SQLite

```text
backend/
├── app/
│   ├── main.py              # API endpoints
│   ├── models.py            # SQLAlchemy models (User, Project, Prospect,
│   │                        # ContactChannel, OutreachEvent, OutreachMessage,
│   │                        # Feedback, EmailIntegration, Session)
│   ├── schemas.py           # Pydantic request / response schemas
│   ├── database.py          # Engine + session factory
│   ├── config.py            # Environment-driven settings
│   ├── auth_utils.py        # Argon2 hashing + session tokens
│   ├── migrations_util.py   # Idempotent startup migrations
│   ├── ssrf.py              # SSRF guard for outbound HTTP
│   └── enrichment.py        # Public contact discovery service
├── tests/                   # pytest suite
└── data/userscout.db        # Persistent SQLite (gitignored)
```

### Layering rules

- Business logic lives in `core/` — never in route handlers or components.
- The browser is **not** the source of truth. All persistence goes through the FastAPI backend.
- Every endpoint verifies ownership server-side; IDOR is prevented by scoping all queries to `owner_id`.
- External integrations sit behind interfaces (`GitHubClient`, `StorageAdapter`) so the transport is replaceable.

**Data flow:** GitHub API → analysis → discovery candidates → scoring + evidence classification → backend persistence → outreach events / feedback → funnel

---

## Evidence intelligence

Every prospect carries five separate dimensions — not a single blended score:

| Dimension | Meaning |
| --- | --- |
| **Relevance** | How closely the person matches the project's problem. 0–100. |
| **Evidence strength** | Very strong · Strong · Medium · Weak. Derived from the actual evidence, not the score. |
| **Recency** | Very recent (≤14d) · Recent (≤30d) · Aging (≤90d) · Old. Computed from real activity. |
| **Contactability** | How many legitimate public contact paths exist. |
| **Confidence** | Evidence-driven. High confidence *requires* strong evidence — a high score alone is never enough. |

**Determinism is a feature.** Same input → same output. No randomness, no black box. Weak signals (technology overlap, framework match) can never by themselves produce a high-confidence prospect.

**Deduplication.** The same underlying signal — a Python repo, a Python topic, a Python contribution — collapses into one line. Duplicate evidence never inflates a score.

---

## Security & privacy

- **Official GitHub API only** over HTTPS against a fixed host (`api.github.com`).
- **SSRF-protected.** Every outbound URL — including personal sites found via enrichment — is validated to resolve to a public IP. Localhost, private ranges, and cloud metadata endpoints are blocked. GitHub is treated as a trusted host even on networks where a local DNS resolver misclassifies it.
- **No browser GitHub secrets.** Unauthenticated public API requests only. Authenticated production use requires a server-side proxy — never put a token in a `VITE_*` variable.
- **Passwords.** Argon2id hashing. Never plaintext, never returned by the API.
- **Sessions.** HttpOnly, SameSite=Lax cookies with a 30-day TTL. Cleared on logout.
- **Ownership.** Every service call verifies `resource.owner_id == actor.id`. Private notes, drafts, outreach history, and feedback are never exposed publicly.
- **Input validation** on usernames, passwords, notes (2k), drafts (5k), ratings (1–5), and repository URLs.
- **Rate limits respected.** Discovery paces requests and shows the remaining GitHub budget live.

---

## Hard limits

UserScout will **not**:

- Send mass emails or bulk messages
- Run automated outreach campaigns or sequences
- Scrape private information or bypass auth / API restrictions
- Guess email addresses or construct possible addresses
- Collect unnecessary personal data
- Sell or share personal information
- Invent statistics — every funnel metric comes from your own rows, or is not shown

The human developer writes every message and presses send themselves. UserScout provides *context for personalized outreach*, nothing more.

---

## Environment variables

**Backend** — see `backend/.env.example`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./data/userscout.db` | SQLAlchemy connection string |
| `SECRET_KEY` | `dev-secret-key-change-in-prod` | Session signing key |
| `ENVIRONMENT` | `development` | `production` enables secure cookies |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins |

**Frontend** — `VITE_API_URL` (defaults to `http://localhost:8000`).

---

## Known limitations

1. **SQLite is single-machine.** Persistent on the machine running the backend, but not distributed. Use PostgreSQL for multi-instance deployments.
2. **No OAuth yet.** Local Argon2-hashed accounts demonstrate the ownership model; production should use server-side OAuth (e.g., GitHub).
3. **Unauthenticated GitHub limits** (60 core/h, 10 search/min) throttle heavy discovery. Add a server-side GitHub proxy for authenticated requests.
4. **Discovery quality follows repo quality.** Repos with no description or topics yield weak query terms and weaker prospects — by design. The engine refuses to guess.
5. **Contact enrichment is intentionally narrow.** Only the GitHub profile plus one linked website. No recursive crawling, no private data, no email guessing.

---

## Production deployment

- `npm run build` produces a static bundle (`dist/`) deployable to any static host (Netlify, Vercel, GitHub Pages, S3). Use hash routing (already configured) or configure SPA rewrites.
- For multi-device / multi-user production use, swap SQLite for PostgreSQL behind a server-backed `StorageAdapter` with row-level ownership. The service layer is already organized around ownership-guarded operations.
- Add real OAuth (e.g., GitHub OAuth) server-side before storing sensitive or multi-device data.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributions should preserve evidence-based discovery, transparent scoring, and human-controlled outreach.

## License

MIT — see [LICENSE](LICENSE).
