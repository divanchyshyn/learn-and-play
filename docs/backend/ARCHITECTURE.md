# Architecture — accounts and cross-device progress

How the shipped system works and why it is built this way. It replaces the plan
that preceded it: the work packages, the milestones and the "not built yet"
notices are gone, and what survives is the part a reader needs in order to change
the thing safely.

| If you want to… | Read |
| --- | --- |
| Understand the shape of the site in one minute | *The shape of the site* |
| Know which file does what | *Where everything lives* |
| Know why a decision was made, or what was rejected | **Decisions, and what was rejected** |
| Change anything about accounts, sessions or passwords | *Accounts* |
| Add or change an endpoint | *HTTP API* |
| Add a game's progress to what syncs | **Progress and sync** |
| Know what the platform forces on you | *Platform limits that shape the design* |
| Set it up, deploy it, back it up, fix it | [`RUNBOOK.md`](./RUNBOOK.md) |
| Know the rules for changing this repository | [`../../AGENTS.md`](../../AGENTS.md) |

## The shape of the site

One Cloudflare Worker serves two entirely different things under one hostname.

```
browser ──> learn-and-play (Worker: edge/)
              ├─ /  and  /games/<slug>/  ──> dist/ assets
              │                              (Cloudflare's asset router: no code runs)
              └─ /api/**  ──> Durable Object ──> Rust service (api/) ──> Postgres (Neon)
                                 ApiContainer      axum + sqlx           accounts, progress
```

- **A game page never invokes code.** `run_worker_first` is scoped to `/api/*`, so
  `/`, `/account/` and every `/games/<slug>/` are served straight from `dist/`.
  That is not an optimisation, it is the central promise: a backend outage can
  only ever mean "accounts are unavailable", never "the games do not load".
- **The games never need an account.** Without one they behave exactly as they
  did before any of this existed: progress saved locally, nothing requested from
  a server.
- **Only `/api/*` reaches Rust.** The Worker's front door (`edge/`) routes those
  requests into a Cloudflare Container through the Durable Object that owns it —
  a container can only be reached through its Durable Object, so that class
  exists whether or not it looks necessary.
- **Two environments, one codebase.** `learn-and-play` serves the live site;
  `learn-and-play-test` serves every pull request on
  `test.play2learn.divanchyshyn.com`, with its own database, its own secrets and
  Cloudflare Access in front of it.

## Where everything lives

| Path | What it is |
| --- | --- |
| `edge/src/index.js` | The Worker entry point: exports the Durable Object and the fetch handler |
| `edge/src/router.js` | Routing, the client-IP header, the 502 fallback — no Cloudflare-only imports, so it is unit-testable |
| `edge/src/container.js` | `ApiContainer`: the Durable Object that starts, warms and stops the container, and hands it the environment |
| `api/src/main.rs` | `serve` and `migrate`; lazy pool; SIGTERM-aware shutdown |
| `api/src/app.rs` | The whole HTTP surface in one function, so tests drive the real router |
| `api/src/domain/` | The rules: passwords, sessions, usernames, rate limits. Pure, unit-tested, no database and no HTTP |
| `api/src/routes/` | The endpoints; they wire `domain` to `store` and nothing else |
| `api/src/store/` | Every SQL statement, one module per table group |
| `api/src/auth.rs` | The `CurrentUser` extractor, the `Origin` check, the rate-limit helpers |
| `api/migrations/` | Numbered SQL, applied in order by `api migrate` |
| `api/sync-keys.json` | The allowlist of keys that may be stored — read by the service at compile time and by the frontend |
| `src/shared/api.js` | `fetch('/api/*')` in one place: a failure is a value, never an exception |
| `src/shared/account.js` | `useAccount()`, the sign-in hint, and every Norwegian error message |
| `src/shared/syncable.js` | Which saved values sync, and how two devices' copies are merged |
| `src/shared/sync.js` | The sync engine: ownership, revisions, debounced pushes, the hydration decision |
| `src/shared/SyncGate.jsx` | The component a game mounts inside; the only place a game can wait for the server |
| `src/account/`, `account/index.html` | The account page — the only page that talks about accounts |
| `wrangler.jsonc`, `wrangler.test.jsonc` | The production and test Workers: assets, container, Durable Object, routes, vars |

## The request path

**Opening a game.** Cloudflare's asset router answers from `dist/`. The game reads
its saved values out of `localStorage` as it mounts. If this browser is signed in
*and* has nothing cached for that account, `SyncGate` first waits — at most 1.5
seconds — for `GET /api/progress`; otherwise the pull happens behind the game.
Nothing about this is visible when it works, and nothing about it can fail loudly
when it does not.

**Creating an account.** `POST /api/account` crosses the front door, which deletes
any client-supplied `X-Client-IP` and sets it from `CF-Connecting-IP`. The
Durable Object starts the container if it is asleep (1–3 seconds), then proxies
the request. Rust validates the username and password, hashes with argon2id, and
inserts the row; a session row is created and its cookie returned through the
Durable Object to the browser. The container stays warm for ten idle minutes.

**Signing in after a quiet night** is the slowest path in the system: container
start (1–3 s) + Neon waking from its five-minute idle suspend (a few hundred ms)
+ one argon2id hash. That is why sessions last a year, and why no game ever waits
on any of it.

## Decisions, and what was rejected

| Decision | Choice | Why |
| --- | --- | --- |
| Where the backend runs | A Cloudflare Container (`api/`), fronted by a Worker | A normal Rust binary with normal tooling, and `cargo test` against a real Postgres |
| Where the data lives | Postgres on Neon | A container cannot use Cloudflare bindings (see *Platform limits*), and an external Postgres is the ordinary answer |
| How the browser reaches it | Same origin, `/api/*` on the site's own Worker | No CORS, no `SameSite=None`, no second hostname to keep in step |
| The credential | Username + password | A password hash is only as expensive as the machine allows, and the machine now allows argon2id |
| Password storage | argon2id, OWASP's minimum parameters, plus a pepper | Memory-hard, and useless to an attacker who only has the database |
| The session | A 256-bit token in a `__Host-` cookie; only its SHA-256 is stored | A dump of `sessions` yields nothing that can be presented as a cookie |
| Recovery | **None**, on purpose | There is no email address, so there is no verified way back in. The sign-up page says so |
| What syncs | Things a child has earned | A session in progress is a moment, not progress |
| Where the truth lives | Postgres, with `localStorage` as a cache | Progress follows a child to another device without a game ever waiting for the network |
| Conflicts | Optimistic revisions, merged with unions | A device that was offline for a week cannot wipe the device that stayed online |
| The test environment | A second Worker, deployed from pull requests | A change can be tried on a tablet before anyone approves it |
| GitHub Pages | Retired | Accounts need `/api/*`, which cannot exist on `github.io` |

**Rejected, and why** — these are the questions a reader will ask, so they are
answered here rather than rediscovered:

- **Rust compiled to WebAssembly in the Worker, with D1.** The Cloudflare-native
  pairing, and it would put the database one function call away. Rejected in
  favour of running Rust normally; the CPU ceiling that once made WASM attractive
  is gone either way.
- **Keeping D1 and reaching it from the container.** A container has no bindings,
  so this needs either an outbound handler in the front door (every query becomes
  an HTTP round trip through JavaScript, and the data layer stops being testable
  from `cargo`) or an account-scoped D1 token inside the container. Both were
  rejected as more machinery for a worse developer experience.
- **SQLite inside the container.** The container's disk is ephemeral — a fresh
  disk from the image on every start — so this loses every account on the first
  sleep unless something replicates it out. Not acceptable for accounts.
- **Email + password with verification and reset.** Designed, then dropped at the
  owner's request. It would have added an email provider, a sending subdomain,
  DNS records and the only personal data in the system — and it would have made
  password recovery possible. The trade is stated plainly rather than hidden:
  **a forgotten password loses the account.**

## Accounts

**Usernames.** 3–20 characters; must start with an ASCII letter, then letters,
digits, `-` or `_`. Stored as typed, matched without regard to case (the unique
index is on `lower(username)`). A short list of names is reserved. ASCII-only on
purpose: it is a login handle typed on a tablet keyboard, and staying inside
ASCII removes homoglyphs, normalisation forms and width differences from an
identifier that is compared for equality.

**Passwords.** 8–128 bytes. No composition rules, no Unicode normalisation
(OWASP: do not reduce the input space), and a byte cap so a huge request cannot
become CPU. A password is never shown, never logged, and never recoverable.

**Hashing.** argon2id at m = 19456 KiB, t = 2, p = 1, salted per password, and
peppered: the deployment's `PEPPER` is digested with SHA-256 and used as argon2's
secret key. A stolen dump therefore cannot be attacked without a value that lives
only in the Worker's environment. **Rotating the pepper invalidates every stored
password**, which is why the runbook treats it as permanent.

**Sessions.** A 256-bit token from the OS random generator, base64url-encoded,
sent in `__Host-lap_sid` — `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no
`Domain`, `Max-Age` one year. What the database holds is `sha256(token)`. The
expiry rolls forward as the session is used, at most one write per hour. Signing
out deletes the row and clears the cookie; changing the password deletes every
*other* session.

**Threat notes.**

- A wrong password and an unknown username produce the same body, the same status
  and the same work: an unknown username runs a verification against a decoy hash
  so the clock cannot answer what the response refuses to. Sign-up is *not*
  enumeration-protected — with usernames and no email, "that username is taken"
  leaks nothing and saves a child from a dead end.
- Failures are counted per client address (20 in 15 minutes) and per username (8),
  and **checked before argon2 runs**, so guessing cannot be turned into a denial
  of service. A block starts at 5 minutes and doubles to an hour. Counters, never
  lockouts: the window passes and the account works again with no help.
- Every `POST`/`PUT`/`PATCH`/`DELETE` must carry this site's `Origin`;
  `SameSite=Lax` is the second lock on the same door. `PUBLIC_ORIGIN` must be set
  for those requests to be accepted at all.
- Account responses carry `Cache-Control: no-store`.
- The only header trusted for a client address is `X-Client-IP`, which the front
  door writes from `CF-Connecting-IP` after deleting whatever the caller sent.
  `X-Forwarded-For` is never read.

**What is stored, in full:** a UUID, the chosen username, the argon2id hash, the
timestamps, the session rows, the progress blobs, and the rate-limit counters.
No email address, no real name, no birthday, no analytics. `AGENTS.md` makes that
a rule rather than a coincidence.

## Data model

```sql
users          (id uuid pk, username text, password_hash text, created_at, updated_at)
                 unique index on lower(username); username trimmed, 3-20 chars
sessions       (token_hash bytea pk, user_id -> users on delete cascade,
                 created_at, last_seen_at, expires_at)
progress       (user_id -> users on delete cascade, record_key text, payload text,
                 revision bigint default 1, updated_at, primary key (user_id, record_key))
                 check octet_length(payload) <= 65536
auth_attempts  (key text pk, window_start, failures int, blocked_until)
```

Three constraints do real work: `ON DELETE CASCADE` makes "delete my account" one
statement that also removes every session and every progress record (the test
asserts the tables are empty afterwards); the unique index on `lower(username)`
is what makes `Kim` and `kim` one account; and the payload check is the size cap
enforced by the database rather than only by a handler.

## HTTP API

| Method | Path | Body | Answer |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{ ok, db }` with `db` = `up` \| `down` \| `unconfigured`; no auth, and `X-Robots-Tag: noindex` when `NOINDEX=1` |
| `POST` | `/api/account` | `{ username, password }` | `201 { username }` + session cookie; `409` when taken |
| `POST` | `/api/session` | `{ username, password }` | `200 { username }` + cookie; one uniform `401`; `429` when throttled |
| `DELETE` | `/api/session` | — | `204`, row deleted, cookie cleared |
| `GET` | `/api/me` | — | `{ signedIn, username? }` |
| `POST` | `/api/password` | `{ currentPassword, newPassword }` | `204`; keeps this session, drops the others |
| `DELETE` | `/api/account` | `{ password }` | `204`; cascades |
| `GET` | `/api/progress` | — | `{ records: [{ key, payload, revision }] }` |
| `PUT` | `/api/progress` | `{ records: [{ key, payload, baseRevision }] }` | `{ accepted: [...], conflicts: [...] }` |

Cross-cutting rules: every error is JSON with a stable code and the same shape;
`record_key` must be in `api/sync-keys.json`; a payload is capped at 64 KiB and a
request at 20 records; `revision` may not be negative; the service **never parses
a payload** — validating it is the client's job, using the codecs that already
exist, so a corrupt stored value cannot break a game.

`GET /api/health` answers `ok` whenever the process is alive and reports the
database separately: a container that refused to start because Neon was asleep
would be a container that could not serve the pages which never needed Neon.

## Progress and sync

**What follows a child between devices** is what they have earned:

| Key | Syncs | Never syncs |
| --- | --- | --- |
| `soundLabyrinth:gallery` — pictures assembled | ✅ | |
| `wordFishing:journal` — words caught, trips, decorations | ✅ | |
| `cardBattle:album` — animals found | ✅ | |
| `soundLabyrinth:progress`, `soundLabyrinth:game` — the maze being walked | | ❌ |
| `wordFishing:trip` — the trip in progress | | ❌ |
| every `<game>:muted` | | ❌ |

In-progress sessions stay on the device that was playing: a stale trip copied
from another device would drop a child onto a boat with the wrong crates. A muted
tablet does not mean a muted laptop.

**Merging** happens in the browser, in `syncable.js`, with the games' own codecs.
Every synced value is monotonic — a word caught cannot be un-caught — so every
merge is an order-preserving union: the worst case is that a device learns
something it did not know, and no case loses progress. `trips` takes the higher
count, and the gallery's `round` is not merged at all: it is rebuilt by replaying
the game's own `recordSeenImage` over the unioned list, so a merged gallery
behaves exactly like one a child built locally.

**Revisions** are the server's, never a device clock. The client remembers the
revision it last saw per key, sends it as `baseRevision`, and the write lands only
when it matches — then the revision goes up by one. Otherwise the answer carries
the server's row as a conflict, the client merges again and tries once more.

**Ownership** is what protects two children sharing a tablet. Local state carries
`sync:owner`:

| Situation | What happens |
| --- | --- |
| Sign in as this browser's account | normal pull, merge, push |
| Sign in (or sign up) on a device that played anonymously | what is here is **uploaded** — it is about to become this account's progress |
| Sign in as a different account on a device that holds another's cache, or a signed-out one | the cached records are **dropped** before pulling, so one child's progress can never land in another's account |
| Sign out | the cache stays (play continues), the owner becomes `detached`, syncing stops |
| Delete the account | the cached records go too |

**The hydration gate.** `SyncGate` waits for the database only when this device
has no cache for the signed-in account, and never longer than 1.5 seconds. The
library page starts the pull as soon as it loads, so by the time a child opens a
game the cache is usually warm and the gate resolves immediately.

**Failure is invisible.** Not signed in means no requests at all. A network error
or a slow service is swallowed, retried on the next change or the next page load,
and a game renders from its cache. There is no dialog, toast or spinner tied to
syncing anywhere in the app.

**Pushes** are debounced by two seconds after the child stops writing, and flushed
when the page is hidden. Only records that actually changed are sent, and a
conflict costs one extra round trip.

## Platform limits that shape the design

- **A container cannot use Cloudflare bindings.** Bindings are objects the Workers
  runtime injects into an isolate; D1 has no public SQL endpoint a foreign process
  could authenticate to. That single fact is why the database is external and why
  the schema, migrations and queries live in Rust rather than in the front door.
- **The container's disk is ephemeral** and there are no persistent volumes, so
  nothing may be stored on it. Postgres is the only durable thing.
- **Cold start is 1–3 seconds** and `sleepAfter` is ten minutes. Only `/api/*`
  pays it; the games are served by the asset router.
- **Shutdown is graceful**: SIGTERM, then up to fifteen minutes before SIGKILL —
  which is why `main.rs` installs a signal handler.
- **Cloudflare Access** protects the test hostname, assets included. It is a gate,
  not authentication for the app: accounts on the test environment are ordinary
  accounts in the test database.
- **`_headers` is honoured for static assets but not for Worker-generated
  responses**, so the API sets its own `X-Robots-Tag: noindex` from `NOINDEX`.
- **Neon suspends a free-tier compute after five minutes idle** and has a short
  restore window, which is why `pg_dump` runs nightly to R2 and why the service
  opens its pool lazily instead of refusing to start without a database.

## What it costs

Workers Paid is $5/month and includes 30 M CPU-ms, 10 M requests, and — for
containers — 25 GiB-hours of memory, 375 vCPU-minutes and 200 GB-hours of disk.
A `lite` instance (1/16 vCPU, 256 MiB, 2 GB) bills memory and disk while awake,
and CPU only as used:

| | `lite` (in use) | `basic` (the fallback) |
| --- | --- | --- |
| Awake hours inside the allowance | ~100 h/month | ~25 h/month |
| Extra cost per awake hour | ~$0.003 | ~$0.010 |
| A hobby month (~45–60 h awake) | inside the allowance | ≈ $0.35 |

The only CPU-bound work in the service is the argon2 hash, measured at **21 ms on
a full core** — roughly 350 ms on a sixteenth of one. If a real measurement on the
live instance ever exceeds about 1.5 s, `"instance_type": "basic"` in both
`wrangler` files is the whole fix. The database is on Neon's free tier and backups
are a few hundred kilobytes in R2; there is no email provider to pay for.

## Working on the Rust service

Rust here is ordinary Rust: no `unsafe`, no manual memory management, no explicit
lifetimes, no WebAssembly target. `cargo` is both the package manager and the
build tool, `Result` plus `?` carries errors, and `#[sqlx::test]` gives a test its
own throwaway database.

The habit worth keeping: **rules go in `domain/`, SQL goes in `store/`, and
`routes/` only wires the two together.** A rule inside a handler is a rule no test
can reach cheaply.

The loop:

```powershell
docker compose up -d db                # local Postgres
cargo test --manifest-path api/Cargo.toml
cargo clippy --manifest-path api/Cargo.toml --all-targets -- -D warnings
cargo run  --manifest-path api/Cargo.toml -- migrate
```

On this Windows machine, `cargo` cannot run directly: Smart App Control blocks
freshly built unsigned binaries (build scripts included), so the Rust gates are
run inside the `rust:1-bookworm` image. The one-line invocation is in
`RUNBOOK.md` → R0, together with the alternatives (turning that feature off, or
WSL2). CI on Linux is unaffected.

## Changing things

| To do this | Touch this |
| --- | --- |
| Add a game whose progress should follow a child | Add its key to `api/sync-keys.json`, add a merge rule in `src/shared/syncable.js`, and wrap the game's entry point in `SyncGate` |
| Stop syncing a key | Remove it from `api/sync-keys.json` and from the registry. The server keeps the stored rows; a client simply stops asking for them |
| Add an endpoint | A handler in `api/src/routes/`, its rules in `api/src/domain/` if it has any, its SQL in `api/src/store/`, and mount the router in `api/src/app.rs` |
| Change a schema | A **new** file in `api/migrations/`. Never edit an applied one: its checksum is recorded |
| Make the service faster on sign-in | `"instance_type": "basic"` in `wrangler.jsonc` and `wrangler.test.jsonc` |
| Change what the games see | Nothing here. They are static assets and must keep working with this service stopped |
| Rotate a secret | `wrangler secret put` per Worker; remember that `PEPPER` cannot be rotated without invalidating every password |
| Point the test environment at something else | `wrangler.test.jsonc` (its own Worker, hostname, database and secrets) |

## History

This backend was designed before it was built, in a plan that went through two
revisions: the first assumed the Workers free plan, where a 10 ms CPU ceiling
made a properly expensive password hash impossible and the credential was a
player code with no password at all. Buying Workers Paid removed that ceiling,
and the plan was rewritten around a container, an ordinary Rust service, and
username + password accounts with no email anywhere in the system.

Three things changed while building it, and the commits say so where they
happened: the shared key list moved from the repository root into `api/` (the
container image is built from that directory, so a file outside it cannot be read
at compile time); the coverage baseline was re-measured and recorded with its
reason; and the plan document itself was replaced by this one.

The plan and its work packages are deliberately gone. Each package was one
commit, so the history is the record — `git log --oneline main..feature/rust-backend`
lists the whole build in fifteen lines.

## References

- `RUNBOOK.md` — setup, deploy, migrations, secrets, backup, rollback, troubleshooting
- `AGENTS.md` — the rules for changing this repository, including what may not be added without a human decision
- `docs/audit/BASELINE.md` — the measured build, lint, test and coverage gate
- Workers limits and pricing — <https://developers.cloudflare.com/workers/platform/limits/>, <https://developers.cloudflare.com/workers/platform/pricing/>
- Containers: configuration, images, limits, pricing — <https://developers.cloudflare.com/containers/configuration/wrangler/>, <https://developers.cloudflare.com/containers/guides/image-management/>, <https://developers.cloudflare.com/containers/platform/limits/>, <https://developers.cloudflare.com/containers/platform/pricing/>
- Static assets: routing and headers — <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>, <https://developers.cloudflare.com/workers/static-assets/headers/>
- Cloudflare Access for Workers — <https://developers.cloudflare.com/workers/configuration/cloudflare-access/>
- Neon free tier and compute lifecycle — <https://neon.com/pricing>, <https://neon.com/docs/introduction/compute-lifecycle>
- OWASP Password Storage Cheat Sheet — <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- OWASP Session Management Cheat Sheet — <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
