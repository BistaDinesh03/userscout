<p align="center">
  <img src="docs/userscout-logo.svg" alt="UserScout radar logo" width="72" />
</p>

<h1 align="center">UserScout</h1>

<p align="center"><strong>Find people who actually need what you built.</strong></p>

<p align="center">
  Open-source user discovery for developers. Find public evidence connected to the problems your project solves, understand why someone is relevant, and reach out personally.
</p>

<p align="center">
  <a href="https://github.com/BistaDinesh03/userscout"><strong>View on GitHub</strong></a>
  &nbsp;|&nbsp;
  <a href="#quick-start"><strong>Live Demo</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Open_Source-MIT-f2a93b?style=flat-square" alt="Open Source" />
  <img src="https://img.shields.io/badge/Data-Public_GitHub_Only-7cc98f?style=flat-square" alt="Public GitHub Data" />
  <img src="https://img.shields.io/badge/Storage-Local_First-6ba3c9?style=flat-square" alt="Local-First" />
  <img src="https://img.shields.io/badge/Outreach-Human_Controlled-8a7ec9?style=flat-square" alt="Human-Controlled Outreach" />
  <img src="https://img.shields.io/badge/No_Mass_Outreach-Yes-e06b6b?style=flat-square" alt="No Mass Outreach" />
</p>

---

## What UserScout Does

Most developer tools help you build. UserScout helps you answer the harder question: **"Who actually needs this?"**

Point UserScout at a public GitHub repository and it finds people with public evidence of caring about the problem your project solves.

---

## Key Features

### Discover

Find people through public GitHub activity: open issues asking about the problem, related repos they maintain, projects they contribute to.

### Verify

Every prospect comes with evidence you can inspect. No black-box scores. Links to the exact public activity behind each signal.

### Prioritize

Transparent relevance scoring with strong-signal weighting. Technology overlap alone never creates a high-confidence prospect.

### Human Outreach

UserScout helps with research and context. You write the message and send it yourself. No automation, no mass messaging.

---

## Product Screenshots

![Landing page](screenshots/screenshot-landing.png)

*Landing page — the public entry point.*

![Discovery](screenshots/screenshot-discovery.png)

*Discovery — find public evidence connected to your project's problem space.*

![Prospect Profile](screenshots/screenshot-prospect.png)

*Prospect profile — see why someone is relevant, with evidence you can verify.*

---

## How It Works

1. **Add a public GitHub project**
2. **Analyze** the problem space and target audience
3. **Discover** people with public evidence of related activity
4. **Review** transparent relevance scores and evidence
5. **Contact** people yourself — write personal messages
6. **Track** replies, trials, feedback, and conversions

---

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run typecheck  # strict TypeScript check
```

---

## Tech Stack

- React 18 + TypeScript
- Vite + Tailwind CSS
- React Router hash routing
- GitHub REST API (public data only)
- Browser `localStorage` (local-first)

---

## Architecture

```
src/
├── core/          # framework-free business logic (unit-testable)
│   ├── types.ts       # domain model
│   ├── utils.ts       # crypto (PBKDF2), ids, time, errors
│   ├── storage.ts     # StorageAdapter interface + localStorage impl
│   ├── github.ts      # GitHub API client, URL validation, rate limits
│   ├── analysis.ts    # repo → ProjectProfile (keywords/audience/query terms)
│   ├── discovery.ts   # evidence-gathering engine (issues/repos/contributors)
│   ├── scoring.ts     # deterministic, documented scoring model
│   └── services.ts    # auth/projects/prospects/outreach/feedback + ownership guards
├── state/
│   └── store.tsx      # reactive workspace state over services
├── components/        # icons, UI primitives, domain widgets, shell
└── pages/             # Landing, Auth, Dashboard, ProjectNew, ProjectDetail,
                       # Discovery, ProspectDetail, Outreach, Community
```

**Data flow:** `GitHub API → analysis → discovery candidates → scoreCandidate → saveResults → prospects → outreach events / feedback → computeFunnel`

---

## Scoring Model

| Signal                       | Max | Rule                                                                                                      |
| ---------------------------- | --- | --------------------------------------------------------------------------------------------------------- |
| Problem evidence             | 30  | Publicly asked for / discussed the exact problem (issue title/body). Question-shaped: 30 · discussion: 20 |
| Related project              | 25  | Maintains a repo matching the project's query terms. 15 base + 5 per matched term (max +10)               |
| Contributes to related repos | 15  | Recent commits in closely related repos. 12 base, +3 for 2+ repos                                         |
| Technology match             | 20  | Language match +8 · topic/keyword overlap +4 each (max +12). *Weak*                                       |
| Recent activity              | 15  | ≤30d: 15 · ≤90d: 10 · ≤180d: 6 · ≤1y: 3. *Weak*                                                           |
| Audience alignment           | 8   | Bio/topics align with derived audience. *Weak*                                                            |

- Weak signals alone can never exceed 43/100. "Uses Python" is context, not intent.
- Same evidence in → same score out. No randomness, no black box.

---

## GitHub Integration & Security

- **Official API only**, over HTTPS, fixed host `api.github.com`
- **SSRF-safe:** repo input validated against `github.com` with strict regex
- **No browser GitHub secrets** — unauthenticated public API requests only
- **Rate limiting respected** — discovery paces requests, UI shows remaining budget
- **Passwords:** PBKDF2-SHA256, 150k iterations, random salts. Never plaintext
- **Authorization:** every service call verifies `resource.ownerId === actorId` (IDOR protection)

---

## Hard Limits — What UserScout Will NOT Do

- Automatic mass emails or bulk messaging
- Automated outreach campaigns or sequences
- Scraping private information or bypassing authentication
- Collecting unnecessary personal data
- Inventing statistics or metrics
- Guessing personal contact information

The human developer writes every message and presses send themselves. UserScout provides *context for personalized outreach*, nothing more.

---

## Testing

```bash
npm run test
npm run typecheck
npm run build
```

---

## Known Limitations

1. **Local-first** — data lives in `localStorage` on one device
2. **Client-side auth is a demonstration** — not a production security boundary
3. **Unauthenticated GitHub limits** (60 core/h, 10 search/min) throttle heavy use
4. **Discovery quality follows repo quality** — weak descriptions yield weaker prospects

---

## License

MIT — see [LICENSE](LICENSE).
