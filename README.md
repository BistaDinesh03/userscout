<p align="center">
  <img src="docs/userscout-logo.svg" alt="UserScout radar logo" width="72" />
</p>

# UserScout

> **Find people who actually need what you built.**

<p align="center">
  <img src="docs/demo/userscout-demo.gif" alt="UserScout demo" width="100%" />
</p>

Open-source user discovery for developers. Find public evidence connected to the problems your project solves, understand why someone is relevant, and reach out personally.

---

**MIT License** · **Open Source** · **Public GitHub Data Only** · **Local-first** · **Human-controlled Outreach** · **No Private Scraping**

---

## Product

UserScout helps you go from "My project needs users" to "I know who might need it, why they're relevant, and how to reach them."

![Landing page](screenshots/screenshot-landing.png)

### Discovery

Find public evidence connected to your project's problem space.

![Discovery](screenshots/screenshot-discovery.png)

### Prospect Profile

See why someone is relevant, with evidence you can verify.

![Prospect Profile](screenshots/screenshot-prospect.png)

---

## Why UserScout?

Most developer tools help you build. UserScout helps you answer the harder question: **"Who actually needs this?"**

- **Evidence, not guesses** — Find public activity connected to the problem you solve.
- **Quality over quantity** — Prioritize stronger opportunities instead of generating huge lead lists.
- **Transparent scoring** — Every score has an explainable signal breakdown.
- **Human-controlled outreach** — UserScout helps with research and context. You write and send the message yourself.

---

## How it works

1. **Add a public GitHub project**
2. **Analyze** the problem space and target audience
3. **Discover** people with public evidence of related activity
4. **Review** transparent relevance scores and evidence
5. **Contact** people yourself — write personal messages
6. **Track** replies, trials, feedback, and conversions

---

## Tech stack

- React 18 + TypeScript
- Vite + Tailwind CSS
- React Router hash routing
- GitHub REST API (public data only)
- Browser `localStorage` (local-first)

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run typecheck  # strict TypeScript check
```

Create a workspace account (stored locally, PBKDF2-hashed), add your repo, run discovery, save prospects, and work them through the outreach pipeline.

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

## Scoring model (deterministic & documented)

| Signal                       | Max | Rule                                                                                                      |
| ---------------------------- | --- | --------------------------------------------------------------------------------------------------------- |
| Problem evidence             | 30  | Publicly asked for / discussed the exact problem (issue title/body). Question-shaped: 30 · discussion: 20 |
| Related project              | 25  | Maintains a repo matching the project's query terms. 15 base + 5 per matched term (max +10)               |
| Contributes to related repos | 15  | Recent commits in closely related repos. 12 base, +3 for 2+ repos                                         |
| Technology match             | 20  | Language match +8 · topic/keyword overlap +4 each (max +12). *Weak*                                       |
| Recent activity              | 15  | ≤30d: 15 · ≤90d: 10 · ≤180d: 6 · ≤1y: 3. *Weak*                                                           |
| Audience alignment           | 8   | Bio/topics align with derived audience. *Weak*                                                            |

- **Weak signals alone can never exceed 43/100.** "Uses Python" is context, not intent.
- Same evidence in → same score out. No randomness, no black box.

---

## GitHub integration & security

- **Official API only**, over HTTPS, fixed host `api.github.com`
- **SSRF-safe:** repo input validated against `github.com` with strict regex
- **No browser GitHub secrets** — unauthenticated public API requests only
- **Rate limiting respected** — discovery paces requests, UI shows remaining budget
- **Passwords:** PBKDF2-SHA256, 150k iterations, random salts. Never plaintext
- **Authorization:** every service call verifies `resource.ownerId === actorId` (IDOR protection)

---

## Hard limits — what UserScout will NOT do

- ❌ Automatic mass emails or bulk messaging
- ❌ Automated outreach campaigns / sequences
- ❌ Scraping private information or bypassing auth
- ❌ Collecting unnecessary personal data
- ❌ Inventing statistics
- ❌ Guessing personal contact information

The human developer writes every message and presses send themselves. UserScout provides *context for personalized outreach*, nothing more.

---

## Testing

```bash
npm run test
npm run typecheck
npm run build
```

---

## Known limitations (honest list)

1. **Local-first** — data lives in `localStorage` on one device
2. **Client-side auth is a demonstration** — not a production security boundary
3. **Unauthenticated GitHub limits** (60 core/h, 10 search/min) throttle heavy use
4. **Discovery quality follows repo quality** — weak descriptions yield weaker prospects

---

## License

MIT — see [LICENSE](LICENSE).
