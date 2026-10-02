# Backend plan — username accounts and database progress (Rust container + Postgres)

> **Status: PLANNED, not built.** Nothing in this document exists in the code
> yet: the site is still static, and every game still saves to `localStorage`
> only. This document was rewritten from scratch after the project owner bought
> **Workers Paid**; it replaces the earlier free-tier plan entirely.
>
> **Companion document:** [`RUNBOOK.md`](./RUNBOOK.md) — the hands-on steps
> (installs, Neon and Cloudflare setup, Access, secrets, migrations, deploy,
> rollback, troubleshooting). This file is the *why*; the runbook is the *how*.

## How to use these two documents

| If you want to… | Read |
| --- | --- |
| Know what changed since the free-tier plan | P1 |
| Know what was decided | **P2** |
| Understand what this costs the project's rules | P3 |
| Know the repo's exact starting point | P4 |
| See the options that were rejected | P5 |
| Understand the platform limits you are designing inside | P6 |
| Understand the account and hashing decisions | P7 |
| See the architecture and file layout | P8 |
| See the identity, session and credential design | P9 |
| See the database schema and HTTP API | **P10** |
| See what syncs, what never syncs, and how conflicts resolve | **P11** |
| See what changes in the frontend | P12 |
| See the test plan | P13 |
| See CI, the test environment and the production cutover | **P14** |
| **Start working** | P15 (work packages) → `RUNBOOK.md` |
| See what a human must do by hand | P18 |
| Learn the Rust you will actually write | P19 |

## Contents

- **P1** Purpose, status, and what changed
- **P2** Locked decisions
- **P3** The amendment this makes to the project rules
- **P4** Verified starting state of the repository
- **P5** Options considered, and why the chosen two won
- **P6** Platform facts and limits (Workers Paid, Containers, Access, R2, Neon)
- **P7** Decision record: password accounts, no recovery, and argon2id on `lite`
- **P8** Architecture
- **P9** Accounts, credentials and sessions
- **P10** Data model and HTTP API
- **P11** Progress: what syncs, how it merges, how it never breaks a game
- **P12** Frontend integration
- **P13** Testing strategy
- **P14** CI, the test environment, and the production cutover
- **P15** Work packages C1 – C15 (one commit each)
- **P16** Milestones
- **P17** Risks, failure modes and rollback
- **P18** Human checkpoints
- **P19** Rust primer for this project
- **P20** Glossary and references
- **P21** Revision log

---

## P1 Purpose, status, and what changed

**Goal.** A child (or their parent) can create an account with a username and a
password, and their progress follows them to another device, where the
**database is the record** and `localStorage` becomes a cache. Secondary goal,
stated by the project owner: this is the vehicle for **learning Rust**.

**Status.** Planned. Design agreed, zero lines written.

**What changed from the previous revision of this document.**

| Previous plan | This plan | Why |
| --- | --- | --- |
| Cloudflare Workers **Free**, 10 ms CPU per request | Workers **Paid** (30 s default, 5 min maximum per request) | The owner upgraded |
| The credential had to be a high-entropy player code, because a password hash cannot fit in 10 ms | **Username + password**, hashed with argon2id | The CPU ceiling that forced the compromise is gone |
| Rust compiled to WebAssembly inside the Worker isolate | A **normal Rust binary (axum) in a Cloudflare Container** | Owner's choice; a real Rust service, not a WASM shim |
| Email + password with verification and reset (chosen mid-session, then dropped) | **No email at all** | Owner's adjustment: no provider, no DNS work, no personal data, and therefore no password recovery |
| Progress mirrored *from* `localStorage`; local play always won | **Postgres is the record**; `localStorage` is a write-through cache; a game waits for the server only when this device has nothing cached | Owner's requirement: progress lives in the database |
| GitHub Pages published the same build as a second host | **Pages is retired** | A same-origin API cannot exist on `github.io` |
| Production only | **Plus a test environment** at `test.play2learn.divanchyshyn.com`, deployed automatically from pull requests and gated by Cloudflare Access | Owner's request |

**Non-goals.** No server-side rendering. No third-party identity provider. No
avatars, leaderboards, sharing, chat or social features. No analytics. No
names, birthdays, email addresses or any other personal data. No password
recovery, by design (P7).

---

## P2 Locked decisions

| # | Decision | Choice |
| --- | --- | --- |
| D1 | Where the backend runs | A **Cloudflare Container**, `instance_type: "lite"` (1/16 vCPU, 256 MiB, 2 GB disk), `max_instances: 1`, `sleepAfter: "10m"` |
| D2 | Backend language and stack | **Rust**: `axum` 0.8, `tokio`, `sqlx` 0.9, `argon2` 0.6, `tower-http`, `tracing` |
| D3 | How the browser reaches it | A small **Worker front door** (`edge/`, JavaScript) that owns the container's Durable Object and serves `dist/` as static assets; only `/api/*` invokes code |
| D4 | Datastore | **Postgres on Neon** (free tier), reached over TCP with sqlx; nightly `pg_dump` to R2 |
| D5 | Credential | **Username + password.** Username 3-20 chars `[A-Za-z][A-Za-z0-9_-]*`, unique case-insensitively; password 8-128 bytes, any characters |
| D6 | Password storage | **argon2id**, OWASP parameters m = 19456 KiB, t = 2, p = 1, plus a server-side pepper (`Argon2::new_with_secret`) |
| D7 | Session | 256-bit random token in a `__Host-lap_sid` cookie (`HttpOnly; Secure; SameSite=Lax; Path=/`); only `sha256(token)` is stored; rolling expiry of 12 months; `Origin` check on every state-changing request |
| D8 | Recovery | **None.** A forgotten password loses the account. Sessions are long-lived to make that rare, and the UI says so plainly |
| D9 | What syncs | Durable achievements only: `soundLabyrinth:gallery`, `wordFishing:journal`, `cardBattle:album` |
| D10 | What never syncs | In-progress sessions (`soundLabyrinth:progress`, `soundLabyrinth:game`, `wordFishing:trip`) and every `<game>:muted` setting |
| D11 | Who merges | The **client**, with the games' own codecs and monotonic union rules; the server is a size-capped, revision-stamped record store |
| D12 | Conflict rule | Per-record optimistic revision (`baseRevision`); a losing write returns the server row as a conflict, the client merges and retries once |
| D13 | Failure behaviour | **Fail-open.** No account and no network must never be visible in a game: not signed in means no requests at all, and a dead or slow API means the game renders from cache |
| D14 | Test environment | A second Worker `learn-and-play-test` (`wrangler.test.jsonc`) on `test.play2learn.divanchyshyn.com`, its own database and secrets, deployed automatically from same-repo pull requests, behind Cloudflare Access |
| D15 | Production | Unchanged trigger and gate: push to `main`, then the `cloudflare-production` environment's required reviewers approve the deploy |
| D16 | GitHub Pages | Retired: the workflow is deleted **and** the Pages source is set to None in repository settings |
| D17 | Secrets | Per environment, set with `wrangler secret put`; `.dev.vars` and `.env` stay gitignored and never enter the repository |

---

## P3 The amendment this makes to the project rules

`AGENTS.md` states, under *Stack and deployment*:

> *"Keep the app fully static: no server-side rendering, no API dependencies, no
> runtime secrets. Adding an `/api/*` route, a datastore binding, or anything the
> browser needs at runtime is an amendment to this rule, agreed deliberately,
> never an implementation detail."*

This plan **is** that deliberate amendment, agreed by the owner. It is not free.
What it costs, stated plainly:

1. **The site is no longer stateless or purely static.** A container runs Rust
   for `/api/*`, Postgres holds accounts and progress, and a bug in code that
   did not exist before can lose a child's progress.
2. **Runtime secrets now exist**: the database URL and the argon2 pepper, per
   environment, plus an R2 credential for backups.
3. **Three new third-party dependencies** enter the project: Cloudflare
   Containers (inside the existing paid plan), a Neon Postgres database, and an
   R2 bucket for backups. There is deliberately **no** email provider.
4. **The deploy grows two moving parts.** `wrangler deploy` now builds and
   pushes a container image, and a database migration runs before it.
5. **The definition of done grows.** `npm run lint` is no longer the whole of
   "lint": `cargo fmt --check`, `cargo clippy -- -D warnings` and `cargo test`
   join it, along with a `docker build`.
6. **A second hostname becomes publicly reachable** (`test.play2learn…`),
   protected by Cloudflare Access rather than by obscurity.

What it does **not** cost: the games. Game pages are still served by
Cloudflare's asset router and never invoke any code, the games' components do
not change, and sync is fail-open by rule (P11), so a total backend failure
degrades to "accounts do not work" and never to "the games do not load".

**Privacy.** The previous plan's strongest property survives: there is still no
personal data. An account is a UUID, a username chosen by the child, an
argon2id hash, and the games' own progress blobs. No email address is collected
precisely because there is no email feature to need one.

---

## P4 Verified starting state of the repository

Checked on the branch `feature/rust-backend` before writing this document.

**Deployment**

- `wrangler.jsonc` — `name: learn-and-play`, `assets.directory: ./dist`, and
  **no `main`**: Cloudflare serves `dist/` itself; there is no Worker script.
- `.github/workflows/deploy-cloudflare.yml` — a `verify` job (`npm ci` → lint →
  test → build → uploads `dist/`) then a `deploy` job behind the
  `cloudflare-production` environment's required reviewers, using
  `cloudflare/wrangler-action@v4`.
- `.github/workflows/deploy-pages.yml` — publishes the same build to GitHub
  Pages automatically, with no approval. This plan retires it (D16).
- `.github/workflows/ci.yml` — on every push and PR: `npm ci`, lint, test, build.
  Node 22, `actions/checkout@v7`, `actions/setup-node@v7`.
- `.gitignore` — `node_modules/`, `dist/`, `.wrangler/`, `coverage/`.

**Persistence today**

- `src/shared/persistence.js` — `readStorage` / `writeStorage` / `removeStorage`
  / `migrateStorage`; every operation is best-effort and swallows failures on
  purpose: *"a full or locked store is not the child's problem."*
- `src/shared/usePersistentState.js` — `useState` + read on mount + write on
  change, through a per-game `codec` (`parse` / `serialize`). The read happens
  **at mount**, which is why P11 needs a hydration gate before a game mounts.
- Storage keys in use:

  | Key | Shape | Kind |
  | --- | --- | --- |
  | `soundLabyrinth:gallery` | `{ seen: number[], round: number[] }` | durable achievement |
  | `soundLabyrinth:progress` | `{ imageIndex, earned[], cells[] }` | session in progress |
  | `soundLabyrinth:game` | `{ maze, mazeIndex, doors, runner, pos, celebrated }` | session in progress |
  | `wordFishing:journal` | `{ words[], trips, decorations[] }` | durable achievement |
  | `wordFishing:trip` | trip plan | session in progress |
  | `cardBattle:album` | `{ discovered[] }` | durable achievement |
  | `<game>:muted` | `'0'` / `'1'` | sound preference |

- `src/games/sound-labyrinth/progress.js` — the three codecs, plus the comment
  that draws exactly the line D9/D10 rely on: *"that reset clears the piece
  session, never the pictures the child has seen."*
- `src/games/sound-labyrinth/puzzle.js` — pure puzzle rules, already exported
  and React-free: `recordSeenImage` and friends are what the gallery merge
  replays (P11).
- `src/games/word-fishing/journal.js`, `src/games/card-battle/album.js` — the
  achievement codecs and their monotonic record functions.

**UI entry points**

- `src/home/main.jsx` — the library page: a `GAMES` array of four visible tiles
  plus commented-out hidden games. Natural home of the "Konto" link and of the
  early sync pull.
- Six page entry points, each a seven-line `createRoot(...).render(<Game />)`
  file: `src/games/<slug>/main.jsx`. These are the only game-side files this
  plan touches, and only to wrap the component in `SyncGate`.
- `vite.config.js` — `discoverGameEntries()` auto-discovers every
  `games/*/index.html`; the home `index.html` is an explicit entry (the new
  `account/index.html` becomes a second explicit entry).
- `eslint.config.js` — browser globals and React rules only for `src/**`; a new
  `edge/**` block with Worker globals is required (C5).

**Tooling and machine**

- Rust **is** installed on this machine: `rustc`/`cargo` 1.99.0
  (`stable-x86_64-pc-windows-msvc`), with Visual Studio 2022 Build Tools 18
  present, so `cargo test` can link. The `wasm32-unknown-unknown` target is
  **not** installed — and this plan does not need it.
- `worker-build` and `wrangler` are not installed globally; `wrangler` becomes a
  pinned devDependency (C5) so CI and the local machine agree.
- Docker Desktop is installed but its daemon is not running. It is required for
  `docker build`, the dev Postgres, and `wrangler dev` with a container (H1).
- `docs/audit/BASELINE.md` is referenced by `AGENTS.md` and `README.md` but did
  not exist in git history (and the audit's own `PLAN.md` / `SUMMARY.md` were
  never committed either): C2 re-establishes the baseline and drops the dead
  references.
- `opencode.json` allows the coding agent only `npm ci`, `npm run lint`,
  `npm run test*`, `npm run build` and read-only git — `cargo` is not in it (C4).

---

## P5 Options considered, and why the chosen two won

### Runtime

**A. Rust in a Cloudflare Container, fronted by a Worker — ✅ CHOSEN.**
`wrangler deploy` builds the image and pushes it; a Durable Object owns the
container and proxies `/api/*` into it; everything else is still static assets
served by the edge. A normal `axum` binary with normal tooling, `cargo test`
against a real Postgres, and no WASM constraints. Costs: 1-3 s cold start after
`sleepAfter`, an ephemeral container disk (irrelevant — the database is
external), one extra deploy moving part (the image), and no direct access to
Cloudflare bindings, which forces D4.

**B. Rust compiled to WebAssembly inside the Worker (workers-rs) + D1.**
The community-standard Cloudflare-native pairing, and it would put the database
one function call away (`env.DB`). Rejected by the owner in favour of a real
Rust service; the CPU ceiling that once made WASM attractive is no longer a
constraint either way.

**C. A JS/TS Worker talking to a Rust→WASM library.** Lowest risk, but the
backend stops being "written in Rust" and the owner asked for the real thing.

### Datastore

**A. Postgres on a free serverless tier (Neon) — ✅ CHOSEN.** The container is
an ordinary Linux process, so a normal TCP connection and `sqlx` work: real
migrations, real SQL, real integration tests (`#[sqlx::test]`) against a
throwaway database. Costs: a provider outside Cloudflare, 1 GB of storage,
scale-to-zero after 5 minutes idle (a few hundred ms to wake), and a restore
window short enough that a nightly `pg_dump` to R2 is part of the plan.

**B. Keep D1 and reach it from the container.** Containers cannot use Workers
bindings — that is an architectural boundary, not a quota: bindings are objects
the Workers runtime injects into an *isolate*, and D1 has no public SQL/TCP
endpoint with which a foreign process could authenticate. The supported bridge
is an **outbound handler** in the front-door Worker that intercepts the
container's HTTP calls to a virtual hostname, so every query becomes a round
trip through JavaScript. Cloudflare's own D1 REST API (`…/d1/database/…/query`)
is a second route, but it needs an account-scoped D1 token inside the container.
Both were rejected: the data layer would be partly JavaScript, un-testable from
`cargo`, and slower, for the sole benefit of keeping data inside Cloudflare.

**C. SQLite in the container.** The container disk is ephemeral — a fresh disk
from the image on every start — so this loses every account on the first sleep
unless something replicates it out (Litestream-style, or an R2 FUSE mount that
Cloudflare itself describes as not SSD-like). Rejected for accounts.

**D. Durable Object SQLite.** Lives on the Durable Object's side of the
boundary, not on the container's; reaching it from Rust means inventing another
RPC protocol. Rejected with B.

---

## P6 Platform facts and limits

**Re-check these before changing a decision — Cloudflare, Neon and GitHub all
move.** Figures below were verified while writing this plan.

### Workers Paid (the plan the owner is on)

| Feature | Workers Paid |
| --- | --- |
| CPU time per HTTP request | **30 s default, 5 min maximum** |
| Requests | unlimited (10 M/month included, then $0.30/M) |
| CPU-ms included | 30 M/month, then $0.02/M |
| Memory per isolate | 128 MB |
| Subrequests per request | 10,000 |
| Request body size | set by the zone plan (Free/Pro: 100 MB) |
| Static asset requests | free and unlimited |

CPU time is not wall time: waiting on the network (Neon, R2, the container) does
not count. Static asset requests never invoke the Worker at all, because
`run_worker_first` is scoped to `/api/*`.

### Cloudflare Containers

| Item | Value |
| --- | --- |
| Instance types | `lite` 1/16 vCPU / 256 MiB / 2 GB · `basic` 1/4 vCPU / 1 GiB / 4 GB · `standard-1…4` up to 4 vCPU / 12 GiB / 20 GB |
| Cold start | "often in the 1-3 second range" |
| `sleepAfter` | 10 minutes by default; the instance scales to zero |
| Shutdown | SIGTERM, then up to 15 minutes before SIGKILL — hence graceful shutdown in P8 |
| Disk | **ephemeral**; a fresh disk from the image on every start; no persistent volumes, no privileged mode |
| Network | outbound internet enabled by default |
| Architecture | `linux/amd64` only |
| Attach rule | a container can only be reached **through its Durable Object** |
| Image build | `wrangler deploy` builds and pushes when `image` points at a Dockerfile; Docker must be running (locally and in CI) |
| Included on Workers Paid | 25 GiB-hours memory, 375 vCPU-minutes, 200 GB-hours disk per month |
| Overage | memory $0.0000025/GiB-s · CPU $0.000020/vCPU-s · disk $0.00000007/GB-s |

Awake-hour arithmetic, since memory and disk bill on *provisioned* resources
while the instance is awake and CPU bills only on actual use:

| | `lite` | `basic` |
| --- | --- | --- |
| Billed per awake hour | 0.25 GiB-h + 2 GB-h | 1 GiB-h + 4 GB-h |
| Awake hours inside the allowance | **~100 h/month** | **~25 h/month** (memory binds) |
| Extra cost per awake hour | ~$0.0028 | ~$0.010 |
| A hobby month (~45-60 h awake, counting the 10-minute tail) | $0 | ~$0.35 |

Config keys (current shape): `containers[]` (`class_name`, `image`,
`instance_type`, `max_instances`, `scheduling_policy`, `build_context`),
`durable_objects.bindings`, and `exports.<Class>` with
`{ "type": "durable-object", "storage": "sqlite" }`. The older `migrations`
array still works; the two must not be configured together.

### Cloudflare Access (the test environment's gate)

- Zero Trust has a free plan with a small user count; a **one-time PIN** policy
  needs no identity provider.
- Access protects a hostname **including static assets**, even though the asset
  router does not pass identity (`ctx.access`) to the user Worker — this plan
  does not need that identity.
- **Service tokens** let a machine (the CI smoke check) through without a
  browser login.

### Workers static assets

- `assets.directory`, `assets.binding`, `assets.run_worker_first` (boolean or an
  array of paths; the array form is what keeps game pages free and fast).
- A `_headers` file in the asset directory **is** honoured — used for
  `X-Robots-Tag: noindex` on the test hostname. It does **not** apply to
  responses generated by Worker or container code, so the API sets that header
  itself when `NOINDEX=1`.
- Custom domains: `routes: [{ "pattern": "host", "custom_domain": true }]`, one
  hostname per Worker, and two Workers may own different subdomains of the same
  zone. A hostname that already has a CNAME record cannot be made a custom
  domain.

### Neon free tier (the database)

| Item | Value |
| --- | --- |
| Storage | 1 GB |
| Compute | 100 CU-hours/project/month |
| Idle behaviour | scales to zero after 5 minutes; a few hundred ms to wake |
| Consequence | no reliance on session state (prepared-statement caches, temp tables, `LISTEN/NOTIFY`) across suspends; sqlx reconnects cleanly |
| Backups | short restore window — hence the nightly `pg_dump` to R2 |

### Cloudflare R2 (backups)

Free tier includes 10 GB of storage with no egress fees; S3-compatible API, so
`aws s3 cp` in a scheduled workflow is enough.

### GitHub Actions pull-request deploys

- Repository and environment secrets **are** available to `pull_request` runs
  whose head branch is in this repository; fork PRs get no secrets and a
  read-only `GITHUB_TOKEN`, so the workflow guards on
  `github.event.pull_request.head.repo.full_name == github.repository`.
- A sticky PR comment is `gh pr comment --edit-last --create-if-none` with
  `pull-requests: write`.
- The test workflow must use its **own** `concurrency` group: sharing the
  production `cloudflare` group would cancel a production run that is waiting
  for approval.

---

## P7 Decision record: password accounts, no recovery, and argon2id on `lite`

### Why a password is now the right credential

The previous revision of this plan chose a 16-character "player code" for one
reason only: a properly expensive password hash does not fit in the free plan's
10 ms CPU budget, and making it fit would mean making it worthless. That reason
is gone. On Workers Paid there is no CPU ceiling worth designing around, so an
account becomes the thing a parent expects: a username and a password.

### Why there is no email and no recovery

The owner's adjustment removes the whole email chain — provider, sending
subdomain, SPF/DKIM records, verification and reset tokens, a second secret, and
the only piece of personal data the previous plan would have stored. What that
buys beyond simplicity: **there is no personal data in this system at all.**

What it costs is recovery. With no email address there is no verified channel
back into an account, and no security question, PIN or recovery code is offered
either — a 4-digit PIN is a decoration, not a protection, and a recovery code is
a second credential to lose. So: **a forgotten password loses the account and
its progress.** The plan mitigates the consequence rather than the cause:

- sessions last 12 months and roll forward on use, so a child on the same
  tablet signs in approximately never;
- the sign-up screen tells the user, in Norwegian, to write the password down;
- a signed-in user can change the password (requiring the current one), which
  is the only credential operation that exists.

A recovery code remains the obvious future addition (it is exactly the previous
plan's player code, re-used as a backup credential); it is deliberately out of
scope, and recorded in P17 as such.

### argon2id parameters, and why `lite` is affordable

| Setting | Value | Source |
| --- | --- | --- |
| Algorithm | argon2id, v19 | OWASP Password Storage Cheat Sheet |
| Memory `m` | 19456 KiB (19 MiB) | OWASP stated minimum |
| Iterations `t` | 2 | same |
| Parallelism `p` | 1 | same |
| Pepper | 32 random bytes, `Argon2::new_with_secret` | keeps a leaked dump from being crackable offline without the secret |
| Rehash | on successful sign-in when the stored parameters differ from the target | OWASP "upgrading the work factor" |

Lower-memory profiles (m = 9216/t = 4, m = 7168/t = 5) are *equivalents*: they
do roughly the same total work. They are therefore **not** a lever for a slow
instance, and going below the minimum is not a lever either. The only real lever
is the instance size, and the arithmetic says the small one is fine:

- Billed CPU-ms per hash is the same on either instance (~40-60 ms of work).
  What changes is wall time, because a 1/16-vCPU share stretches that work:
  expect roughly **0.5-1.5 s on `lite`** and 0.15-0.4 s on `basic`.
- That time is paid once per device, by an adult or a child entering a password
  on a sign-in screen. **No game ever waits on it.**
- C8 therefore logs the real hash time on the real instance and treats it as an
  acceptance criterion: if a hash exceeds ~1.5 s, `instance_type` becomes
  `basic` — one line in `wrangler.jsonc`, no code change, ~$0.35/month at hobby
  usage.

Rate limiting (P9) is what keeps the hash from becoming a denial-of-service
lever: a per-IP and per-username failure counter with backoff, checked *before*
the hash is computed.

---

## P8 Architecture

```
browser
  │
  ├─ GET /  and  /games/<slug>/     → Cloudflare asset router → dist/
  │                                   (no Worker code, no container, no CPU)
  │
  └─ fetch('/api/…', {credentials:'include'})
        │
        ▼
   learn-and-play  (Worker front door, edge/src/index.js)
        │  run_worker_first: ["/api/*"]
        ▼
   Durable Object  (edge/src/container.js — the only way to reach a container)
        │  starts it if asleep (1-3 s), then proxies HTTP
        ▼
   Rust service  (api/ — axum on :8080)
        │  sqlx
        ▼
   Neon Postgres
```

Properties that make this safe:

- **Same origin.** The API lives on the same hostname as the games, so there is
  no CORS, no `SameSite=None`, and no cross-origin cookie problem.
- **A backend failure cannot break a game.** Game pages are assets; they never
  touch the container.
- **Only the API pays cold starts.** The first `/api/*` request after ten idle
  minutes waits; a game page never does.

### Target file layout

```
api/                                  NEW — the Rust service (runs in the container)
  Cargo.toml, Cargo.lock              pin dependencies; `--locked` everywhere
  rust-toolchain.toml                 the channel CI and this machine agree on
  Dockerfile                          cargo-chef multi-stage → distroless, nonroot
  .dockerignore
  migrations/0001_init.sql            P10's schema
  src/main.rs                         args (`serve` | `migrate`), tracing, shutdown
  src/lib.rs                          the router builder, so tests can use it
  src/{config,app,state,error}.rs
  src/domain/{password,session,username,rate_limit}.rs   pure logic, unit tests
  src/store/{users,sessions,progress,attempts}.rs        sqlx queries only
  src/routes/{health,accounts,sessions,password,progress}.rs
  tests/{health,accounts,progress}.rs  `#[sqlx::test]` integration tests
edge/                                 NEW — the Worker front door
  src/index.js                        assets + `/api/*` → the container
  src/container.js                    the Durable Object that owns the container
  test/front-door.test.js             routing test with a stubbed binding
wrangler.jsonc                        production config (unchanged until C13)
wrangler.test.jsonc                   the test Worker: own name, database, route
docker-compose.yml                    Postgres 17 for local dev and tests
sync-keys.json                        the single source of truth for synced keys
src/shared/api.js                     fetch wrapper (never throws on failure)
src/shared/account.js                 useAccount()
src/shared/syncable.js                the merge registry
src/shared/sync.js                    pull, debounce, push, ownership
src/shared/SyncGate.jsx               the hydration gate the game pages mount
src/account/{main.jsx,AccountPage.jsx,style.css}
account/index.html                    the account page entry point
.github/workflows/deploy-test.yml     pull requests → the test environment
.github/workflows/backup.yml          nightly pg_dump → R2
```

### `wrangler.test.jsonc` (the test Worker, written in C5)

```jsonc
{
  "name": "learn-and-play-test",            // a separate Worker, not a Wrangler env:
  "main": "edge/src/index.js",              // container config inside `env.*` is
  "compatibility_date": "…",                // not documented, a second file is explicit
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"]
  },
  "containers": [
    { "class_name": "ApiContainer", "image": "./api/Dockerfile",
      "instance_type": "lite", "max_instances": 1 }
  ],
  "durable_objects": { "bindings": [{ "name": "API_CONTAINER", "class_name": "ApiContainer" }] },
  "exports": { "ApiContainer": { "type": "durable-object", "storage": "sqlite" } },
  "routes": [{ "pattern": "test.play2learn.divanchyshyn.com", "custom_domain": true }],
  "vars": { "PUBLIC_ORIGIN": "https://test.play2learn.divanchyshyn.com", "NOINDEX": "1" }
}
```

`wrangler.jsonc` gets the same shape in C13, keeping `"name": "learn-and-play"`
so the custom domain and the approval gate survive untouched.

### The Rust entry point

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;          // missing DATABASE_URL is allowed
    match config.command {
        Command::Migrate => run_migrations(&config).await,
        Command::Serve   => serve(config).await,   // binds 0.0.0.0:$PORT, SIGTERM-aware
    }
}
```

`serve` builds the router in `lib.rs` (`build_app(state)`), so every integration
test drives the real router through `tower::ServiceExt::oneshot` instead of
starting a server.

---

## P9 Accounts, credentials and sessions

### The credential pair

| Property | Value |
| --- | --- |
| Username | 3-20 characters, must start with a letter, then letters, digits, `-` or `_`; stored as typed, unique on `lower(username)` |
| Reserved usernames | a short list (`admin`, `administrator`, `root`, `system`, `support`, `test`) rejected at sign-up |
| Password | 8-128 bytes. No composition rules, no Unicode normalisation (OWASP: do not reduce input space), a byte cap so a huge body cannot become CPU |
| Stored | `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`, peppered (P7) |
| Shown | never; not even to the account itself |

### Sessions

| Property | Choice | Why |
| --- | --- | --- |
| Token | 256 bits from the OS CSPRNG, base64url | unguessable |
| Stored | `sha256(token)` as `bytea` | a database dump yields no usable cookies |
| Cookie | `__Host-lap_sid` — `HttpOnly; Secure; SameSite=Lax; Path=/`, no `Domain` | the `__Host-` prefix forces Secure, Path=/ and no Domain; browsers accept Secure cookies on `localhost` and on the test hostname over HTTPS |
| Lifetime | 12 months, rolling (`last_seen_at` refreshed on use) | a child should not be asked to sign in again (D8 makes this matter) |
| Why `Lax` and not `Strict` | top-level navigation from an external link still carries the session, so a signed-in child arriving from a bookmark or a chat message is not shown as signed out; state-changing requests are additionally protected by an `Origin` check | `Strict` would make that first page load look signed out |
| Revocation | deleting the row | "sign out everywhere" is `DELETE FROM sessions WHERE user_id = …`, which is also what a password change does (keeping the current session) |

### Threat notes

- **Enumeration.** Sign-in returns one uniform body, status and timing for a
  wrong username and a wrong password (a dummy hash runs on a miss when the
  account is unknown, so both paths cost the same). Sign-up is *not*
  enumeration-protected on purpose: with usernames and no email, "that username
  is taken" reveals nothing about a person, and a child typing a name their
  sibling already uses deserves to be told.
- **Rate limiting.** `auth_attempts` holds per-IP and per-username counters
  (`ip:<addr>` / `user:<name>`): failures inside a 15-minute window, then a
  429 with a backoff window. Counters are checked **before** argon2 runs, which
  is what stops the hash from being a denial-of-service lever. The IP comes from
  `X-Client-IP`, which the front door sets from `CF-Connecting-IP` after
  deleting any client-supplied value; `X-Forwarded-For` is never trusted.
- **CSRF.** `SameSite=Lax` plus an `Origin` check against `PUBLIC_ORIGIN` on
  every POST/PUT/DELETE.
- **Response caching.** `Cache-Control: no-store` on every account response.
- **Container cold start.** A sign-in on a sleeping instance costs 1-3 s (start)
  plus the hash. The account page shows its own "logger inn …" state, which is
  honest and is not a game.

---

## P10 Data model and HTTP API

### Schema (`api/migrations/0001_init.sql`)

```sql
-- One row per account. Deliberately holds no personal data at all: no email,
-- no name, no birthday, no analytics id.
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  username      text NOT NULL,
  password_hash text NOT NULL,          -- argon2id PHC string, peppered
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_key ON users (lower(username));

CREATE TABLE sessions (
  token_hash   bytea PRIMARY KEY,       -- sha256 of the cookie value, never the value
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_key ON sessions (user_id);

-- Progress is stored as opaque per-record blobs keyed by the storage key the
-- games already use. `payload` is exactly what the game's own codec produces.
CREATE TABLE progress (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_key text NOT NULL,             -- e.g. 'soundLabyrinth:gallery'
  payload    text NOT NULL,
  revision   bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, record_key)
);

-- Written only on a failed sign-in; counters, never a lockout that a user
-- cannot escape.
CREATE TABLE auth_attempts (
  key           text PRIMARY KEY,       -- 'ip:<addr>' | 'user:<lowercase>'
  window_start  timestamptz NOT NULL DEFAULT now(),
  failures      integer NOT NULL DEFAULT 0,
  blocked_until timestamptz
);
```

Notes: `ON DELETE CASCADE` is what makes "delete my account" real — one `DELETE`
from `users` takes the sessions, the progress rows and the attempt counters with
it, and that is verified by a test. `PRIMARY KEY (user_id, record_key)` gives
the upsert its conflict target and makes a user's records one indexed read.

### HTTP API

| Method | Path | Body | Returns | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{ ok, db }` | no auth; `db` is `up`, `down` or `unconfigured`; the M0 acceptance test |
| `POST` | `/api/account` | `{ username, password }` | `201 { username }` + session cookie | `409` when the username is taken, `400` when it is invalid |
| `POST` | `/api/session` | `{ username, password }` | `200 { username }` + cookie | uniform `401` on any failure; 429 when throttled |
| `DELETE` | `/api/session` | — | `204` | deletes this session row, clears the cookie |
| `GET` | `/api/me` | — | `{ signedIn, username? }` | never returns a hash |
| `POST` | `/api/password` | `{ currentPassword, newPassword }` | `204` | requires the current password; deletes every *other* session |
| `DELETE` | `/api/account` | `{ password }` | `204` | cascade deletes everything that user owns |
| `GET` | `/api/progress` | — | `{ records: [{ key, payload, revision }] }` | all records in one response: there are three and they are tiny |
| `PUT` | `/api/progress` | `{ records: [{ key, payload, baseRevision }] }` | `{ accepted: [...], conflicts: [...] }` | per-record revision gate (P11) |

Rules the service enforces:

- A session cookie is required on everything except `/api/health`,
  `POST /api/account` and `POST /api/session`.
- `record_key` must be in the allowlist, which is read from `sync-keys.json`
  with `include_str!` so the JavaScript registry and the Rust allowlist can
  never drift apart.
- `payload` has a hard 64 KB cap (every real payload is under 1 KB).
- `PUT` and every state-changing route check `Origin` against `PUBLIC_ORIGIN`.
- The server **never parses a payload**. Validating it is the client's job,
  using the codecs that already exist — which is why a corrupt server value
  cannot break a game.

---

## P11 Progress: what syncs, how it merges, how it never breaks a game

### The governing principle

**Postgres is the record; `localStorage` is a cache.** On a device that is
signed in and has a warm cache, a game starts instantly from local data and the
database is reconciled in the background. On a device with nothing cached —
first visit, cleared storage, a different account — the game waits briefly for
the database (1.5 s at most), and if that fails it plays from cache anyway.

The promise `persistence.js` already makes — *"a full or locked store is not the
child's problem"* — is extended to the network: **a child must never see a
dialog, a toast or an error because a server disagreed.** That is a hard
requirement with a test.

### What syncs, and what must never sync

| Storage key | Syncs? | Why |
| --- | --- | --- |
| `soundLabyrinth:gallery` | ✅ | durable: which pictures have been assembled |
| `wordFishing:journal` | ✅ | durable: words caught, trips finished, decorations unlocked |
| `cardBattle:album` | ✅ | durable: animals found |
| `soundLabyrinth:progress` | ❌ | the picture being assembled *right now* |
| `soundLabyrinth:game` | ❌ | the maze being walked *right now* |
| `wordFishing:trip` | ❌ | the trip in progress |
| every `<game>:muted` | ❌ | a child may reasonably mute the tablet and not the laptop |

In-progress sessions must not sync because they are *a moment*, not progress: a
stale `wordFishing:trip` copied from another device drops the child onto a boat
with the wrong crates. Losing a session costs one trip's sorting; corrupting one
costs trust in the game.

### Merge rules, per key

Every synced record is merged by a **pure function**, unit-tested without a
network, a database or a browser. All three underlying values are **monotonic** —
a word caught cannot be un-caught — so a union can never lose progress.

| Key | Merge |
| --- | --- |
| `wordFishing:journal` | `words` = order-preserving union; `decorations` = order-preserving union; `trips` = max |
| `cardBattle:album` | `discovered` = order-preserving union |
| `soundLabyrinth:gallery` | `seen` = order-preserving union, then `round` is **rebuilt** by replaying `recordSeenImage` from `puzzle.js` |

The gallery replay is the real rule the game uses, not an approximation of it,
so a merged gallery behaves exactly like one the child built locally.

### Revisions (no device clocks)

1. The client remembers, per key, the revision it last saw
   (`localStorage['sync:revision:<key>']`).
2. On load (if signed in) it calls `GET /api/progress`. For each record whose
   revision is newer than the one it remembers, it merges and writes the merged
   value back to `localStorage`.
3. On a storage write it debounces (~2 s idle) and calls `PUT /api/progress`
   with each record's `baseRevision` set to the revision it last saw.
4. The server writes only when its stored revision equals `baseRevision` (or the
   row is absent and `baseRevision` is 0), then bumps it. Otherwise the row comes
   back as a conflict; the client merges again and retries once.

Server-stamped revisions rather than timestamps, because device clocks are wrong,
timezones are wrong, and a tablet with a flat battery can jump years. Ordering is
decided by one authority instead of by comparing two machines' opinions.

### Ownership: whose progress is in this browser?

Local state carries `sync:owner` — an account id, `anonymous` (never signed in)
or `detached` (was signed in, now signed out). The rules, each with a test:

| Situation | Behaviour |
| --- | --- |
| Sign in, owner is the same account | normal pull / merge / push |
| Sign in (or sign up) on an `anonymous` device | **upload local records first** (as `baseRevision` 0), then pull and merge. A child who played for weeks and then creates an account is never wiped |
| Sign in as a *different* account on a `detached` device | **clear the cached synced records, then pull.** One child's progress can never be uploaded into another's account |
| Sign out | keep the cache so play continues; owner becomes `detached`; stop syncing |
| Delete the account | delete the local synced records too |

### The hydration gate

`src/shared/SyncGate.jsx` wraps the game component in each of the six
`src/games/<slug>/main.jsx` files; game components and `games/*/index.html` are
untouched. It waits for the pull **only** when this device has nothing cached
for the signed-in account, with a 1.5 s ceiling, and renders a small Norwegian
loading line while it waits. The library page starts the pull as soon as it
loads, so by the time a child opens a game the cache is almost always already
warm and the gate resolves synchronously.

### Failure behaviour (pinned by tests)

| Situation | Behaviour |
| --- | --- |
| Not signed in | the sync module does nothing at all; no requests are made |
| Network error or non-2xx | swallowed; retried on the next change or the next page load |
| The server returns junk for a record | the game's own `codec.parse` rejects it and the game falls back to `initial()` |
| Storage unavailable | unchanged from today: the game plays and forgets on reload |
| Backend entirely down | games work exactly as they do today; only account screens show a message |

---

## P12 Frontend integration

**No game component changes.** Everything lands in `src/shared/`, `src/account/`,
the six page entry points and the library page.

| File | Responsibility |
| --- | --- |
| `src/shared/api.js` | one `request()` wrapper: same-origin base, `credentials: 'include'`, JSON in/out, `AbortController` timeout, and **never throws** on a network failure (returns a failure result) |
| `src/shared/account.js` | `useAccount()` — `{ signedIn, username, signUp, signIn, signOut, changePassword, deleteAccount }` |
| `src/shared/syncable.js` | the registry: `{ key, merge }` per synced key, built on the games' existing codecs |
| `src/shared/sync.js` | `startSync()`, `pull()`, debounced `push()`, ownership, revisions, and the "has this device got a cache" decision the gate asks |
| `src/shared/SyncGate.jsx` | the hydration gate |
| `src/shared/persistence.js` | **+ an optional fire-and-forget write observer**, wrapped in `try/catch` so a listener can never break a save |
| `src/account/AccountPage.jsx` | sign in, sign up, change password, delete account, signed-in view |
| `src/home/main.jsx` | a "Konto" link (and the early pull), nothing else |

Norwegian copy for the account page, for example:

- Heading *"Konto"*; actions *"Logg inn"*, *"Lag konto"*, *"Logg ut"*.
- Sign-up warning, stated honestly: *"Skriv ned passordet og ta godt vare på
  det. Vi kan ikke gjenopprette det hvis du glemmer det."*
- Signed in: *"Du er logget inn som {username}. Framgangen din lagres og følger
  deg til andre enheter."*
- Errors are calm and never accusatory: *"Fant ingen konto med det
  brukernavnet."* / *"Passordet stemmer ikke."* / *"Brukernavnet er opptatt."* /
  *"Passordet må ha minst 8 tegn."*
- The delete-account confirmation spells out what disappears: the account, its
  saved progress, and the sign-in on every device.

All identifiers English, all child-facing text Norwegian — the rule in
`AGENTS.md`.

---

## P13 Testing strategy

### Rust (`cargo test`)

- `domain/` — pure logic, no database, no server: username validation and
  normalisation, reserved names, password length rules, argon2 hash/verify and
  rehash detection, session-token minting and hashing, rate-limit window and
  backoff arithmetic.
- `tests/` — `#[sqlx::test]` integration tests that drive the **real router**
  through `tower::ServiceExt::oneshot` against a throwaway database per test
  (created by sqlx against a local Postgres in Docker, and by a GitHub Actions
  service container in CI): sign-up → cookie → `/api/me` → sign out; a wrong
  password indistinguishable from an unknown username; throttling after N
  failures; password change keeping one session and deleting the rest;
  delete-account leaving zero rows; the progress revision gate, size cap and
  key allowlist.
- `tests/health.rs` — the router answers `/api/health` without a database.

### Vitest (the existing suite, extended)

| Area | Tests |
| --- | --- |
| `syncable.test.js` | every merge rule as a table: unions preserve order, `trips` takes the max, the gallery replay produces the expected `round` |
| `sync.test.js` | mocked `fetch`: signed out makes no requests; a newer remote revision merges and writes back; an older one does not clobber; a stale push is reconciled; the ownership table above; **a network failure leaves local state untouched and throws nothing** |
| `account.test.js` / `api.test.js` | request shapes, cookie-dependent behaviour mocked, sign-out clears local hints |
| `AccountPage.test.jsx` | rendered happy paths: sign up → signed-in view → sign out; the "write your password down" warning; calm error rendering |
| `SyncGate.test.jsx` | warms from cache instantly when the device has data; waits (and then gives up at the ceiling) when it does not; renders the game either way |
| `persistence.test.js` (extend) | an observer that throws does not break `writeStorage` |
| `edge/test/front-door.test.js` | `/api/*` reaches the container binding, everything else falls through to assets, the client-supplied IP header is replaced |
| existing game tests | **must not change** — proof that no game was touched |

### The rules this repo already imposes, which these tests must respect

- Pin `Math.random` with `vi.spyOn` and use fake timers for the debounce.
- Restore shared mute state in `afterEach`; read a default the way a page load
  does (`vi.resetModules()` + fresh import).
- The suite-wide `testTimeout: 20000` is enough; do not add private ceilings.
- Cookie behaviour cannot be observed in jsdom (`HttpOnly` is not implemented),
  so test the client's request shape and the server's response handling with a
  mocked `fetch` instead of reading `document.cookie`.

### Coverage

`vite.config.js` includes `src/**/*.{js,jsx}`, so every new shared module and
the account page appear in the report the moment they exist. `docs/audit/
BASELINE.md` is re-established in C2 (the file referenced today does not exist),
and the numbers must not fall below it.

---

## P14 CI, the test environment, and the production cutover

### `ci.yml` (and the `verify` job of the production workflow)

Rust steps run **before** the npm steps so a Rust failure fails fast:

```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    components: rustfmt, clippy
- uses: Swatinem/rust-cache@v2
  with:
    workspaces: api
- run: cargo fmt --manifest-path api/Cargo.toml --all --check
- run: cargo clippy --manifest-path api/Cargo.toml --all-targets -- -D warnings
- run: cargo test --manifest-path api/Cargo.toml      # with a postgres service
- run: docker build -t learn-and-play-api:ci api
```

`docker build` is in the list because the image is what actually ships and the
Dockerfile is the one file `cargo test` cannot check.

### The test environment (`.github/workflows/deploy-test.yml`)

- **Trigger:** `pull_request` (`opened`, `synchronize`, `reopened`) plus
  `workflow_dispatch` as a manual escape hatch.
- **Guards:** head branch must be in this repository (fork PRs never see
  secrets), and `dependabot/**` branches are skipped so a dependency bump does
  not steal the shared test slot.
- **Concurrency:** its own `deploy-test` group — never the production
  `cloudflare` group, whose `cancel-in-progress` would kill a production run
  waiting for approval.
- **Steps:** checkout → node → `npm ci` → lint/test/build → rust toolchain and
  cache → fmt/clippy/test → write `dist/_headers` with
  `X-Robots-Tag: noindex` → migrations against the test database →
  `wrangler deploy --config wrangler.test.jsonc` → smoke check `/api/health`
  through the Access service token → a sticky comment with the URL, the commit
  SHA and the smoke result.
- **One shared slot:** the most recent PR to deploy owns the URL; the comment
  says which commit is live. Per-branch isolation (Cloudflare Previews) exists
  but its container support is documented as partial, so it is deliberately not
  used here; it is recorded as a future option in P17.
- **Protection:** Cloudflare Access with a one-time-PIN policy for the owner's
  address (and a service token for CI). Access protects the assets too, so the
  whole test site is private, which is also why no robots policy is critical —
  the `_headers` file is belt and braces.

### Production cutover (C13)

`wrangler.jsonc` gains `main`, the assets binding, `run_worker_first`, the
container, the Durable Object and the production `vars`, keeping the Worker name
`learn-and-play` so the custom domain and the `cloudflare-production` required
reviewers are untouched. The deploy job gains the Rust toolchain, the migration
step, and `wrangler deploy`. A failed migration fails the job, so the site can
never run new code against an old schema.

**Nothing production changes before C13.** The branch is developed and verified
on the test environment, and the production deploy is simply not approved until
the cutover commit is on `main`.

### Backup (C12)

`.github/workflows/backup.yml` runs nightly (`postgres:17` client image →
`pg_dump` → gzip → `aws s3 cp` to R2), because Neon's free tier restore window is
short. The RUNBOOK carries the restore procedure, and a manual run is an
acceptance criterion for C12.

### GitHub Pages (C14)

Delete `deploy-pages.yml` **and** set Settings → Pages → Source to *None*.
Deleting only the workflow leaves the last deployment serving, which would be a
silent lie in the docs.

---

## P15 Work packages C1 – C15 (one commit each)

Each package is one commit, in order, and each one ends green. "Green" means
`npm run lint`, `npm run test`, `npm run build` and, from C4 on,
`cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`
and `docker build`.

| # | Commit | What lands |
| --- | --- | --- |
| **C1** | `docs(backend): revise the plan for paid Workers, containers and username accounts` | This document, the rewritten `RUNBOOK.md`, the amended static-only rule in `AGENTS.md`, the "no longer static" correction in `.opencode/agents/review.md`, and the README's "planned" section |
| **C2** | `docs(audit): re-establish the coverage baseline` | `docs/audit/BASELINE.md` measured with `npm run test:coverage` |
| **C3** | `feat(api): axum service skeleton with a health endpoint` | `api/` lib + bin, `/api/health`, env config, tracing, SIGTERM shutdown, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.gitignore` additions |
| **C4** | `ci: check the Rust service and build the container image` | The Rust job in `ci.yml`, cargo and docker entries in `dependabot.yml`, the `cargo` allowlist in `opencode.json`, and the docs that describe them (`AGENTS.md`, `docs/agent-pipeline.md`, `.opencode/agents/review.md`) |
| **C5** | `feat(edge): Worker front door that routes /api/* into the container` | `edge/`, `wrangler.test.jsonc`, the pinned `wrangler` and `@cloudflare/containers` devDependencies, the ESLint Worker-globals block, the front-door test. Production config untouched |
| **C6** | `ci(deploy): publish every pull request to the test environment` | `deploy-test.yml` with its guards, concurrency group, noindex `_headers`, smoke check and sticky comment |
| **C7** | `feat(api): Postgres schema, migrations and a migrate subcommand` | `0001_init.sql`, the sqlx pool, `api migrate`, `db` in `/api/health`, `#[sqlx::test]` support and the CI Postgres service |
| **C8** | `feat(api): accounts — sign up, sign in, sessions, password change, delete` | argon2id + pepper, session mint/verify, the cookie, five account endpoints, rate limiting, `X-Client-IP` handling, and the measured hash time |
| **C9** | `feat(api): progress records with a revision gate` | `GET`/`PUT /api/progress`, the `sync-keys.json` allowlist, size caps, revisions and conflicts |
| **C10** | `feat(web): account page` | `account/index.html` + Vite entry, `src/account/*`, `src/shared/api.js`, `src/shared/account.js`, the library link, the README privacy note |
| **C11** | `feat(web): progress sync with a local cache` | `sync-keys.json`, `syncable.js`, `sync.js`, the persistence observer, `SyncGate.jsx`, the six entry-point wrappers, the early pull on the library page |
| **C12** | `ci(backup): nightly pg_dump to R2` | `backup.yml`, the restore procedure in the RUNBOOK, the R2 setup steps |
| **C13** | `feat(deploy): move production to the front door, container and Postgres` | `wrangler.jsonc` and `deploy-cloudflare.yml` in full, the README hosting section |
| **C14** | `chore: retire GitHub Pages` | `deploy-pages.yml` deleted, and every document that mentions Pages updated |
| **C15** | `docs: record the backend as built` | PLAN status → built, the RUNBOOK's as-built commands, the README's account and privacy sections, the final `AGENTS.md` pass, a re-measured coverage baseline |

P18 lists the checkpoints a human must complete along the way; they are the only
steps that cannot be done from the repository.

---

## P16 Milestones

| Milestone | Content | What it proves | Risk to the live site |
| --- | --- | --- | --- |
| **M0** | C3 – C6: skeleton, CI, front door, test deployment | The container, the image build, the Durable Object proxy and the PR-to-test-env pipeline all work | none (production config untouched) |
| **M1** | C7: schema and migrations | A real database, reachable from the container, migrated by CI | none |
| **M2** | C8: accounts round trip | Passwords, sessions, cookies through the Durable Object, and the real argon2 cost on `lite` | none |
| **M3** | C9 – C11: progress API and the frontend | Cross-device progress with a cache, and the fail-open guarantee under a blocked network | low |
| **M4** | C12 – C15: backups, cutover, Pages retirement, docs | The change is finished by this repo's own definition of done | the cutover itself, mitigated by the unchanged approval gate and a one-command rollback |

---

## P17 Risks, failure modes and rollback

| # | Risk | Likelihood | Mitigation |
| --- | --- | --- | --- |
| R1 | Container cold start (1-3 s) after ten idle minutes | certain, harmless | Only `/api/*` waits; games are assets; the gate waits only on a device with no cache, and only 1.5 s |
| R2 | argon2id is slow on the `lite` share | medium | C8 measures the real hash time on the real instance and switches `instance_type` to `basic` if it exceeds ~1.5 s. Lowering the work factor is not the lever |
| R3 | Neon's free tier (1 GB, scale-to-zero, short restore window) | medium | Tiny data, a measured wake-up in C8, a nightly dump to R2 (C12) and a documented restore |
| R4 | `Set-Cookie` through the Durable Object is not documented by Cloudflare | low, but unverified | It is the first acceptance check of C8; the fallback is copying `Set-Cookie` explicitly in the front door |
| R5 | A sync bug loses a child's progress | medium — the worst outcome here | Union-only merges over monotonic data, the ownership table, revision conflicts, upload-before-download on first sign-in, and a test for each |
| R6 | The container image build slows every deploy | medium | cargo-chef layering and the GitHub Actions layer cache; a 3-6 minute PR deploy is accepted |
| R7 | Two environments, two databases, two secret sets | medium | Explicit RUNBOOK checklists, a documented "reset the test database" command, and everything proven on the test env first |
| R8 | Cost creep | low | `max_instances: 1`, `sleepAfter: 10m`, and P6's awake-hour arithmetic showing `lite` inside the included allowance for hobby use |
| R9 | A forgotten password loses an account | certain eventually | Accepted by design (D7): long-lived sessions, an honest warning at sign-up, and a recovery code recorded here as the obvious future addition |
| R10 | Fork or bot pull requests reaching the test environment | low | The same-repo guard, the dependabot skip, Cloudflare Access, and a rule-limited sign-up path |
| R11 | GitHub Pages keeps serving after its workflow is deleted | certain if forgotten | C14's dashboard step, with the reason written into the RUNBOOK and the README |
| R12 | Cloudflare renames a config key (containers moved from `migrations` to `exports` once already) | medium | The config is read from the current docs when C5 lands; the RUNBOOK says to re-check before copying |

### Rollback

| Situation | Action |
| --- | --- |
| The backend misbehaves after cutover | `npx wrangler rollback --name learn-and-play` (restores the previous version, assets included), or revert C13 and approve the deploy |
| The backend should be removed entirely | revert C13; the site returns to exactly today's static deploy, and the games never depended on the API. Export the database first if it holds anything worth keeping |
| A migration was wrong | restore from the nightly dump (or Neon's own restore) and fix forward with a **new** migration; never edit an applied one |
| The account feature is unwanted | the frontend modules are additive; deleting the "Konto" link and the account page hides it without touching any game |
| The test environment is noisy or expensive | delete the `learn-and-play-test` Worker and its custom domain in the dashboard; production is unaffected |

**The most important rollback property:** because `run_worker_first` scopes code
to `/api/*`, a total backend failure degrades to *"accounts do not work"* and
never to *"the games do not load"*.

### Deliberately out of scope

A recovery code (the previous plan's player code, re-used as a backup
credential); per-child profiles under one parent account; Cloudflare Previews
for per-PR URLs instead of one shared test slot; Cloudflare Turnstile on
sign-up; an admin view; email of any kind.

---

## P18 Human checkpoints

Everything else in this plan can be done from the repository. These cannot.

| # | Needed by | What |
| --- | --- | --- |
| H1 | C3 | Start Docker Desktop (installed; the daemon is not running). Needed for `docker build`, the dev Postgres and `wrangler dev` |
| H2 | C6 | Cloudflare: confirm Workers Paid; widen or replace `CLOUDFLARE_API_TOKEN` for Workers Scripts and Containers; create a `cloudflare-test` GitHub environment (no reviewers) holding `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` |
| H3 | C6 | Neon: create the project and two databases (`learn_and_play`, `learn_and_play_test`); keep both connection strings (with `sslmode=require`) |
| H4 | C6 | Zero Trust: create the Access application for `test.play2learn.divanchyshyn.com` with a one-time-PIN policy for your address, and a service token for the CI smoke check |
| H5 | C6 | Confirm `test.play2learn.divanchyshyn.com` has no existing CNAME (a hostname with one cannot become a custom domain) |
| H6 | C8 | Set the test Worker's secrets: `DATABASE_URL`, `PEPPER` (`wrangler secret put --config wrangler.test.jsonc`) |
| H7 | C12 | Create the R2 bucket, a lifecycle rule, and the S3 credentials the backup workflow uses |
| H8 | C13 | Add the Rust job to the required status checks in branch protection |
| H9 | C13 | Create the production database, set the production Worker's secrets, then approve the one production deploy |
| H10 | C14 | Settings → Pages → Source: None |

---

## P19 Rust primer for this project

Written for someone who has not written Rust. Everything here is what *this*
codebase will actually use — nothing more.

### The vocabulary

| Term | Meaning |
| --- | --- |
| **crate** | A compilation unit / library: `axum`, `sqlx`, `argon2`, and this project's own `api` crate |
| **package** | A directory with a `Cargo.toml` |
| **`cargo`** | The build tool *and* the package manager (like `npm`): `cargo build`, `cargo test`, `cargo fmt`, `cargo clippy` |
| **target** | What you compile *for*. This project compiles for the host machine (`cargo test`, Linux in the container) — no WASM target needed |
| **`Result<T, E>`** | Either success `Ok(T)` or failure `Err(E)`; `anyhow::Result` in `main`, `sqlx::Error`/`ApiError` inside |
| **`?`** | "If this failed, return the error now." Removes most error-handling noise |
| **`Option<T>`** | A value that may be absent: `Some(x)` or `None` |
| **`String` vs `&str`** | Owned text vs. a borrowed view of text |
| **`struct` / `enum` / `match`** | Data types and Rust's exhaustive switch — the natural way to write the `Command::Serve | Command::Migrate` choice in `main.rs` |
| **`serde`** | Derive macros that turn structs into JSON and back: `#[derive(Serialize, Deserialize)]` |
| **`#[tokio::main]`** | Turns `async fn main` into a normal `main` running on the async runtime |
| **`#[sqlx::test]`** | A test that gets a fresh throwaway database, runs `migrations/`, and hands the test a pool |
| **`#[cfg(test)] mod tests`** | A test module in the same file: `#[test] fn name() { assert_eq!(…) }` |
| **derive / traits** | Reusable behaviour (`Clone`, `Debug`, `Serialize`). You will write `#[derive(…)]` and rarely write a trait yourself |

**You will not need:** `unsafe`, manual memory management, explicit lifetimes,
macros you write yourself, or WASM.

### The one surprise if you come from JavaScript

Ownership: a value has exactly one owner, and passing it *moves* it. In practice
the compiler tells you exactly where, the message is unusually good, and the fix
is usually `&` (borrow) or `.clone()`. Expect the first week to be a fight with
`cargo build`, and the second week to be faster than you were in JS.

### Your actual first three Rust files

1. `api/src/routes/health.rs` — a handler returning `{ "ok": true }`, plus the
   router in `lib.rs` that mounts it. This is M0: it touches no database.
2. `api/src/domain/username.rs` — validate and normalise a typed-in username.
   Pure functions in, pure functions out. `cargo test` it.
3. `api/src/domain/password.rs` — hash and verify with argon2id, and detect when
   a stored hash needs upgrading.

That order means **your first Rust is fully unit-tested before it ever runs in
the cloud**.

### The loop you will actually work in

```powershell
cd api
cargo test            # milliseconds for the pure logic, seconds with a database
cargo check           # fast compile check
cargo clippy --all-targets -- -D warnings
cargo fmt
```

Use `docker compose up -d db` for the local database, and `wrangler dev` only
when you need to exercise the HTTP path through the Durable Object.

### Learning resources

- *The Rust Programming Language* — <https://doc.rust-lang.org/book/> (chapters
  1-10 cover everything above)
- *Rustlings*, small exercises to build the reflexes —
  <https://github.com/rust-lang/rustlings>
- `axum` examples — <https://github.com/tokio-rs/axum/tree/main/examples>
- `sqlx` — <https://docs.rs/sqlx> and its `migrate!` macro
- *Zero to Production in Rust* (Luca Palmieri) — the book this architecture
  resembles, without the parts this project does not need

---

## P20 Glossary and references

| Term | Meaning in this project |
| --- | --- |
| **assets** | The static files in `dist/` (the games), served by Cloudflare's asset router |
| **binding** | Something a *Worker* can use (`ASSETS`, a D1 database, a KV namespace). Containers have no bindings |
| **container** | A Firecracker microVM running this project's Docker image, reachable only through its Durable Object |
| **Durable Object** | A single-threaded, stateful Worker class; here it exists to own and proxy the container |
| **front door** | This project's Worker (`edge/`): serves assets and forwards `/api/*` to the container |
| **fail-open** | If the backend misbehaves, play continues unaffected |
| **migration** | A numbered SQL file that changes the schema, applied in order |
| **PHC string** | The `$argon2id$v=19$m=…$salt$hash` text form argon2 hashes are stored in |
| **revision** | The server-assigned per-record counter that decides which progress write wins |
| **run_worker_first** | The config that decides which paths invoke code instead of being served as assets |
| **session** | A signed-in browser: a row in `sessions` plus an `HttpOnly` cookie |
| **SyncGate** | The component that briefly waits for the database before a game mounts, and gives up after 1.5 s |

**References — worth re-reading before changing a decision:**

- Workers limits and pricing —
  <https://developers.cloudflare.com/workers/platform/limits/>,
  <https://developers.cloudflare.com/workers/platform/pricing/>
- Containers: configuration, images, limits, pricing —
  <https://developers.cloudflare.com/containers/configuration/wrangler/>,
  <https://developers.cloudflare.com/containers/guides/image-management/>,
  <https://developers.cloudflare.com/containers/platform/limits/>,
  <https://developers.cloudflare.com/containers/platform/pricing/>
- Static asset routing and headers —
  <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>,
  <https://developers.cloudflare.com/workers/static-assets/headers/>
- Custom domains — <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
- Cloudflare Access for Workers — <https://developers.cloudflare.com/workers/configuration/cloudflare-access/>
- Neon free tier and compute lifecycle — <https://neon.com/pricing>,
  <https://neon.com/docs/introduction/compute-lifecycle>
- OWASP Password Storage Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- OWASP Session Management Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- GitHub Actions secrets and pull requests —
  <https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets>

## P21 Revision log

| Date | Change |
| --- | --- |
| 2026-10-01 | Initial plan written from a design session: Rust Worker (WASM) + D1 on the Workers Free plan, player-code credential, `localStorage` as the source of truth, GitHub Pages kept. Nothing implemented. |
| 2026-10-02 | Rewritten after Workers Paid: Rust axum **container** fronted by a Worker, Postgres on Neon, username + password accounts with **no email and no recovery**, database as the record with `localStorage` as a cache, a pull-request test environment on `test.play2learn.divanchyshyn.com` behind Cloudflare Access, and GitHub Pages retired. Work packages restated as one commit each (C1 – C15). |
