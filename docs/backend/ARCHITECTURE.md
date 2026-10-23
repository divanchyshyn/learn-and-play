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
| Know what it costs, and what would cost money | *What it costs* |
| Set it up, deploy it, back it up, fix it | [`RUNBOOK.md`](./RUNBOOK.md) |
| Know the rules for changing this repository | [`../../AGENTS.md`](../../AGENTS.md) |

## The shape of the site

One Cloudflare Worker serves two entirely different things under one hostname.
Cloudflare is on the **Free plan**; the Rust service runs on **Google Cloud Run**
on the always-free tier; Postgres is **Neon free**.

```
browser ──> learn-and-play (Worker: edge/)                    Cloudflare Free plan
              ├─ /, /account/, /games/<slug>/  ──> dist/ assets
              │                                    (asset router: no code runs,
              │                                     free and unlimited)
              └─ /api/**  ──> Worker script (100k req/day)
                                │  adds X-Door-Secret,
                                │  rewrites X-Client-IP from CF-Connecting-IP
                                ▼
                          Rust service (api/)                Cloud Run, us-central1
                          axum + sqlx                        scale to zero, max 2
                                │
                                ▼
                          Postgres (Neon)                    free plan, US East
                          accounts, progress
```

- **A game page never invokes code.** `run_worker_first` is scoped to `/api/*`,
  so `/`, `/account/` and every `/games/<slug>/` are served straight from
  `dist/`. That is not an optimisation, it is the central promise: a backend
  outage can only ever mean "accounts are unavailable", never "the games do not
  load". On the Free plan it also means the games are free and unlimited even
  when the API's daily request allowance is exhausted.
- **The games never need an account.** Without one they behave exactly as they
  did before any of this existed: progress saved locally, nothing requested from
  a server.
- **Only `/api/*` reaches Rust.** The Worker script forwards those requests to
  the service's Cloud Run URL. Cloud Run gives that service a public `.run.app`
  address, so the Worker also sends a **door secret**; the service refuses a
  request that does not carry it. That is what keeps `X-Client-IP` (and therefore
  the rate limiter) trustworthy.
- **One environment.** The pull-request test hostname and Cloudflare Access were
  retired with the paid stack. `learn-and-play` serves the live site; pull
  requests are verified by CI and locally, and the `production` environment's
  required reviewer is the only deploy gate.

## Where everything lives

| Path | What it is |
| --- | --- |
| `edge/src/index.js` | The Worker entry point: one fetch handler, no Durable Object |
| `edge/src/router.js` | Routing, the proxy, the `X-Client-IP` and door-secret headers, the 502/503 fallbacks — no Cloudflare-only imports, so it is unit-testable |
| `api/src/main.rs` | `serve` and `migrate`; lazy pool; SIGTERM-aware shutdown |
| `api/src/app.rs` | The whole HTTP surface in one function, so tests drive the real router |
| `api/src/domain/` | The rules: passwords, sessions, usernames, rate limits. Pure, unit-tested, no database and no HTTP |
| `api/src/routes/` | The endpoints; they wire `domain` to `store` and nothing else |
| `api/src/store/` | Every SQL statement, one module per table group |
| `api/src/auth.rs` | The `CurrentUser` extractor, the `Origin` check, the front-door check, the rate-limit helpers |
| `api/migrations/` | Numbered SQL, applied in order by `api migrate` |
| `api/sync-keys.json` | The allowlist of keys that may be stored — read by the service at compile time and by the frontend |
| `src/shared/api.js` | `fetch('/api/*')` in one place: a failure is a value, never an exception |
| `src/shared/account.js` | `useAccount()`, the sign-in hint, and every Norwegian error message |
| `src/shared/syncable.js` | Which saved values sync, and how two devices' copies are merged |
| `src/shared/sync.js` | The sync engine: ownership, revisions, debounced pushes, the hydration decision |
| `src/shared/SyncGate.jsx` | The component a game mounts inside; the only place a game can wait for the server |
| `src/account/`, `account/index.html` | The account page — the only page that talks about accounts |
| `wrangler.jsonc` | The Worker: assets, `run_worker_first`, the `API_BASE_URL` var |
| `.github/workflows/deploy.yml` | Verify, migrate, build/push the image, deploy Cloud Run, deploy the Worker, smoke-check — behind the `production` approval gate |

## The request path

**Opening a game.** Cloudflare's asset router answers from `dist/`. The game reads
its saved values out of `localStorage` as it mounts. If this browser is signed in
*and* has nothing cached for that account, `SyncGate` first waits — at most 1.5
seconds — for `GET /api/progress`; otherwise the pull happens behind the game.
Nothing about this is visible when it works, and nothing about it can fail loudly
when it does not.

**Creating an account.** `POST /api/account` crosses the Worker, which deletes
any client-supplied `X-Client-IP` and `X-Door-Secret`, sets them from
`CF-Connecting-IP` and the deployment's secret, and forwards the request to Cloud
Run. The service checks the door secret, validates the username and password,
hashes with argon2id, inserts the row and returns a session cookie; the Worker
passes the `Set-Cookie` header back untouched. Cloud Run may need a second or two
to start an instance if the service is cold.

**Signing in after a quiet night** is the slowest path in the system: Cloud Run
cold start (a second or two) + Neon waking from its five-minute idle suspend (a
few hundred milliseconds) + one argon2id hash. That is why sessions last a year,
why the browser's API timeout is eight seconds, and why no game ever waits on any
of it.

## Decisions, and what was rejected

| Decision | Choice | Why |
| --- | --- | --- |
| Where the backend runs | Google Cloud Run (free tier), fronted by a Cloudflare Worker | A normal Rust container with normal tooling; scale to zero keeps it inside the always-free allowance; no paid Cloudflare plan |
| Where the data lives | Postgres on Neon (free plan) | A managed Postgres with a real connection string and `cargo test` against a real database; no Cloudflare bindings available to a container anyway |
| How the browser reaches it | Same origin, `/api/*` on the site's own Worker | No CORS, no `SameSite=None`, no second hostname to keep in step |
| The credential | Username + password | A password hash is only as expensive as the machine allows, and Cloud Run allows argon2id |
| Password storage | argon2id, OWASP's minimum parameters, plus a pepper | Memory-hard, and useless to an attacker who only has the database |
| The session | A 256-bit token in a `__Host-` cookie; only its SHA-256 is stored | A dump of `sessions` yields nothing that can be presented as a cookie |
| Recovery | **None**, on purpose | There is no email address, so there is no verified way back in. The sign-up page says so |
| What syncs | Things a child has earned | A session in progress is a moment, not progress |
| Where the truth lives | Postgres, with `localStorage` as a cache | Progress follows a child to another device without a game ever waiting for the network |
| Conflicts | Optimistic revisions, merged with unions | A device that was offline for a week cannot wipe the device that stayed online |
| How the service is reached | Same-origin Worker proxy + a shared door secret | Keeps cookies first-party, keeps the public `run.app` address closed, and keeps `X-Client-IP` trustworthy |
| The hosting split | Cloudflare for assets and the proxy; Cloud Run for Rust | Static assets are free and unlimited on the Free plan; only `/api/*` needs a server |
| The test environment | Retired | It existed to try a change on a tablet; for a rarely used learning project it doubled the services, secrets and setup |
| Backups | Neon's 6-hour restore and one manual snapshot, plus a manual dump before risky work | The nightly R2 dump was retired with the paid stack; the limitation is stated in the runbook rather than hidden |

**Rejected, and why** — these are the questions a reader will ask, so they are
answered here rather than rediscovered:

- **Cloudflare Containers.** The reason this repository was on Workers Paid: a
  container could only run there. The product is good, but the point of this
  migration is not to pay $5/month for a site used rarely. Google Cloud Run does
  the same job inside an always-free allowance, so the container moved and
  Cloudflare went back to Free.
- **Rust compiled to WebAssembly in the Worker, with D1.** The Cloudflare-native
  pairing would avoid Cloud Run, but the Worker's CPU ceiling and the migration
  of the SQL layer make it a rewrite, not a migration.
- **Keeping D1 and reaching it from Cloud Run.** A Cloud Run service has no
  Cloudflare bindings, so every query would become an HTTP round trip through
  JavaScript, and the data layer would stop being testable from `cargo`.
- **SQLite inside the container.** Cloud Run's disk is ephemeral — a fresh disk
  from the image on every cold start — so this loses every account on the first
  scale-to-zero unless something replicates it out. Not acceptable for accounts.
- **A separate `api.play2learn…` hostname.** It would need CORS, and the session
  cookie would need `SameSite=None`, which weakens exactly the property the
  current design gets for free by staying on one origin.
- **Long-lived Google service-account keys in GitHub.** Workload Identity
  Federation gives CI a short-lived token for this repository on `refs/heads/main`
  only, and the deployer binding is scoped to that `ref` attribute, so a feature
  branch cannot impersonate the deployer. There is no key to leak or rotate.
- **Email + password with verification and reset.** Designed, then dropped at the
  owner's request. It would have added an email provider, a sending subdomain,
  DNS records and the only personal data in the system — and it would have made
  password recovery possible. The trade is stated plainly rather than hidden:
  **a forgotten password loses the account.**
- **Cloudflare Access for a test copy.** It was a good fit while a test Worker
  existed; with that environment gone it is another product to maintain for no
  benefit.

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
only in Secret Manager. **Rotating the pepper invalidates every stored password**,
which is why the runbook treats it as permanent.

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
- **The counters hold no raw address.** The key is a SHA-256 digest of the client
  address, never the address itself; counters older than the 24-hour retention
  window are deleted whenever a counter is written. They recognise a returning
  client, not a person.
- **Sign-in accepts only the credential shape sign-up allows**: the username is
  validated (3–20 ASCII characters) and the password is capped at 128 bytes
  before either is used as a counter key, a lookup or argon2 input. Anything else
  gets the same uniform `401` and is still counted against the address, so a huge
  request cannot become CPU or an over-long index key.
- **Account creation has its own per-address budget** (10 accounts in a window),
  counted on success: an account costs a hash and a row, so open registration is
  bounded without punishing a family that mistypes a taken name.
- **Changing the password and deleting the account confirm the current password
  through the same counters**: an open session is not an unlimited oracle.
- **A successful sign-in clears only the username counter.** The address counter
  expires with its window; clearing it too would let one valid account reset an
  attacker's address budget between guesses at somebody else's password.
- **Parallel failures each count**: the increment is one row-locked transaction,
  not a `load`/`save` in the handler, so a concurrent batch cannot collapse into
  a single failure.
- Every `POST`/`PUT`/`PATCH`/`DELETE` must carry this site's `Origin`;
  `SameSite=Lax` is the second lock on the same door. `PUBLIC_ORIGIN` must be set
  for those requests to be accepted at all.
- Every request must carry the front door's `X-Door-Secret` **when `DOOR_SECRET`
  is configured**. The Worker deletes whatever a caller sent and writes the
  deployment's value, so a matching header is evidence the request came through
  Cloudflare; a direct caller cannot use the rate limiter's IP trust to choose
  its own address. The secret is compared in constant time.
- Every API response carries `Cache-Control: no-store`, successful ones included.
- The only header trusted for a client address is `X-Client-IP`, which the front
  door writes from `CF-Connecting-IP` after deleting whatever the caller sent.
  `X-Forwarded-For` is never read.
- When `NOINDEX` is set (the production service does), every API response carries
  `X-Robots-Tag: noindex`.

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

Two headers are transport details, not part of the public API: `X-Client-IP`
(written by the Worker) and `X-Door-Secret` (written by the Worker, checked by
the service). A request that reaches Cloud Run without the door secret is
answered `403 {"error":"front_door_required"}`.

`GET /api/health` answers `ok` whenever the process is alive and reports the
database separately: a service that refused to start because Neon was asleep
could not even say why it was unavailable, and the games never needed it.

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

**Timeouts.** The client aborts an API request after **8 seconds** (cold start
plus Neon wake plus the request); the hydration gate's 1.5 seconds is the only
deadline a child can ever feel. Pushes are debounced by two seconds after the
child stops writing, and flushed when the page is hidden. Only records that
actually changed are sent, and a conflict costs one extra round trip.

## Platform limits that shape the design

- **Cloud Run scales to zero.** The first request after idle waits for an
  instance to start; `--min-instances` stays at 0 because a warm instance is
  billed around the clock. The service must boot without a reachable database for
  the same reason: `/api/health` has to answer even while Neon is suspended.
- **Cloud Run request-based billing.** The free allowance counts memory and vCPU
  per request; `--max-instances 2` is the cost ceiling. A monitor or keep-warm
  ping would defeat the allowance, so there is deliberately none.
- **Cloud Run's public address is real.** `--allow-unauthenticated` is required
  because Cloudflare has no Google identity, and that makes the door secret
  necessary rather than optional. It is a shared secret between the Worker and
  the service, never present in the browser.
- **The service's disk is ephemeral.** Nothing durable may live on the container
  filesystem; Postgres is the only durable store.
- **Shutdown is graceful.** Cloud Run sends SIGTERM and allows a short grace
  period before SIGKILL, which is why `main.rs` installs a signal handler and the
  Dockerfile runs the binary in exec form.
- **Cloudflare Workers Free** allows 100,000 Worker requests/day and 10 ms of CPU
  per invocation; static asset requests are free and unlimited. Only `/api/*`
  invokes code, and proxying is I/O-bound, so the CPU ceiling is irrelevant. If
  the daily cap is ever hit, `/api/*` answers an error while the games keep
  loading: fail-open is a property of the split, not a promise in a handler.
- **Neon suspends a free-tier compute after five minutes idle** and keeps a
  six-hour restore window and one manual snapshot. That is why the service opens
  its pool lazily and checks a connection before handing it out, and why the
  runbook says a manual dump is the only durable backup.
- **`_headers` is honoured for static assets but not for Worker-generated
  responses**, so the API sets its own `X-Robots-Tag: noindex` from `NOINDEX`.

## What it costs

Everything in this design fits the always-free allowances; the bill should be
**$0.00**. The numbers are current as of the migration and are linked rather than
trusted:

| Service | Free allowance | This site |
| --- | --- | --- |
| Cloud Run (request-based) | 2,000,000 requests, 360,000 GB-seconds, 180,000 vCPU-seconds, 1 GB egress from North America per month | a family's API traffic is a rounding error; the service spends most of its life scaled to zero |
| Cloudflare Workers Free | 100,000 Worker requests/day; static assets free and unlimited | only `/api/*` counts |
| Neon Free | 100 CU-hours per project/month, 1 GB storage, 5 GB transfer, scale to zero after 5 min | a small fraction of the compute hours |
| Artifact Registry | 0.5 GB-month | three images at most, via the cleanup policy |
| Secret Manager | 6 active versions, 10,000 access operations/month | three secrets read at instance start |
| Cloud Logging | 50 GiB/month | request logs only, never bodies |
| GitHub Actions | free for public repositories | CI and the deploy |

What would cost money: a minimum instance, a keep-warm monitor, a region outside
North America (egress stops being free), more than two instances, images
accumulating past 0.5 GB, or Neon past 100 CU-hours. The runbook's R12 lists them
with the guardrail for each.

**Google Cloud still needs a billing account and a payment method**, and a new
account usually starts on a $300 / 90-day free trial. The trial must be upgraded
to a paid billing account before it ends, or the project is stopped and its
resources are deleted after a 30-day grace period. The always-free allowances
apply after the upgrade too; the card is a platform requirement, not a
subscription. Cloudflare, Neon and GitHub need no paid plan.

There is no email provider to pay for and no analytics. A manual `pg_dump` costs
nothing; an automated one was removed deliberately.

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
`RUNBOOK.md` → R0.4. CI on Linux is unaffected.

The front door has its own tests in `edge/src/router.test.js`: they stub the
global `fetch`, so the routing, the header hygiene, the `Set-Cookie` handling and
the two JSON failure modes are proven without Cloudflare's runtime or a real
service.

## Changing things

| To do this | Touch this |
| --- | --- |
| Add a game whose progress should follow a child | Add its key to `api/sync-keys.json`, add a merge rule in `src/shared/syncable.js`, and wrap the game's entry point in `SyncGate` |
| Stop syncing a key | Remove it from `api/sync-keys.json` and from the registry. The server keeps the stored rows; a client simply stops asking for them |
| Add an endpoint | A handler in `api/src/routes/`, its rules in `api/src/domain/` if it has any, its SQL in `api/src/store/`, and mount the router in `api/src/app.rs` |
| Change a schema | A **new** file in `api/migrations/`. Never edit an applied one: its checksum is recorded |
| Move the service | Update `API_BASE_URL` in `wrangler.jsonc`, and keep `PUBLIC_ORIGIN` the site's origin |
| Rotate the door secret | A new `lap-door-secret` version, a new revision, `wrangler secret put API_DOOR_SECRET` with the same value, and a redeploy of the Worker — both sides in one window |
| Change what the service is allowed to cost | The `--min-instances` / `--max-instances` / `--memory` flags in `.github/workflows/deploy.yml` and the manual deploy in the runbook |
| Change what the games see | Nothing here. They are static assets and must keep working with this service stopped |
| Rotate a secret | Secret Manager for `DATABASE_URL` / `DOOR_SECRET`; remember that `PEPPER` cannot be rotated without invalidating every password |
| Back up the database | There is no scheduled job. Take a Neon snapshot/branch or a manual `pg_dump` (`RUNBOOK.md` → R13) |
| Remove the backend entirely | Revert the `/api/*` code and deployment, delete the Cloud Run service, the repository and the secrets. The games are unaffected |

## History

The backend was first built on Cloudflare Containers, which required Workers
Paid. That design was sound — a Rust container fronted by a Worker, with Neon as
the database — but it was paid for a site used rarely. The owner moved the
container to **Google Cloud Run's always-free tier**, kept the database on
**Neon**, and returned Cloudflare to the **Free plan** as the host and proxy.

Three things went with the paid stack, all deliberately: the pull-request test
environment (a second Worker, hostname, Neon database and container), Cloudflare
Access, and the nightly `pg_dump` to R2. The test environment is replaced by CI
and local runs; backups are now Neon's restore window and a manual snapshot,
which is a real reduction in safety and is recorded as such. The original plan
document and its work packages are gone; the commits are the record.

## References

- `RUNBOOK.md` — setup, deploy, migrations, secrets, backup, rollback, troubleshooting
- `AGENTS.md` — the rules for changing this repository, including what may not be added without a human decision
- `docs/audit/BASELINE.md` — the measured build, lint, test and coverage gate
- Cloud Run: deploying, scaling, secrets, billing — <https://cloud.google.com/run/docs>, <https://cloud.google.com/run/pricing>, <https://cloud.google.com/free/docs/free-cloud-features>
- Workload Identity Federation — <https://cloud.google.com/iam/docs/workload-identity-federation>
- Artifact Registry — <https://cloud.google.com/artifact-registry/docs>, <https://cloud.google.com/artifact-registry/pricing>
- Cloudflare Workers Free limits and static assets — <https://developers.cloudflare.com/workers/platform/limits/>, <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>
- Cloudflare Workers static assets routing — <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>
- Neon free plan and compute lifecycle — <https://neon.com/faqs/free-plan-limits-and-quotas>, <https://neon.com/docs/introduction/compute-lifecycle>
- OWASP Password Storage Cheat Sheet — <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- OWASP Session Management Cheat Sheet — <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
