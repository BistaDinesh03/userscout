# UserScout architecture

## Runtime shape

UserScout is a React 18 and TypeScript single-page application built with Vite. Hash routing keeps the built site deployable to static hosts without server-side rewrites.

The runtime has three layers:

- `src/core/` contains domain types, pure analysis and scoring, GitHub transport, storage, and ownership-guarded services.
- `src/state/store.tsx` creates the service boundary for React and reloads state after mutations.
- `src/components/` and `src/pages/` render the product and collect user actions; they do not call storage directly.

## Data flow

```text
public GitHub API
  -> repository analysis
  -> deterministic project profile
  -> discovery candidates with evidence
  -> transparent score and confidence
  -> saved prospects
  -> manual drafts, notes, statuses, feedback
  -> record-based funnel
```

`GitHubClient` is an interface so transport can be replaced by a server-side proxy. `StorageAdapter` is also an interface; the current `LocalStorageAdapter` is intentionally local-first.

## Security boundaries

Repository input is restricted to `github.com` or `owner/repo` shorthand before values are interpolated into fixed `api.github.com` paths. Requests use a timeout and map common GitHub failures to human-readable errors.

Private records carry an owner ID. Services check that ID before reading or mutating projects, prospects, notes, drafts, timeline events, and feedback. React renders external strings as text rather than raw HTML.

The local account flow uses Web Crypto PBKDF2 password hashing, but browser storage is not a security boundary. Anyone with access to the device can inspect or modify local data. No GitHub token belongs in a `VITE_*` variable; Vite exposes those values in the browser bundle.

## Production path

A multi-user deployment needs:

1. Server-side OAuth and session management.
2. A database-backed `StorageAdapter` with enforced row-level ownership.
3. A server-side GitHub API proxy for authenticated requests and rate-limit management.
4. Production monitoring, rate limiting, backups, and security testing.

Those changes can preserve the service and UI boundaries, but they are not included in this static local-first repository.
