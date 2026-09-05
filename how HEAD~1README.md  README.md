<p align="center">
  <img src="docs/userscout-logo.svg" alt="UserScout radar logo" width="72" />
</p>

<h1 align="center">UserScout</h1>

<p align="center"><strong>Find people who actually need what you built.</strong></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f2a93b?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/TypeScript-React-3178c6?style=flat-square" alt="TypeScript and React" />
  <img src="https://img.shields.io/badge/built%20with-Vite-646cff?style=flat-square" alt="Built with Vite" />
  <img src="https://img.shields.io/badge/tests-Vitest-6e9f18?style=flat-square" alt="Tested with Vitest" />
</p>

UserScout helps open-source developers discover potential users through verifiable public evidence. It surfaces GitHub signals, scores relevance transparently, and keeps every contact decision under your control.

<p align="center">
  <img src="docs/demo/userscout-demo.gif" alt="UserScout: project analysis → discovery → evidence → outreach → tracking" />
</p>

## How it works

1. Add your GitHub project
2. Analyze the problem space and intended audience
3. Discover people with public evidence of related activity
4. Review transparent relevance scores
5. Contact people yourself and track outcomes

## Why UserScout

- **Evidence-based** — prospects are tied to verifiable GitHub activity, not assumptions
- **Transparent scoring** — see exactly how relevance is calculated
- **Human-controlled** — drafts and tracking help you; nothing sends automatically
- **Local-first** — workspace data stays in your browser

## Features

- GitHub project analysis with derived problem space, audience, and search vocabulary
- Public evidence discovery through issues, related repositories, and contributions
- Deterministic relevance scoring with confidence metrics
- Prospect profiles linked to underlying public activity
- Private notes, manual outreach drafts, and outcome tracking
- Conversion funnel computed from your engagement records

## Screenshots

### Discovery results with transparent scoring

![Discovery results](docs/screenshots/discover.png)

### Prospect detail with evidence and private workspace

![Prospect detail](docs/screenshots/prospect-detail.png)

### Manual outreach pipeline

![Outreach workspace](docs/screenshots/outreach-populated.png)

## Quick start

**Requirements:** Node.js 20 or newer

```bash
git clone https://github.com/BistaDinesh03/userscout.git
cd userscout
npm install
npm run dev
```

Verify and build:

```bash
npm run test
npm run typecheck
npm run build
```

Create a local workspace, add a public GitHub repository, and run discovery. This is a static client build using unauthenticated GitHub API requests—do not embed tokens in `VITE_*` variables.

## Privacy and responsible discovery

UserScout uses public GitHub data only. It does not scrape private information, send messages automatically, sell data, or invent activity. All notes, drafts, and outreach records remain in your local workspace. Every contact decision stays under your control.

See [docs/architecture.md](docs/architecture.md) for technical details and security model.

## Limitations

- Workspace data stored in browser localStorage (single device)
- Local authentication is a UI layer, not a server security boundary
- No backend, OAuth provider, or server database in this repository
- Unauthenticated GitHub rate limits apply (60 requests/hour per IP)
- Multi-user production use requires server-side persistence and authenticated GitHub proxy

## Roadmap

- [x] Public project analysis and evidence-backed discovery
- [x] Transparent scoring and manual outreach tracking
- [x] Local-first persistence with core tests
- [ ] Server-backed persistence and multi-device sync
- [ ] Production OAuth
- [ ] Authenticated GitHub API proxy
- [ ] Team workspaces
- [ ] Additional discovery sources
- [ ] Export and analytics

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and contribution guidelines. Contributions should preserve evidence-based discovery, transparent scoring, and user control.

## License

MIT. See [LICENSE](LICENSE).