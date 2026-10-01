# Backend plan — accounts and cross-device progress (Rust + Cloudflare)

> **Status: PLANNED, not built.** Nothing in this document has been implemented.
> The games and the deploy pipeline are exactly as they were.
>
> **Companion document:** [`RUNBOOK.md`](./RUNBOOK.md) — the hands-on, copy-paste
> steps (installs, Cloudflare config, migrations, deploy, rollback, troubleshooting).
> This file is the *why*; the runbook is the *how*. Every work package below names
> the runbook steps that carry it out.

## How to use these two documents

| If you want to… | Read |
| --- | --- |
| Know what was decided and why | P1 – P2 |
| Understand what it costs and what rule it amends | P3 |
| Know the repo's exact starting point | P4 |
| See the options that were rejected | P5 |
| Understand the platform limits you are designing inside | P6 |
| Understand the single most important constraint (CPU time) | **P7** |
| See the target architecture and file layout | P8 |
| See the account/credential design | P9 |
| See the database schema and HTTP API | P10 |
| See what syncs, what never syncs, and how conflicts resolve | **P11** |
| See what changes in the frontend | P12 |
| See the test plan | P13 |
| See the CI/deploy changes | P14 |
| **Start working** | P15 (work packages) → `RUNBOOK.md` |
| Learn the Rust you will actually write | P19 |

## Contents

- **P1** Purpose and status
- **P2** Locked decisions
- **P3** The amendment this makes to the project rules
- **P4** Verified starting state of the repository
- **P5** Options considered, and why A won
- **P6** Cloudflare platform facts and free-tier limits
- **P7** Decision record: the 10 ms CPU limit, and why the credential is a player code
- **P8** Architecture (Option A)
- **P9** Identity and session model
- **P10** Data model and HTTP API
- **P11** Progress sync: what syncs, what never syncs, how conflicts resolve
- **P12** Frontend integration
- **P13** Testing strategy
- **P14** CI and deployment changes
- **P15** Work packages WP0 – WP9 (with acceptance criteria)
- **P16** Milestones M0 – M4
- **P17** Risks, failure modes and rollback
- **P18** Open decisions that need a human
- **P19** Rust primer for this project
- **P20** Glossary and references
- **P21** Revision log

---

## P1 Purpose and status

**Goal.** A child (or their parent) can create an account and have their progress
in every game follow them to another device, instead of living only in one
browser's `localStorage`. Secondary goal, stated by the project owner: this is
the vehicle for **learning Rust**.

**Status.** Planned. Design agreed; zero lines written. The branch
`feature/rust-backend` exists and currently sits on the same commit as `main`
with a clean working tree.

**Non-goals.** No server-side rendering. No third-party auth service. No
real-time features. No leaderboards. No social features. No analytics. No names,
birthdays or other personal data about children.

## P2 Locked decisions

| # | Decision | Choice |
| --- | --- | --- |
| D1 | Where the backend runs | Cloudflare Workers, **Workers Free plan** |
| D2 | Backend language | **Rust**, via `workers-rs` (Workers supports Rust through WebAssembly) |
| D3 | Datastore | **D1** (SQLite). Not KV — see P6 |
| D4 | API shape | Same-origin `/api/*` on the existing Worker, via `run_worker_first: ["/api/*"]` |
| D5 | Credential | **Player code** (a high-entropy "spillkode"), with the schema built so email+password or a passkey can be added later **without a rewrite** ("Path 4") |
| D6 | Session | Server-side row, `HttpOnly` cookie |
| D7 | What syncs | Durable achievements only; in-progress sessions and mute settings stay device-local |
| D8 | Who merges | The **client**, using the game's own existing codec; the server is a size-capped, timestamp-stamped store |
| D9 | Worker name | Reuses `learn-and-play`, so the domain, the assets and the approval gate are untouched |
| D10 | Failure behaviour | **Fail-open.** A network failure must never be visible in a game and must never block play |

## P3 The amendment this makes to the project rules

`AGENTS.md` states, under *Stack and deployment*:

> *"Keep the app fully static: no server-side rendering, no API dependencies, no
> runtime secrets. Adding an `/api/*` route, a datastore binding, or anything the
> browser needs at runtime is an amendment to this rule, agreed deliberately,
> never an implementation detail."*

This plan **is** that deliberate amendment. It is not an accident and it is not
free. What it costs, stated plainly:

1. **The site is no longer stateless or purely static.** A Worker script now runs
   for `/api/*`, D1 holds data, and that data can be lost or corrupted by a bug
   in code that did not exist before.
2. **A runtime secret now exists** (the HMAC pepper, `wrangler secret put PEPPER`),
   plus a `.dev.vars` file that must stay gitignored.
3. **The deploy grows a second moving part.** `wrangler deploy` now also compiles
   Rust, and a database migration step runs before the deploy.
4. **A dependency on a third party's availability is introduced**, in a new
   sense: accounts stop working if the backend is misconfigured — although every
   game keeps working, which is what P2/D10 buys us.
5. **The definition of done grows.** `npm run lint` is no longer the whole of
   "lint" — `cargo fmt --check` and `cargo clippy` join it.

The compensating controls are in P11 (fail-open sync, client-side merge),
P13 (tests that pin them) and P17 (rollback).

---

## P4 Verified starting state of the repository

Everything here was checked on the branch `feature/rust-backend` before writing
this document. Line numbers and file paths are real.

**Deployment**

- `wrangler.jsonc` — `name: learn-and-play`, `assets.directory: ./dist`, and
  **no `main`**: Cloudflare serves `dist/` itself, there is no Worker script.
  Lines 16-18 already anticipate this exact change: *"an `/api/*` route means
  adding a `main` entry point plus a binding (D1 for a database, KV for config)
  and `run_worker_first: [\"/api/*\"]`."*
- `.github/workflows/deploy-cloudflare.yml` — a `verify` job (`npm ci` → lint →
  test → build → uploads `dist/` as an artifact) then a `deploy` job behind the
  `cloudflare-production` environment's required reviewers, using
  `cloudflare/wrangler-action@v4` with `CLOUDFLARE_API_TOKEN` /
  `CLOUDFLARE_ACCOUNT_ID` and `command: deploy`.
- `.github/workflows/deploy-pages.yml` — publishes the same build to GitHub Pages
  automatically, no approval. `README.md` says to retire it once the custom
  domain is verified.
- `.github/workflows/ci.yml` — on every push and PR: `npm ci`, lint, test, build.
  Node 22, `actions/checkout@v7`, `actions/setup-node@v7`.
- `.gitignore` — `node_modules/`, `dist/`, `.wrangler/`, `coverage/`.

**Persistence today**

- `src/shared/persistence.js` — `readStorage` / `writeStorage` / `removeStorage`
  / `migrateStorage`. Every operation is best-effort and swallows failures on
  purpose: *"a full or locked store is not the child's problem."*
- `src/shared/usePersistentState.js` — `useState` + read on mount + write on
  change, through a per-game `codec` (`parse` / `serialize`).
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
  that draws exactly the line D7 relies on: *"that reset clears the piece
  session, never the pictures the child has seen."*
- `src/games/sound-labyrinth/puzzle.js` — the pure puzzle rules, already exported
  and React-free: `nextImageIndex`, `createPuzzleSession`, `earnPiece`,
  `placePiece`, `recallPiece`, `isBoardFull`, `isPuzzleCorrect`. P11 reuses these.
- `src/games/word-fishing/journal.js`, `src/games/card-battle/album.js` — the
  achievement codecs.
- `progress.js` also calls `migrateStorage('lydLabyrint:progress', …)` — the
  precedent for "never lose a child's progress during a change".

**UI entry points**

- `src/home/main.jsx` — the library page: a `GAMES` array of four visible tiles
  plus a commented-out Card Battle tile. Natural home of the account panel (P12).
- `src/shared/GameHeader.jsx` — back link + title pill, shared by every game.
- `vite.config.js` — `discoverGameEntries()` auto-discovers every
  `games/*/index.html`; the home `index.html` is an explicit entry.
  `test.testTimeout: 20000`; coverage `include: ['src/**/*.{js,jsx}']`, excluding
  test files, `src/test/**` and every `src/**/main.jsx`.

**Tooling and machine**

- `.github/workflows/`: `ci`, `deploy-cloudflare`, `deploy-pages`, `codeql`,
  `opencode`, `opencode-review`.
- `opencode.json` — the coding agent's bash allowlist is deliberately narrow:
  `npm ci`, `npm run lint`, `npm run test*`, `npm run build`, read-only git.
  **`cargo` is not in it** (WP9).
- `docs/agent-pipeline.md` exists. `docs/audit/BASELINE.md`, `PLAN.md` and
  `SUMMARY.md` are **referenced by `AGENTS.md` and `README.md` but absent from
  this working tree.** The coverage baseline therefore cannot currently be
  checked (P13).
- This machine: Node v24.15.0, npm 11.12.1. **Rust is not installed** (`cargo`,
  `rustc`, `rustup` are all unrecognised) and **wrangler is not installed** — it
  is used only in CI, through `wrangler-action`.

---

## P5 Options considered, and why A won

### A — Rust Worker (`workers-rs`) + D1, same-origin `/api/*`  ✅ **CHOSEN**

Cloudflare supports Rust by compiling it to WebAssembly (`workers-rs`), running on
the same Workers runtime as JavaScript. `Cargo` → `wasm32-unknown-unknown` →
`wasm-bindgen` → `worker-build` → `wrangler deploy`. The existing `wrangler.jsonc`
gains `main`, `assets.binding: ASSETS`, `run_worker_first: ["/api/*"]` and a
`d1_databases` binding; static assets keep being served exactly as today.

**Pros** — free; reuses the pipeline that already exists (one deploy job, one
required-reviewer gate); *all* backend code is Rust, so it genuinely teaches the
language; `worker::d1` gives typed SQL from Rust; assets and API share an origin,
so **no CORS and no cross-origin cookie problems**; the array form of
`run_worker_first` means game page loads never execute Rust at all, so the free
request budget is spent only on API calls.

**Cons** — a second toolchain; the Rust-on-Workers ecosystem is smaller than
JS-on-Workers (no `tokio`/`async_std`, some crates do not compile for
`wasm32-unknown-unknown`, debugging is thinner); the **10 ms free CPU ceiling**
rules out password hashing (P7); CI and the coding agent's allowlist need
`cargo`; every deploy also needs a migration step.

### B — JS Worker + a Rust→WASM library + D1 (hybrid)

The Worker script is JS/TS (HTTP, cookies, D1); a Rust crate compiled with
`wasm-pack` holds the *pure* logic (code generation, HMAC verification, payload
validation, the merge), unit-tested with plain `cargo test`.

**Pros** — lowest risk; Rust where the learning value is highest (pure functions,
real `cargo test`, no WASM-in-the-Cloud quirks); the same crate could later run in
the browser. **Cons** — two languages in one Worker; `wasm-bindgen` plumbing
(`WebAssembly.Module` vs `Instance`, the `__wbg_set_wasm` patch) is a known rough
edge; less "I built a backend in Rust".

> Kept as the fallback if WP1's spike (M0) fights the toolchain. **The schema, the
> merge rules and the API surface in P10/P11 are identical either way** — only the
> HTTP/cookie layer moves, so switching costs a day, not a rewrite.

### C — Cloudflare Access does the login; Rust only stores progress

Access (Zero Trust) in front of `/api/*` only; the identity arrives as an
authenticated header/JWT. **Pros** — essentially no auth code; Cloudflare handles
recovery and identity providers; library pages stay public. **Cons** — identity
and config live in the **dashboard, not the repo**, which cuts against this
project's reviewable-everything habit; the frontend must handle Access's
redirect-to-login flow inside a fetch-based app; Cloudflare's docs warn that with
static assets present `ctx.access` is **not** passed to the user Worker; and the
account feature then cannot work at all without a third-party identity service.
(Free Zero Trust is commonly quoted at up to 50 users — **verify on the account**
before committing.)

### D — Rust (Axum/Actix) on Fly.io or Render + managed Postgres

**Pros** — the best pure Rust learning: `axum`, `sqlx`, `tokio`, `argon2`, real
servers, no WASM target, no 10 ms ceiling, passwords done properly.
**Cons** — **not free.** Fly.io has no free allowance, requires a card, and bills
per resource (smallest shared machines are low single-digit $/month; stopped
machines still cost rootfs at $0.15/GB-month); there is a trial credit, not a
free tier. Render's free web tier sleeps after ~15 minutes idle, so the first
request of the evening takes tens of seconds — a bad first impression for a
child. Plus a second deploy pipeline, host, backups, TLS and secrets, and the
site stops being a one-command static deploy.

### E — Rust→WASM in the browser only

Teaches Rust, no backend, **but cannot give cross-device progress.** A side quest,
not a solution.

### Comparison

| | Rust learning | Free? | Auth code to write | One deploy pipeline | Risk |
| --- | --- | --- | --- | --- | --- |
| **A. Rust Worker + D1** | ★★★★★ | ✅ (10 ms CPU) | yes | ✅ | medium |
| B. JS Worker + Rust lib | ★★★★ | ✅ | yes | ✅ | low |
| C. Access + Rust API | ★★★★ | ✅ | **none** | ✅ (config outside repo) | medium |
| D. Rust on Fly/Render | ★★★★★ | ❌ ~$0-5/mo | yes | ❌ second pipeline | low tech / high ops |
| E. Browser WASM | ★★★ | ✅ | n/a | ✅ | — no accounts |

---

## P6 Cloudflare platform facts and free-tier limits

Figures taken from Cloudflare's docs (Workers *Limits*, *Pricing*; D1 *Pricing*,
*Limits*; KV *Limits*; Durable Objects *Pricing*). **Re-check them before you
commit to a design decision** — Cloudflare changes limits.

### Workers

| Feature | Workers **Free** | Workers Paid ($5/month) |
| --- | --- | --- |
| Requests | 100,000/day | no limit |
| **CPU time per HTTP request** | **10 ms** | 5 min (default 30 s) |
| Memory per isolate | 128 MB | 128 MB |
| Subrequests per request | 50 | 10,000 |
| Environment variables | 64/Worker, 5 KB each | 128/Worker, 5 KB each |
| Worker size | 64 MiB | 64 MiB |
| Workers per account | 100 | 500 |
| Static asset files per Worker version | 20,000 | 100,000 |

Two definitions that matter more than the numbers:

- **CPU time ≠ wall time.** Cloudflare: *"CPU time measures how long the CPU
  spends executing your Worker code. Waiting on network requests (such as
  `fetch()` calls, KV reads, or database queries) does not count toward CPU
  time."* So a slow D1 query is free; a slow loop is not.
- **Static assets with the array form of `run_worker_first` never invoke the
  Worker.** Loading a game page costs zero Worker requests and zero CPU. Only
  `/api/*` does.

### D1 (the datastore we use)

| | Workers Free |
| --- | --- |
| Databases per account | 10 (1 comfortably enough) |
| Storage | 5 GB total |
| **Rows read** | 5,000,000 / day |
| **Rows written** | 100,000 / day |
| Queries per Worker invocation | 50 |
| Max row / string size | 2 MB |
| Point-in-time recovery (Time Travel) | 7 days |
| Concurrent connections per invocation | 6 |

Billing counts **rows scanned**, not rows returned — index the columns you filter
on (`README`'s note: an unindexed `WHERE` still scans). A "row written" is any
`INSERT`/`UPDATE`/`DELETE`, plus index maintenance.

### Workers KV (rejected as the datastore)

| | Free |
| --- | --- |
| Reads | 100,000 / day |
| **Writes to different keys** | **1,000 / day** |
| Writes to the same key | 1 per second |
| Storage | 1 GB |

Two disqualifying properties: **1,000 writes/day** is uncomfortably close to a
progress-sync workload (which writes on every meaningful game event), and KV is
**eventually consistent** — "save, then read it back on the other device" can read
a stale value for up to a minute. Great for configuration, wrong for progress.

### Durable Objects (a possible future, not now)

Available on the Workers **Free** plan with the **SQLite** storage backend only
(100,000 requests/day free). Strongly consistent, per-object, and the right tool
if a leaderboard or real-time feature ever arrives. Heavier mental model than
this feature needs.

### Secrets, bindings and routing

- `assets.run_worker_first: ["/api/*"]` runs the Worker script only for matching
  paths; everything else is served as a static asset with no Worker invocation.
- With both a script and static assets, assets are tried first unless
  `run_worker_first` says otherwise.
- Bindings (`d1_databases`, secrets) are declared in `wrangler.jsonc` and read
  from `env` in Rust; secrets are set with `wrangler secret put` and are **never**
  written to the repository.
- The deploy reuses the Worker name `learn-and-play`, so the custom domain and
  the `cloudflare-production` approval gate are unchanged.

---

## P7 Decision record: the 10 ms CPU limit, and why the credential is a player code

This is the single most important constraint in the whole plan. Read it before
changing any part of the auth design.

### What the limit is

> Cloudflare, Workers *Limits*: **CPU time per HTTP request — Free: 10 ms,
> Paid: 5 min (default 30 s).**
>
> *"The average Worker uses approximately 2.2 ms per request. Heavier workloads
> that handle **authentication**, server-side rendering, or parse large payloads
> typically use **10-20 ms**."*

Properties that make it a design constraint rather than a footnote:

- **It is per request, not per day.** You cannot amortise it, batch around it, or
  spread it over several requests. Cross the line and the request **fails** — it
  does not get slower.
- **Local dev does not enforce it the way production does.** `wrangler dev` will
  happily run a 300 ms computation that the deployed Worker rejects. **Never
  assume a login that works locally will work in production.**
- **Database time is free.** A D1 `await` is I/O, not CPU. So the database is not
  the problem; the computation is.

### Where the milliseconds go on a login request

`POST /api/session` = parse a small JSON body → `SELECT` one user → **verify the
credential** → set a cookie. Only the middle step is interesting.

| Work | Estimated CPU | Verdict on Free (10 ms) |
| --- | --- | --- |
| Parse a small JSON body, build the response, `Set-Cookie` | < 0.1 ms | fine |
| D1 `SELECT` one row by a unique indexed column | ~0.1-1 ms | fine |
| **PBKDF2-SHA256, 600,000 iterations** (OWASP's current guidance) | **hundreds of ms** | ❌ 30-100× over |
| **PBKDF2-SHA256, 100,000 iterations** (older common guidance) | ~tens of ms | ❌ several× over |
| **PBKDF2-SHA256, 10,000 iterations** (already weak) | ~5-15 ms | ❌ at or over the line |
| **HMAC-SHA256 of a high-entropy player code** | **< 0.05 ms** | ✅ ~200× under |
| Passkey signature verify (P-256) | ~1-3 ms | ✅ under |
| Avoiding user enumeration costs a second dummy hash on a miss | ×2 the above | ❌ worse |

**These are estimates, not measurements.** In particular, Web Crypto's PBKDF2 runs
in native code inside the runtime, and its true billed-CPU figure is the one
number this document cannot give you. That is why R10 in the runbook exists: a
dev-only endpoint that lets you measure the real cost on the real account, in the
real runtime, before deciding anything permanent.

### Why this matters

A password hash is *supposed* to be expensive — that cost **is** its security
property. If one hash costs 5 ms, an attacker holding your `users` table tries
~200 passwords per second per core; at 500 ms they try 2. Making the hash fit in
10 ms means making it worthless. This is not a Cloudflare bug; it is password
hashing working as designed, measured against a budget deliberately set below
the authentication workload class.

### Scope: only two routes are ever at risk

Every game request is light JSON plus one D1 upsert — far inside 10 ms. The
ceiling only bites `POST /api/account` and `POST /api/session`. The architecture
is not at risk; those two routes are.

### The four paths that were weighed

| Path | What you get | What it costs | Verdict |
| --- | --- | --- | --- |
| 1. Email + password on Workers Paid | Done properly: argon2 or PBKDF2 at a real work factor | $5/month, plus an email sender for reset, plus PII for children | Rejected for now, **kept available** |
| 2. Email + password on Free, reduced work factor | Free, and it works | The hash is weak by construction; a leaked dump is crackable; the 10 ms line is a flaky neighbour | Rejected |
| 3. Email as identifier + passkey as secret | Findable by email, nothing hashable stored, stays free | Most frontend code; Vitest cannot run a real WebAuthn ceremony | Rejected for now, **strong long-term candidate** |
| **4. Swappable credential: player code now, email+password later** | Free today; the Rust, the schema and the API are *reused* when you switch | Two credential kinds to support eventually | ✅ **CHOSEN** |

### Additional costs of email + password that are not CPU

1. **Cloudflare does not send email.** Verification and "forgot password" need
   Resend / Postmark / MailChannels — a second third-party runtime dependency on
   top of the API.
2. **Real PII, for children.** Email addresses plus passwords mean a genuine
   data-protection surface (GDPR-K/COPPA), breach exposure, and a reset flow that
   must not leak whether an address is registered.
3. **Hardening costs *more* CPU, not less** — constant-time comparison, dummy
   hashes on misses, aggressive rate limiting.

### What makes a player code correct rather than a compromise

A **16-character code drawn from a 32-character ambiguity-free alphabet**
(`K7PM-3XQ9-2RTF-8WHB`), i.e. 80 bits of entropy, stored as
`HMAC-SHA256(pepper, code)`. There is nothing to brute-force, so a single cheap
HMAC is not a "cheap substitute" — it is the **correct** verification for that
kind of credential, exactly as an API key is verified with a hash and not with a
password KDF. The pepper matters because it means a leaked D1 dump cannot verify
guesses offline even if someone guesses the alphabet.

---

## P8 Architecture (Option A)

### Request flow

```
Browser (any game page, static, served by Cloudflare as today)
   │
   ├── GET /games/<slug>/            → static asset. NO Worker invocation.
   │
   └── fetch('/api/…', {credentials:'include'})   → Worker script (Rust)
                                                     │  session cookie
                                                     ↓
                                                   D1 (SQLite)
```

Only `/api/*` reaches Rust. Game pages are served by Cloudflare's asset router
with no script execution at all, so:
- the existing game pages cannot be broken by backend bugs, and
- the 100,000 requests/day budget is spent only on API calls.

### Why same-origin

The API lives on the same Worker that serves the assets, so requests are
same-origin: no CORS, no `SameSite=None`, no preflight, no second domain to
configure. This is the main reason the plan reuses the existing Worker name
instead of deploying a separate `api.` Worker.

**Consequence for GitHub Pages.** `deploy-pages.yml` publishes a build on a
*different* origin, where `/api/*` does not exist. If Pages is kept, the frontend
must call an absolute API URL and the Worker must send CORS headers — which
immediately makes cookies cross-site. Recommendation: **retire Pages in the same
change** (R14), which `README.md` already anticipates.

### Target file layout

```
worker/                             NEW — Rust workspace root
  Cargo.toml                        [workspace] + [profile.release] lto/strip/codegen-units
  rust-toolchain.toml               pins the channel + the wasm32-unknown-unknown target
  crates/
    core/                           PURE Rust — zero `worker` dependency
      Cargo.toml
      src/lib.rs                    the modules below re-exported
      src/code.rs                   player-code generation + normalisation
      src/secret.rs                 HMAC + constant-time compare
      src/validate.rs               key allowlist, size caps
      src/merge.rs                  the per-key merge rules (P11)   ← OPTIONAL, see WP9
      tests/                        `cargo test` runs here, on the host, in milliseconds
    app/                            THE WORKER — depends on `worker` + `core`
      Cargo.toml
      src/lib.rs                    #[event(fetch)] router for /api/*
      src/account.rs                signup / signin / signout / me
      src/progress.rs               GET/PUT progress
      src/db.rs                     thin worker::d1 glue, no logic
  migrations/0001_init.sql
src/shared/api.js                   NEW — fetch wrapper, credentials: 'include'
src/shared/syncable.js              NEW — the registry: which keys sync + how to merge
src/shared/sync.js                  NEW — pull, merge, debounce, push, fail-open
src/shared/account.js               NEW — useAccount()
src/shared/persistence.js           + an optional fire-and-forget write observer
src/home/AccountPanel.jsx           NEW — Norwegian account UI on the library page
docs/backend/PLAN.md, RUNBOOK.md    this document and its companion
```

**Why two crates (`core` + `app`) and not one.** `cargo test` must be able to run
your logic tests on the host machine in milliseconds, and a crate that depends on
`worker`/`worker-sys` may not build for a non-wasm host target at all. Keeping the
pure logic in a crate with **no `worker` dependency** guarantees a fast, reliable
test loop — and it is the same "pure functions, thin glue" discipline this repo
already applies to a game's `*logic.test.js` files.

### `wrangler.jsonc` after the change

```jsonc
{
  "name": "learn-and-play",              // unchanged → same domain, same approval gate
  "main": "worker/crates/app/src/lib.rs",       // ⚠ see the note below
  "compatibility_date": "2026-09-20",
  "build": {
    "command": "worker-build --release",
    "cwd": "worker"
  },
  "assets": {
    "directory": "./dist",               // unchanged: the games, served exactly as today
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"]       // only /api/* runs Rust
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "learn-and-play", "database_id": "<from the dashboard>" }
  ]
}
```

> ⚠ **Verify `main` and `build.command` against a freshly generated template.**
> `worker-build` emits a small JavaScript shim, and the `workers-rs` template
> currently points `main` at *that generated file* (historically
> `build/worker/shim.mjs`) rather than at the `.rs` source, with a build command
> roughly `cargo install -q worker-build && worker-build --release`. Exact paths
> have moved between versions. **RUNBOOK R2 generates a throwaway template outside
> the repo and copies the current canonical keys** — do that instead of trusting
> the snippet above verbatim.

### The Rust entry point

```rust
use worker::*;

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    // routes /api/* — everything else is a static asset and never gets here
    Response::ok("ok")
}
```

## P9 Identity and session model

### The credential

| Property | Value |
| --- | --- |
| Alphabet | 32 characters, **no `0`/`O`, no `1`/`I`/`L`** (it gets written down and typed by a human) |
| Length | 16 characters, shown in groups of four: `K7PM-3XQ9-2RTF-8WHB` |
| Entropy | 80 bits |
| Stored as | `HMAC-SHA256(pepper, normalised_code)` — never the code itself |
| Normalisation | Uppercase, drop everything that is not alphanumeric, so `k7pm 3xq9 …` and `K7PM-3XQ9-…` are the same code |
| Shown | **Exactly once**, when the account is created |

The code is a bearer secret: whoever holds it, holds the account. That is the
same property `localStorage` already has — whoever holds the browser, holds the
progress — so this makes nothing worse, and makes one thing much better: the
progress now survives the device.

### No PIN in the MVP — and why

A 4-digit PIN is only 10,000 possibilities. Verified cheaply, it is security
theatre; verified properly, it is the same CPU problem as a password. What *would*
make it meaningful is aggressive per-account lockout — and lockout is the wrong
first experience for a seven-year-old. Revisit only if "someone found the
written-down code" turns out to be a real threat in practice.

### Sessions

| Property | Choice | Why |
| --- | --- | --- |
| Token | 256 bits of CSPRNG output, base64url | unguessable |
| Stored server-side as | `SHA-256(token)` | a database dump does not yield usable cookies |
| Cookie | `HttpOnly; Secure; SameSite=Lax; Path=/` | unreadable by scripts; `Lax` plus an `Origin` check covers CSRF without a token |
| Lifetime | ~12 months | a child should not be asked to log in repeatedly |
| Revocable | yes, by deleting the row | "log out everywhere" and "delete my account" are the same mechanism |

### Threat notes

- **Rate limiting.** In-memory per-isolate counters for failed sign-ins; a D1
  counter row is written **only on failure**, so normal use costs ~0 rows
  written. An 80-bit code is not brute-forceable anyway — the limiter exists to
  stop hammering the database, not to protect the code.
- **Enumeration.** `POST /api/session` returns the same response and takes the
  same time whether or not the code matched (do the HMAC either way).
- **Constant-time comparison** for the HMAC.
- **Size caps** on every request body, plus a **key allowlist** on the progress
  endpoint, so a client cannot store arbitrary keys.
- **No PII at all.** `users` holds a uuid and a timestamp. That is a design
  feature, not an accident.

---

## P10 Data model and HTTP API

### Schema (`worker/migrations/0001_init.sql`)

```sql
-- One row per account. Deliberately holds no personal data at all.
CREATE TABLE users (
  id         TEXT PRIMARY KEY,          -- uuid v4
  created_at INTEGER NOT NULL           -- unix milliseconds, server-stamped
);

-- The 'kind' column is what makes "Path 4" a drop-in rather than a rewrite:
-- 'password' (identifier = email) and 'passkey' rows slot in beside 'code' rows
-- with no schema change and no change to sessions or progress.
CREATE TABLE credentials (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('code','password','passkey')),
  identifier  TEXT,                     -- email for 'password'; NULL for 'code'
  secret_hash TEXT NOT NULL,            -- HMAC(code) | pbkdf2/argon2(password) | public key
  created_at  INTEGER NOT NULL
);
-- A partial unique index: one account per email, but many NULL identifiers.
CREATE UNIQUE INDEX credentials_identifier
  ON credentials(identifier) WHERE identifier IS NOT NULL;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,          -- SHA-256 of the cookie value, never the value
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Progress is stored as opaque per-record blobs keyed by the storage key the
-- games already use. `payload` is exactly what the game's own codec produces.
CREATE TABLE progress (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_key TEXT NOT NULL,             -- e.g. 'soundLabyrinth:gallery'
  payload    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,          -- server-stamped revision
  PRIMARY KEY (user_id, record_key)
);

-- Written only on failed sign-in, so normal use costs no rows written.
CREATE TABLE login_failures (
  code_hash    TEXT PRIMARY KEY,
  failures     INTEGER NOT NULL,
  locked_until INTEGER
);
```

Notes:
- `PRIMARY KEY (user_id, record_key)` gives the upsert its conflict target and
  makes the read for one user a single indexed scan (which is what D1 bills).
- `ON DELETE CASCADE` is what makes "delete my account" real: one `DELETE` from
  `users` and every credential, session and progress row goes with it.
- D1 is SQLite; enable foreign keys per the D1 docs if the cascade does not fire
  (`PRAGMA foreign_keys = ON` / the documented equivalent).

### HTTP API

| Method | Path | Body | Returns | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{ ok: true }` | proves the Worker runs; the M0 acceptance test |
| `POST` | `/api/account` | `{}` | `{ code: "K7PM-…" }` | creates user + code credential, sets the session cookie; **the only time the code is ever returned** |
| `POST` | `/api/session` | `{ code }` | `{ ok: true }` | signs in; same response and timing on a miss |
| `DELETE` | `/api/session` | — | `{ ok: true }` | deletes this session row, clears the cookie |
| `GET` | `/api/me` | — | `{ signedIn: boolean, createdAt?: number }` | never returns the code |
| `GET` | `/api/progress` | — | `{ records: [{ key, payload, updatedAt }] }` | this user's blobs |
| `PUT` | `/api/progress` | `{ records: [{ key, payload, updatedAt }] }` | `{ accepted, rejected, revisions }` | per-record revision gate |
| `DELETE` | `/api/account` | — | `{ ok: true }` | WP8: erases user, credentials, sessions, progress |

Rules enforced by the Worker:

- Session cookie required on everything except `/api/health`, `/api/account` and
  `POST /api/session`.
- `record_key` must be in the server's **allowlist** (`soundLabyrinth:gallery`,
  `wordFishing:journal`, `cardBattle:album`) — anything else is rejected.
- `payload` has a hard size cap (start at 64 KB; every real payload is < 1 KB).
- `updated_at` in the request is the revision the client *last saw*. The server
  writes only when its stored `updated_at` is **older than or equal to** that
  value, then stamps a fresh one. This is what stops a stale device from
  clobbering newer progress.
- `PUT` additionally checks the `Origin` header (with `SameSite=Lax` this covers
  CSRF without a token).

### API design notes

- `GET /api/progress` returns **all** records in one response. There are three of
  them and they are tiny; one request beats a per-game round trip and keeps the
  request count (and therefore the free-tier budget) low.
- The server never parses a `payload`. Validating it is the client's job, using
  the codecs that already exist (P11) — which is why a corrupt server value
  cannot break a game.

---

## P11 Progress sync: what syncs, what never syncs, how conflicts resolve

### The governing principle

**`localStorage` stays the source of truth for play.** The API is a *mirror*, not
a gate. Games must keep working with the network down, stay instant, and never
show an error because a server was unreachable. This extends the promise
`persistence.js` already makes — *"a full or locked store is not the child's
problem"* — to the network.

### What syncs, and what must never sync

**Durable achievements only.** The repo already draws this line for us:
`progress.js` says the piece session is cleared by "Start på nytt" *while the
gallery survives it*. That is exactly the distinction.

| Storage key | Syncs? | Why |
| --- | --- | --- |
| `soundLabyrinth:gallery` | ✅ | durable: which pictures have been assembled |
| `wordFishing:journal` | ✅ | durable: words caught, trips finished, decorations unlocked |
| `cardBattle:album` | ✅ | durable: animals found |
| `soundLabyrinth:progress` | ❌ device-local | the picture being assembled *right now* |
| `soundLabyrinth:game` | ❌ device-local | the maze being walked *right now* |
| `wordFishing:trip` | ❌ device-local | the trip in progress |
| every `<game>:muted` | ❌ device-local | a child may reasonably mute the tablet and not the laptop |

Why the sessions must not sync: they are *a moment*, not progress. A stale
`wordFishing:trip` copied from another device would drop the child onto a boat
with the wrong crates and the wrong count. Losing a session costs one trip's
worth of sorting; corrupting one costs trust in the game.

### Merge rules, per key

Every synced record is merged by a **pure function**, so it can be unit-tested
without a network, a database or a browser.

| Key | Merge |
| --- | --- |
| `wordFishing:journal` | `words` = order-preserving **union**; `decorations` = order-preserving **union**; `trips` = **max** |
| `cardBattle:album` | `discovered` = order-preserving **union** |
| `soundLabyrinth:gallery` | `seen` = order-preserving **union**, then `round` is **rebuilt** by replaying `recordSeenImage` |

All three are safe because the underlying values are **monotonic**: a word caught
cannot be un-caught, an animal found cannot be unfound, a picture assembled cannot
be unassembled. A union therefore never loses progress, and a device that has been
offline for a week cannot wipe the other device's work.

### The gallery needs no clock at all

`src/games/sound-labyrinth/puzzle.js` and `progress.js` already export everything
needed, and they are pure:

```js
// The merged gallery is reconstructed from the durable fact, not guessed from
// which device wrote last.
const mergedSeen = unionInOrder(localGallery.seen, remoteGallery.seen);
const merged = mergedSeen.reduce(
  (gallery, index) => recordSeenImage(gallery, index, PUZZLE_IMAGES.length),
  createGallery(),
);
```

Because `recordSeenImage` is the real rule the game uses (including the "a full
round restarts from this picture" behaviour), replaying it over the unioned
`seen` produces a *correct* `round` — not an approximation. This is a
table-testable pure function in Vitest today.

### Revision scheme (no device clocks)

1. The client remembers, per key, the **server revision it last saw**
   (`localStorage['sync:revision:<key>']`).
2. On load (if signed in): `GET /api/progress`. For each record, if the server's
   `updatedAt` is **newer** than the revision the client remembers, merge it into
   local state and write the merged result back to local storage.
3. On change: debounce (~2 s idle), then `PUT /api/progress` with each record's
   `updatedAt` set to the revision the client last saw.
4. The server accepts only when its stored revision is not newer than that value,
   stamps a fresh revision, and returns it. The client stores the new revision.

**Why server-stamped revisions rather than timestamps:** device clocks are wrong,
timezones are wrong, and a tablet with a flat battery can jump years. A
server-assigned counter cannot be lied to by a client, and ordering is then
decided by one authority instead of by comparing two machines' opinions.

### The first-sign-in rule (protects existing progress)

When an account is created **on a device that already has progress**, that device
**uploads**, it does not download. A child who has been playing for weeks and then
creates an account must never be wiped by an empty server row. This is
`migrateStorage`'s philosophy applied over the network:

> the local value is never replaced by a remote value that is not strictly newer.

Order of first sign-in:

1. `POST /api/account` → cookie set, code returned.
2. **Push** every local syncable record that has no revision yet.
3. From then on, the normal pull/merge/push cycle above.

### Failure behaviour (fail-open, pinned by tests)

| Situation | Behaviour |
| --- | --- |
| Not signed in | sync module does nothing at all; no requests |
| Network error / non-2xx | swallowed; a retry happens on the next change or next page load |
| Server returns junk for a record | the game's own `codec.parse` rejects it, and the game falls back to `initial()` |
| Storage unavailable | unchanged from today: the game plays fine and forgets on reload |
| Backend entirely down | games work exactly as they do today; only account screens show a message |

**A child must never see a dialog, a toast or a spinner because a server
disagreed.** That is a hard requirement, and P13 pins it with a test.

### Where the merge lives

**In the client** (WP6), because the codecs and the pure game rules are already
there and already tested, and because it guarantees the server can never corrupt
local state. Moving it into Rust later is **WP9** — a genuinely good second Rust
exercise, because the tests to port already exist.

---

## P12 Frontend integration

**No game component changes.** Everything lands in `src/shared/` and `src/home/`.

### New shared modules

| File | Responsibility |
| --- | --- |
| `src/shared/api.js` | one `request()` wrapper: base URL, `credentials: 'include'`, JSON in/out, `AbortController` timeout, never throws on network failure (returns `null`) |
| `src/shared/syncable.js` | the registry — one row per synced key: `{ key, gameId, merge }`. A new game adds one row here **and** one entry to the Rust allowlist |
| `src/shared/sync.js` | `startSync()`, `stopSync()`, `pullAndMerge()`, debounced `push()`; subscribes to storage writes |
| `src/shared/account.js` | `useAccount()` — `{ signedIn, createdAt, signUp(), signIn(code), signOut() }` |

### The base URL

```js
// Same-origin by default. VITE_API_BASE exists only so the build can point at an
// absolute URL if GitHub Pages is ever kept alongside the Worker.
const API_BASE = import.meta.env.VITE_API_BASE ?? '';
```

### How `persistence.js` learns about writes

Add an **optional, fire-and-forget** observer. Default behaviour is unchanged, so
no existing test moves:

```js
const observers = new Set();
export function onStorageWrite(fn) { observers.add(fn); return () => observers.delete(fn); }

// inside writeStorage, after a successful write:
for (const fn of observers) {
  try { fn(key, serialized); } catch { /* a listener must never break a game */ }
}
```

`sync.js` is the only subscriber, and it registers itself only when signed in.
The `try`/`catch` is not decoration: **a bug in sync must not be able to break a
game's save.**

### UI placement

- **Account panel on the library page** (`src/home/AccountPanel.jsx`, rendered by
  `src/home/main.jsx`). This is the right home because the library is the entry
  point a parent sees, and because no game page has to grow any chrome.
- **No status chip inside games.** A child mid-maze should never be shown "syncing…"
  or "offline". Deciding to keep sync invisible is a design decision, not an
  omission.
- Norwegian copy in the panel, for example:
  - Heading: *"Konto"*
  - New account: *"Lag konto"* / *"Spillkoden din"* / *"Skriv ned koden og ta vare på den. Den er nøkkelen til framgangen din."*
  - Returning: *"Logg inn med spillkode"* / placeholder *"K7PM-3XQ9-…"*
  - Signed in: *"Du er logget inn. Framgangen din lagres."* / *"Logg ut"*
  - Errors are calm and never accusatory: *"Fant ingen konto med den koden."*
- A "kopier koden" button is worth having (children and parents both lose codes).

### Naming

All identifiers English (`syncable.js`, `mergeRecord`, `pullAndMerge`), all
child-facing text Norwegian — exactly the rule in `AGENTS.md`.

## P13 Testing strategy

### Rust (`cargo test`, host target, milliseconds)

In `worker/crates/core` — logic only, no `worker` dependency:

- code generation: length, alphabet (no ambiguous characters), determinism given a
  seeded RNG, normalisation of typed-in codes (case, dashes, spaces)
- HMAC: same code → same hash; different pepper → different hash; constant-time
  comparison behaviour
- validation: allowlisted keys accepted, unknown keys rejected, size caps enforced
  on the boundary (cap-1, cap, cap+1)
- (WP9 only) the merge functions, ported from the JS tests

> A crate that depends on `worker` may not compile for a non-wasm host target,
> which is the reason for the two-crate split in P8. Never put logic you want to
> unit-test in the `app` crate.

### Vitest (the existing suite)

| Area | Tests |
| --- | --- |
| `syncable.test.js` | every merge rule, as a table: union preserves order, `trips` takes the max, the gallery replay produces the expected `round` |
| `sync.test.js` | with a mocked `fetch`: signed-out does nothing; a newer remote revision merges and writes back; an older one does not clobber; a stale client's push is rejected; **a network failure leaves local state untouched and throws nothing** |
| `account.test.js` | sign-up returns the code once; sign-in sends the normalised code; sign-out clears local state |
| `AccountPanel.test.jsx` | one rendered happy path: create → read the code → sign out → sign back in |
| `persistence.test.js` (extend) | an observer that throws does not break `writeStorage` |
| existing game tests | **must not change** — proof that no game was touched |

### The rules this repo already imposes, which these tests must respect

- Pin `Math.random` with `vi.spyOn` and use fake timers for the debounce.
- Restore shared mute state in `afterEach`; read a default the way a page load
  does (`vi.resetModules()` + fresh import).
- The suite-wide `testTimeout: 20000` is enough; do not add private ceilings.
- Cookie behaviour cannot be observed in jsdom (`HttpOnly` is not implemented), so
  **test the client's request shape and the server's response handling with a
  mocked `fetch`** rather than trying to read `document.cookie`.

### Coverage caveat — read this before the coverage gate is used

`vite.config.js` sets `coverage.include: ['src/**/*.{js,jsx}']`, so
`api.js`, `syncable.js`, `sync.js` and `account.js` are **inside the report** the
moment they exist, and untested new modules drop the numbers at 0 %.
`docs/audit/BASELINE.md` — the file `README.md` and `AGENTS.md` name as the
threshold — **is missing from this working tree.** Before using coverage as a
gate, restore it from git history or re-establish it with
`npm.cmd run test:coverage` on a clean `main`.

---

## P14 CI and deployment changes

### `ci.yml` (and the `verify` job of `deploy-cloudflare.yml`)

Add, **before** the npm steps so a Rust failure fails fast:

```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    targets: wasm32-unknown-unknown
    components: rustfmt, clippy
- uses: Swatinem/rust-cache@v2
  with:
    workspaces: worker
- name: Rust format
  run: cargo fmt --manifest-path worker/Cargo.toml --all --check
- name: Rust lint
  run: cargo clippy --manifest-path worker/Cargo.toml --all-targets -- -D warnings
- name: Rust tests
  run: cargo test --manifest-path worker/Cargo.toml
- name: Worker builds for wasm
  run: cargo build --manifest-path worker/crates/app/Cargo.toml --target wasm32-unknown-unknown --release
```

Keep the action versions already used in the file. The last step exists because
`cargo test` only proves the *host* build; the wasm target is what actually ships.

### `deploy-cloudflare.yml`

1. The `deploy` job must gain the same Rust toolchain + cache, because
   `wrangler deploy` now runs `build.command` (`worker-build`).
2. A migration step runs **before** the deploy:

```yaml
- name: Apply D1 migrations
  run: npx wrangler d1 migrations apply learn-and-play --remote
```

3. **Token scope.** `CLOUDFLARE_API_TOKEN` currently deploys static assets. It now
   also needs D1 permissions (at minimum `Workers D1: Edit`, plus `Workers Scripts:
   Edit` and `Account Settings: Read`). Cloudflare's permission names change —
   verify in the dashboard's token editor.
4. The `cloudflare-production` environment's required-reviewer gate is **unchanged**,
   so a human still approves every production deploy. A failed migration fails the
   deploy job, and therefore never half-ships a backend with the wrong schema.
5. `dist/` continues to come from the `verify` job's artifact. Consider uploading a
   built worker artifact too if the extra `worker-build` time in the deploy job
   becomes annoying; not required for M0.

### Worker size and startup

The free plan allows a 64 MiB Worker and a 1-second startup. Rust wasm is far
inside that with `lto = true`, `strip = true`, `codegen-units = 1`, and
`worker-build` running `wasm-opt` automatically. Keep an eye on it anyway — the
usual cause of growth is pulling in a large crate for one small helper.

### Cache hints

`Swatinem/rust-cache` caches the registry and `target/`. A `cargo install
worker-build` in the deploy job is **not** covered by it (installed binaries live
in `~/.cargo/bin`); either accept the install time, use `cargo-binstall`, or cache
`~/.cargo/bin` with an explicit `actions/cache` step keyed on the `worker-build`
version. Decide at WP7 with real timings, not now.

### `deploy-pages.yml`

**Recommendation: retire it in the same change (R14).** Pages cannot serve
`/api/*`, so keeping it means a cross-origin API, CORS headers, and cookies with
`SameSite=None`. `README.md` already states it should go once the custom domain is
verified. Retiring it is a *removal of a published surface*, so it is worth doing
as its own clearly-labelled commit.

### Dependabot and CodeQL

- `.github/dependabot.yml` already watches GitHub Actions and npm. Consider adding
  a `cargo` ecosystem entry for `/worker` so crates get updates too.
- CodeQL has Rust support in preview; adding it is optional and can wait.

---

## P15 Work packages WP0 – WP9

Each package lists **what**, **done when** (acceptance criteria), and the
**runbook steps** that carry it out. Do them in order; each one ends green.

### WP0 — Decision record and the written amendment *(docs only, no code)*

- Rewrite the *Stack and deployment* rule in `AGENTS.md` so it describes the new
  truth instead of forbidding it (ready-to-paste text in RUNBOOK R14).
- Update the `AGENTS.md` structure block (`worker/`, the new shared modules, these
  two docs), the Testing section (Rust tests live in `worker/`), the Definition of
  done (add `cargo fmt`/`clippy`/`test`), and the deployment paragraph.
- Update `README.md`: the account feature, what syncs, what does not, and the
  privacy position.
- Replace the "growing later" comment in `wrangler.jsonc` with a description of
  what is actually there.
- **Done when:** the docs describe the code as built, and the deliberate
  overrides are stated with their costs (P3).
- **Runbook:** R14.

### WP1 — Skeleton and the spike (M0) *— do not skip this*

- Generate a throwaway `workers-rs` template **outside the repo** to read the
  current canonical config (R2), then create `worker/` in the repo.
- `/api/health` in Rust; `wrangler.jsonc` gains `main`, `assets.binding`,
  `run_worker_first: ["/api/*"]`, `build`, and (at WP2) `d1_databases`.
- `.gitignore` gains `worker/target/`, `build/`, `.dev.vars`.
- A **dev-only** computation endpoint for the CPU experiment (R10), not routed in
  production.
- **Done when:** `https://play2learn.divanchyshyn.com/api/health` returns JSON,
  **and every existing game route is byte-identical** (`curl -I` on each
  `/games/<slug>/` before and after), **and** the deploy job still waits for the
  required reviewer.
- **Runbook:** R2, R3, R4, R10.

### WP2 — Schema and migrations

- `worker/migrations/0001_init.sql` (P10) created in the dashboard's D1 database,
  applied locally and remotely.
- **Done when:** applying twice is a no-op; `SELECT` from `wrangler d1 execute`
  shows the tables; the deploy job applies migrations before deploying.
- **Runbook:** R1, R5.

### WP3 — Accounts

- `worker/crates/core`: code generation, normalisation, HMAC, constant-time
  compare, session-token hashing — all pure, all `cargo test`ed.
- `worker/crates/app/account.rs` + `db.rs`: `POST /api/account`,
  `POST /api/session`, `DELETE /api/session`, `GET /api/me`.
- Cookie, rate limiting, enumeration resistance, pepper from `env`.
- **Done when:** `cargo test` covers the pure rules, and a real round trip works
  against the deployed Worker (create → sign out → sign in).
- **Runbook:** R4, R6.

### WP4 — Progress API

- `GET`/`PUT /api/progress` with the key allowlist, size caps, revision gate and
  the `Origin` check.
- **Done when:** a stale push is rejected, an oversize payload is rejected, an
  unknown key is rejected, and a round trip returns the same payload.
- **Runbook:** R4, R8.

### WP5 — Frontend

- `api.js`, `syncable.js`, `sync.js`, `account.js`, the `persistence.js` observer,
  `src/home/AccountPanel.jsx` wired into `src/home/main.jsx`.
- **Done when:** sync works end to end for one key; **no file under `src/games/`
  has changed**; with the network blocked, every game still plays and no error is
  shown.
- **Runbook:** R4, R8.

### WP6 — Tests

- Rust and Vitest coverage as listed in P13, including the network-down test.
- **Done when:** `npm.cmd run lint`, `npm.cmd run test`, `cargo test`, `cargo
  clippy` and `npm.cmd run build` all pass, and the coverage baseline has either
  been restored or re-established.
- **Runbook:** R7, R8.

### WP7 — CI and deploy

- P14 in full: Rust toolchain, cache, fmt/clippy/test/wasm-build in CI; toolchain
  + migrations in the deploy job; token scope widened.
- **Done when:** both workflows are green, and a deliberately broken migration
  fails the deploy job instead of shipping.
- **Runbook:** R7.

### WP8 — Hardening and privacy

- `DELETE /api/account` (cascades everything), security headers, a calm error
  vocabulary, and a short privacy note in the README.
- **Done when:** deleting an account leaves no rows behind in any table.
- **Runbook:** R8, R14.

### WP9 — Optional Rust follow-ups (pick when you want more Rust)

1. **Move the merge into Rust.** Port the JS merge rules into
   `worker/crates/core/src/merge.rs`, with the *existing* Vitest tests as the
   specification. You get `cargo test` on real domain logic.
2. **Add the passkey credential** (`kind = 'passkey'`, P-256 verification, ~1-3 ms,
   stays free).
3. **Add email + password** — only if you move to Workers Paid. Reuses the
   `credentials.kind` column; needs an email sender.
4. **Port a game's pure rules to Rust** (e.g. the Shop's answer checking) and run
   them through wasm in the browser — the "one language everywhere" experiment.

---

## P16 Milestones

| Milestone | Content | What it proves | Risk to the live site |
| --- | --- | --- | --- |
| **M0** | WP1: `/api/health` in Rust, deployed, game pages unchanged | the toolchain, the build and the deploy path all work | none (assets untouched) |
| **M1** | WP2 + WP3: D1, migrations, accounts round trip | the free CPU budget is comfortable for the credential chosen | none (games never call it yet) |
| **M2** | WP4 + WP5 for **one** key: `soundLabyrinth:gallery` | end-to-end sync, plus the fail-open behaviour under a blocked network | low |
| **M3** | WP5 for all three achievement keys + the Pages decision | the feature is actually useful | low |
| **M4** | WP6 + WP7 + WP8: tests, CI, hardening, privacy | the change is finished by this repo's own definition of done | none |

Start at M0 and stop after it for a day if you like — M0 on its own is a
genuinely valuable, zero-risk experiment, and it is the step that tells you
whether Rust-on-Workers is pleasant for *you*.

## P17 Risks, failure modes and rollback

| # | Risk | Likelihood | Mitigation |
| --- | --- | --- | --- |
| R1 | Rust/wasm toolchain friction on Windows (`worker-build` fetching `wasm-opt`) | medium | M0 exists to surface it before anything depends on it; CI on ubuntu is the authority, local dev is a convenience |
| R2 | The 10 ms CPU ceiling on the two auth routes | low with a player code, **high** if the credential changes | the credential design (P7); R10 measures real cost before any permanent decision |
| R3 | A backend bug breaks a game | very low by construction | game pages never invoke the Worker; the merge is client-side; the codecs still validate |
| R4 | A child loses progress to a sync bug | medium — the worst outcome here | union-only merges on monotonic data; the revision gate; first sign-in uploads; never overwrite with a non-newer value; tests for each |
| R5 | `localStorage` and server drift apart confusingly | medium | the server is a mirror only; local play always wins for sessions; delete-account is real (WP8) |
| R6 | Rust build time slows every deploy | medium | `rust-cache`; build in the verify job; accept a 1-3 min deploy |
| R7 | Migration fails in production | low | migrate *before* deploy; a failed migration fails the job; run it locally first; D1 Time Travel gives 7 days of point-in-time recovery |
| R8 | Coverage gate fails because new modules are untested | high if forgotten | P13's coverage caveat; test the new shared modules with the feature, not after |
| R9 | `docs/audit/BASELINE.md` is missing, so the gate has no number | certain today | restore from git history or re-establish on a clean `main` before relying on it |
| R10 | Someone stores data they cannot delete | low | cascade delete is in the schema from the first migration (WP8 finishes the endpoint) |

### Rollback

| Situation | Action |
| --- | --- |
| The Worker misbehaves | `npx wrangler rollback` (restores the previous version, assets included), or revert the commit — the assets are unaffected either way |
| The backend should be removed entirely | revert the `wrangler.jsonc` + `worker/` commit; the site returns to exactly today's static deploy; D1 data can be exported first with `wrangler d1 export` |
| A migration was wrong | D1 Time Travel (7 days on Free) restores the database to a point in time; then fix forward with a new migration |
| The account feature is unwanted | the frontend modules are additive; deleting `AccountPanel` from the library page hides it without touching any game |

**The most important rollback property:** because `run_worker_first` scopes Rust to
`/api/*`, a total backend failure degrades to *"accounts do not work"* and never to
*"the games do not load"*.

## P18 Open decisions that need a human

| # | Decision | Needed by | Notes |
| --- | --- | --- | --- |
| Q1 | Install the Rust toolchain on this machine | WP1 | R0; includes the MSVC build tools |
| Q2 | Add `wrangler` as a devDependency, or use `npx wrangler` | WP1 | changes `package.json`; `npx` downloads on demand |
| Q3 | Create the D1 database and widen the API token scope | WP1/WP2 | dashboard work, cannot be scripted from here |
| Q4 | Retire `deploy-pages.yml` in this change, or keep it with CORS | WP5 | retiring is cleaner and already anticipated by the README |
| Q5 | Should the coding agent be allowed to work on Rust? | WP7 | adds `cargo` commands to `opencode.json`'s bash allowlist; every deploy command stays denied |
| Q6 | Add a `cargo` entry to `dependabot.yml`? | WP7 | optional |
| Q7 | Restore or re-establish `docs/audit/BASELINE.md` | WP6 | required before the coverage gate means anything |

---

## P19 Rust primer for this project

Written for someone who has not written Rust. Everything here is what *this*
codebase will actually use — nothing more.

### The vocabulary

| Term | Meaning |
| --- | --- |
| **crate** | A compilation unit / library. `worker`, `worker-macros` and your `core` are crates. |
| **package** | A directory with a `Cargo.toml` that builds one or more crates. |
| **workspace** | Several packages built together from one root `Cargo.toml` — that is what `worker/` is. |
| **`cargo`** | The build tool *and* the package manager (like `npm`): `cargo build`, `cargo test`, `cargo fmt`, `cargo clippy`. |
| **target triple** | What you compile *for*. `wasm32-unknown-unknown` is the Workers target; your laptop's default is the host target. |
| **`#[event(fetch)]`** | A macro that wraps your Rust function as the Worker's `fetch` handler. |
| **`Result<T, E>`** | Either success `Ok(T)` or failure `Err(E)`. `worker::Result<Response>` is used throughout. |
| **`?`** | "If this failed, return the error now." Removes most error-handling noise. |
| **`Option<T>`** | A value that may be absent: `Some(x)` or `None`. |
| **`String` vs `&str`** | Owned text vs. a borrowed view of text. You will pass `&str` around and build `String`s. |
| **`struct` / `enum` / `match`** | Rust's data types and its exhaustive switch. `enum CredentialKind { Code, Password, Passkey }` plus `match` is the idiomatic way to express P10's `kind` column — a good first thing to write. |
| **`serde`** | Derive macros that turn structs into JSON and back: `#[derive(Serialize, Deserialize)]`. |
| **`#[cfg(test)] mod tests`** | A test module in the same file: `#[test] fn name() { assert_eq!(…) }`. |
| **derive / traits** | Reusable behaviour (`Clone`, `Debug`, `Serialize`). You will write `#[derive(…)]` and rarely write a trait yourself. |

**You will not need:** `unsafe`, manual memory management, explicit lifetimes,
macros you write yourself, or a threaded async runtime.

### The one surprise if you come from Python/JavaScript

Ownership: a value has exactly one owner, and passing it *moves* it. In practice
the compiler tells you exactly where, the message is unusually good, and the fix
is usually `&` (borrow) or `.clone()` (copy). Expect the first week to be a fight
with `cargo build`, and the second week to be faster than you were in JS.

### Your actual first three Rust files

1. `worker/crates/core/src/code.rs` — generate a code, normalise a typed-in one.
   Pure functions in, pure functions out. Nothing else. `cargo test` it.
2. `worker/crates/core/src/secret.rs` — HMAC + constant-time compare.
3. `worker/crates/app/src/lib.rs` — the router, returning `{"ok":true}` for
   `/api/health`. This is the M0 milestone, and it touches no database at all.

That order means **your first Rust is fully unit-tested before it ever runs in the
cloud**, which is the whole reason for the two-crate split in P8.

### The loop you will actually work in

```powershell
cd worker
cargo test -p core        # milliseconds, no network, no wasm
cargo check               # fast compile check
cargo clippy --all-targets -- -D warnings
cargo fmt
```

Use `wrangler dev` (RUNBOOK R4) only when you need to exercise HTTP, cookies or D1.

### Learning resources

- *The Rust Programming Language* — <https://doc.rust-lang.org/book/> (chapters 1-10
  cover everything above)
- *Rustlings*, small exercises to build the reflexes —
  <https://github.com/rust-lang/rustlings>
- *The Rust Wasm Book* — <https://rustwasm.github.io/docs/book/>
- `workers-rs`, including its `examples/` directory —
  <https://github.com/cloudflare/workers-rs>
- Cloudflare's Rust guide and its supported-crates notes —
  <https://developers.cloudflare.com/workers/languages/rust/>

## P20 Glossary and references

| Term | Meaning in this project |
| --- | --- |
| **assets** | The static files in `dist/` (the games), served by Cloudflare directly. |
| **binding** | Something the Worker can use: `DB` (D1), `ASSETS` (the static files), `PEPPER` (a secret). |
| **D1** | Cloudflare's SQLite database service. |
| **`dist/`** | The Vite build output; the deployable site. |
| **fail-open** | If the backend misbehaves, play continues unaffected. |
| **migration** | A numbered SQL file that changes the schema, applied in order. |
| **player code** | The credential: a 16-character bearer secret ("spillkode"). |
| **revision** | The server-stamped `updated_at` on a progress record; the tie-breaker for sync. |
| **session** | A signed-in browser: a row in `sessions` plus an `HttpOnly` cookie. |
| **`run_worker_first`** | The config that decides which paths invoke the Worker script instead of being served as assets. |
| **Worker** | A Cloudflare serverless function; here it serves `/api/*` only. |
| **`workers-rs`** | The Rust crate that lets you write a Worker in Rust (compiled to WebAssembly). |

**References — worth re-reading before changing a decision:**

- Workers limits / pricing —
  <https://developers.cloudflare.com/workers/platform/limits/>,
  <https://developers.cloudflare.com/workers/platform/pricing/>
- D1 limits / pricing — <https://developers.cloudflare.com/d1/platform/limits/>,
  <https://developers.cloudflare.com/d1/platform/pricing/>
- KV limits — <https://developers.cloudflare.com/kv/platform/limits/>
- Durable Objects pricing —
  <https://developers.cloudflare.com/durable-objects/platform/pricing/>
- Static asset routing (the `run_worker_first` array) —
  <https://developers.cloudflare.com/workers/static-assets/routing/>
- Rust on Workers — <https://developers.cloudflare.com/workers/languages/rust/>
- Wrangler configuration —
  <https://developers.cloudflare.com/workers/wrangler/configuration/>

## P21 Revision log

| Date | Change |
| --- | --- |
| 2026-10-01 | Initial plan written from a design session. Option A (Rust Worker + D1, Workers Free plan) and Path 4 (swappable credential, player code first) chosen. Nothing implemented. |

