# Backend runbook — username accounts and database progress (Rust container + Postgres)

> **Status: nothing has been built yet.** This runbook is the execution guide for
> [`PLAN.md`](./PLAN.md). Read `PLAN.md` P2 (decisions), P7 (accounts and
> argon2id) and P11 (progress rules) once, then work from here.
>
> Everything is written for **Windows PowerShell**. Use `npm.cmd` (not `npm`) in
> this repo — the execution policy can block `npm.ps1`. Use `curl.exe` (with the
> extension) so you get the real curl instead of PowerShell's
> `Invoke-WebRequest` alias. `npx wrangler` is available because `wrangler` is a
> pinned devDependency (C5).

## How to use this runbook

Steps are numbered **R0 … R14**, and each ends with a **✅ Check**. Do not move
on from a failed check: every step is designed to fail loudly and early.

### Jump table

| Step | What it does | Serves | Time |
| --- | --- | --- | --- |
| **R0** | Toolchain: Rust, Docker, wrangler, database client | C3 | 20-40 min |
| **R1** | Neon: project, two databases, connection strings | C6, C7 | 15 min |
| **R2** | Cloudflare: plan, API token, the test hostname | C5, C6 | 20 min |
| **R3** | Cloudflare Access for the test environment (+ service token) | C6 | 15 min |
| **R4** | Repo wiring: what C3 – C5 create, and the local env file | C3 – C5 | 30 min |
| **R5** | Local development: Postgres in Docker, `cargo run`, `wrangler dev` | C3 – C9 | 20 min |
| **R6** | Migrations, local and remote | C7 | 15 min |
| **R7** | Secrets per environment (test and production) | C8, C13 | 10 min |
| **R8** | CI and deploy workflows | C4, C6, C13 | 45 min |
| **R9** | Verification checklist for every milestone | all | 20 min |
| **R10** | Backup and restore (nightly `pg_dump` to R2) | C12 | 20 min |
| **R11** | Rollback and recovery | all | — |
| **R12** | Troubleshooting table | all | — |
| **R13** | Command cheat sheet | all | — |
| **R14** | Permissions: the coding agent's bash allowlist | C4 | 10 min |

### Milestone → steps

| Milestone (PLAN P16) | Steps |
| --- | --- |
| **M0** — container deployed to the test hostname, games untouched | R0, R2 (partial), R4, R5, R8 (test workflow), R9 (M0 block) |
| **M1** — Postgres, schema, migrations | R1, R6, R9 (M1 block) |
| **M2** — accounts round trip | R2 (Access), R3, R7, R9 (M2 block) |
| **M3** — progress sync end to end | R5, R9 (M3 block) |
| **M4** — backups, cutover, Pages retirement | R10, R11, R9 (M4 block) |

### The one rule that must never be broken

**A game must never break because the backend is down.** If any step makes a
game show an error, a spinner or a delay, stop: PLAN P11's fail-open requirement
has been broken. R9 has the check for it.

---

## R0 — Prerequisites

### R0.1 — Rust (already installed on this machine)

Verified while writing the plan:

```powershell
rustc --version      # 1.99.0
cargo --version      # 1.99.0
rustup toolchain list
```

`stable-x86_64-pc-windows-msvc` is the default and Visual Studio 2022 Build
Tools are present, which is what `cargo test` needs in order to link. **No
`wasm32-unknown-unknown` target is needed**: this backend is a normal Linux
binary, not WebAssembly.

If the toolchain ever has to be installed from scratch:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e   # "Desktop development with C++"
winget install --id Rustlang.Rustup -e
# then reopen the terminal
rustup component add rustfmt clippy
```

### R0.1b — Windows Smart App Control blocks `cargo test` on this machine

Measured while building C3. Windows **Smart App Control** is on
(`HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy`,
`VerifiedAndReputablePolicyState = 1`), and it refuses to run binaries that are
not signed and reputable — which is exactly what `cargo` produces: build-script
executables and the test harness. The failure looks like this and is **not** a
project problem:

```
error: failed to run custom build command for `serde_core`
  could not execute process `...\build-script-build` (never executed)
  An Application Control policy has blocked this file. (os error 4551)
```

`cargo-fmt` is blocked the same way, so `cargo fmt` fails too.

Three ways forward, in order of preference:

1. **Run the Rust gates in a container** (what this repository does on Windows,
   and what C3 used):

   ```powershell
   docker run --rm -v "D:\Repositories\learn-and-play:/work" -w /work/api `
     -e CARGO_TARGET_DIR=/cargo-target `
     -v lap-cargo-target:/cargo-target `
     -v lap-cargo-registry:/usr/local/cargo/registry `
     rust:1-bookworm sh -c "cargo fmt --all && cargo test && cargo clippy --all-targets -- -D warnings"
   ```

   The named volumes keep the dependency cache, so the second run is fast. This
   is closer to CI (Linux) than a Windows build is, and it is unaffected by the
   policy because the binaries are Linux ones running inside the Docker VM.
2. **Turn Smart App Control off** (Windows Security → App & browser control →
   Smart App Control settings → Off). It is a real security feature and turning
   it off cannot be undone without reinstalling Windows, so decide deliberately.
3. **Use WSL2** and do the Rust work there — Linux binaries are unaffected.

CI on `ubuntu-latest` is never affected. Keep this in mind when a local `cargo`
command fails for no apparent reason: check which of the three above applies
before debugging the code.

### R0.2 — Docker Desktop

Needed for three things: `docker build` (the container image), the local
Postgres in `docker-compose.yml`, and `wrangler dev` running the container on
this machine.

```powershell
docker version --format '{{.Server.Version}}'   # fails while the daemon is stopped
```

Start Docker Desktop and re-run until it prints a version. **H1 in PLAN P18 is
exactly this.**

### R0.3 — Wrangler

Wrangler is **not** installed globally and does not need to be: C5 adds it as a
pinned devDependency, so `npm ci` provides it and CI and this machine use the
same version.

```powershell
npm.cmd install
npx wrangler --version
npx wrangler whoami        # opens a browser the first time
```

`whoami` must print your account name and account id (the id also appears in the
Cloudflare dashboard URL).

### R0.4 — A Postgres client (optional but useful)

```powershell
# for looking at a database by hand; psql is not required by any workflow
winget install --id PostgreSQL.PostgreSQL.17 -e
```

Alternatively use the Neon console's SQL editor, or
`docker run --rm -it postgres:17 psql "<connection string>"`.

### ✅ Check

```powershell
rustc --version; cargo --version
docker version --format '{{.Server.Version}}'
npm.cmd install
npx wrangler --version
```

All four succeed.

---

## R1 — Neon: the database

### R1.1 — Create the project

Sign in at <https://neon.com>, create a project (the free plan is enough;
`PLAN` P6 has the limits). Use the region closest to you — the container will
talk to it over the public internet, so a nearby region keeps queries quick.

### R1.2 — Two databases

The test environment must never touch production data. In one project, create:

| Database | Used by |
| --- | --- |
| `learn_and_play` | the production Worker |
| `learn_and_play_test` | `learn-and-play-test` and the PR workflow |

(Neon branches are the other way to do this; two databases in one project is
simpler and keeps one connection string shape.)

### R1.3 — Connection strings

Copy each database's connection string and append `sslmode=require` if it is not
already there:

```
postgresql://<user>:<password>@<host>.neon.tech/learn_and_play?sslmode=require
postgresql://<user>:<password>@<host>.neon.tech/learn_and_play_test?sslmode=require
```

Keep them out of the repository. They go into Cloudflare secrets (R7) and, for
CI, into a GitHub environment secret (R8).

### R1.4 — Know the two quirks before you debug them

- **Scale to zero after 5 minutes.** The first query after an idle night waits a
  few hundred milliseconds. A sign-in after a quiet night therefore costs
  container start (1-3 s) + database wake + the argon2 hash. The C8 measurement
  covers exactly this path.
- **Session state does not survive a suspend.** Never rely on prepared-statement
  caches, temporary tables or `LISTEN/NOTIFY`. sqlx reconnects cleanly, which is
  why the pool is configured the way it is in C7.

### ✅ Check

```powershell
docker run --rm -it postgres:17 psql "<learn_and_play_test connection string>" -c "select version();"
```

It connects and prints a version string.

---

## R2 — Cloudflare: plan, token, test hostname

### R2.1 — Confirm the plan

Dashboard → **Workers & Pages** → **Plans**. Confirm **Workers Paid**: the
container product requires it, and D1's 10 ms ceiling is the reason the previous
plan was shaped the way it was.

### R2.2 — Widen the API token used by CI

Dashboard → **My Profile** → **API Tokens** → open the token stored in
`CLOUDFLARE_API_TOKEN`.

| Scope | Permission | Why |
| --- | --- | --- |
| Account | **Workers Scripts: Edit** | deploy the Worker script |
| Account | **Workers Containers: Edit** (or the closest available name) | build and push the container image |
| Account | **Account Settings: Read** | resolve the account id |

Cloudflare renames these from time to time — pick the closest equivalents and
prefer the narrowest token that still deploys. Consider a second, separate token
for the test workflow.

### R2.3 — Confirm the repository secrets and environments

Repository → **Settings** → **Secrets and variables** → **Actions**: confirm
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist.

Repository → **Settings** → **Environments**:

- `cloudflare-production` must exist **with required reviewers**. A referenced
  environment that does not exist is created *without* protection rules, which
  would silently remove the human approval gate.
- Create `cloudflare-test` **without** reviewers: the test deploy is meant to be
  automatic. Put the test-only secrets here (`TEST_DATABASE_URL` for the
  migration step, the Access service token for the smoke check).

### R2.4 — The test hostname

`test.play2learn.divanchyshyn.com` becomes a **custom domain of a new Worker**
named `learn-and-play-test`. C5 declares it in `wrangler.test.jsonc`:

```jsonc
"routes": [{ "pattern": "test.play2learn.divanchyshyn.com", "custom_domain": true }]
```

The first `wrangler deploy --config wrangler.test.jsonc` creates the DNS record
and the certificate. Two things to check first:

- The hostname must **not** already have a CNAME record — a hostname with one
  cannot be turned into a custom domain. Delete the record if it exists.
- The zone must be in this account (it is: `play2learn.divanchyshyn.com` already
  lives here).

If the deploy cannot create it, attach the domain once in the dashboard
(Workers → `learn-and-play-test` → Settings → Domains & Routes) and leave the
`routes` block out.

### ✅ Check

- `npx wrangler whoami` prints the account.
- `cloudflare-production` shows **required reviewers**; `cloudflare-test` exists
  without any.
- `test.play2learn.divanchyshyn.com` has no CNAME record in the DNS tab.

---

## R3 — Cloudflare Access for the test environment

The test Worker holds a real database and a sign-up form. Access keeps it to
people you invite, without any code.

### R3.1 — Enable Zero Trust

Dashboard → **Zero Trust** → choose the **Free** plan → set a team domain (for
example `divanchyshyn`). No identity provider is needed: the built-in
**one-time PIN** sends a code to an email address.

### R3.2 — The application

Zero Trust → **Access** → **Applications** → **Add an application** →
**Self-hosted**:

| Field | Value |
| --- | --- |
| Name | `Learn and play (test)` |
| Session duration | 1 month (so a tablet logs in once, not every visit) |
| Application domain | `test.play2learn.divanchyshyn.com` |

Then add a policy: **Allow**, action for the **Emails** selector, containing
your own address (and anyone else you want to let in).

### R3.3 — A service token for CI

Zero Trust → **Access** → **Service Auth** → **Create service token**, named
`learn-and-play-ci`. Store the client id and secret as GitHub environment secrets
in `cloudflare-test` (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`) and add a
second policy to the application: **Service Auth**, action **Allow**, with that
token.

Without this, the deploy workflow cannot smoke-check its own deployment: it would
receive Access's login redirect instead of `/api/health`.

### R3.4 — Remember what Access does and does not do

Access protects the hostname, **including the static assets**, so the game pages
on the test hostname are private too — which is what you want while testing, and
the reason the `_headers` noindex file is only belt and braces. Access does not
replace application auth: accounts on the test environment are ordinary accounts
in the test database.

### ✅ Check

Open `https://test.play2learn.divanchyshyn.com/` in a private window: Cloudflare
asks for an email code before anything loads. After entering it, the page loads
(or returns 404 until C6 has deployed once — that is expected at this point).

---

## R4 — Repo wiring (what C3 – C5 create)

Nothing here is a one-off command; it is a description of what the commits add,
so you can check the result.

### R4.1 — `api/` (the Rust service)

- `api/Cargo.toml` — package `learn-and-play-api`, a library plus a binary, with
  `axum`, `tokio`, `sqlx`, `argon2`, `serde`, `tracing`, `tower-http`.
- `api/rust-toolchain.toml` — pins the channel and the `rustfmt`/`clippy`
  components so CI and this machine agree.
- `api/src/main.rs` — arguments `serve` (default) and `migrate`.
- `api/Dockerfile` — `cargo-chef` planner → builder → distroless nonroot
  runtime, `linux/amd64`, listening on `0.0.0.0:8080`.
- `api/migrations/` — the SQL from PLAN P10.

### R4.2 — `edge/` (the Worker front door)

- `edge/src/index.js` — `/api/*` goes to the Durable Object; everything else
  falls through to `env.ASSETS` (which, with `run_worker_first`, is never even
  reached for a static path).
- `edge/src/container.js` — the `ApiContainer` class: `defaultPort = 8080`,
  `sleepAfter = "10m"`, the container's environment variables, and a ping
  endpoint of `/api/health`.
- The front door also **replaces** any client-supplied `X-Client-IP` with
  `CF-Connecting-IP` before forwarding, so the Rust rate limiter cannot be
  spoofed.

### R4.3 — Local environment files

| File | Holds | Gitignored |
| --- | --- | --- |
| `.dev.vars` (repository root) | the Worker's environment for `wrangler dev`: `DATABASE_URL`, `PEPPER`, `PUBLIC_ORIGIN` | yes |
| `api/.env` | the same values for running the API directly with `cargo run` | yes |

`.dev.vars` is read by `wrangler dev`; the container receives those values as
environment variables. A sample with dummy values is fine to commit
(`.dev.vars.example`), the real file never is.

### ✅ Check

```powershell
npm.cmd run lint; npm.cmd run test; npm.cmd run build
cargo fmt --manifest-path api/Cargo.toml --all --check
cargo clippy --manifest-path api/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path api/Cargo.toml
npx wrangler deploy --config wrangler.test.jsonc --dry-run
```

All succeed, and `git status` does not list `.dev.vars` or `api/.env`.

---

## R5 — Local development

### R5.1 — The database

```powershell
docker compose up -d db
docker compose logs db --tail 20
```

`docker-compose.yml` runs `postgres:17` on `localhost:5432` with a throwaway
password, which is the same database the integration tests use.

### R5.2 — The API alone (the fast loop)

```powershell
cd api
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/learn_and_play?sslmode=disable"
$env:PEPPER = "dev-pepper-not-used-anywhere-real"
$env:PUBLIC_ORIGIN = "http://localhost:8080"
cargo run
```

Then, from another terminal:

```powershell
curl.exe -s http://localhost:8080/api/health
# {"ok":true,"db":"up"}
```

### R5.3 — The whole thing through the front door

`wrangler dev` runs the Worker, the Durable Object and the container locally:

```powershell
npm.cmd run build          # dist/ must exist: the front door serves it
npx wrangler dev --config wrangler.test.jsonc
```

Open <http://localhost:8787> — the library and the games come from `dist/`, and
`/api/health` comes from the container. Local `.dev.vars` supplies the
environment (R4.3). Docker must be running for this path.

> **Local dev does not reproduce the production cost profile.** Here the
> container gets the whole machine; in production it gets a `lite` share. That is
> exactly what the C8 hash-time measurement is for.

### R5.4 — Signing in locally

```powershell
# create an account and capture the session cookie
Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/account `
  -ContentType 'application/json' `
  -Body '{"username":"testkid","password":"et-langt-passord"}' `
  -SessionVariable session

Invoke-RestMethod http://localhost:8787/api/me -WebSession $session
$session.Cookies.GetCookies('http://localhost:8787') | Format-Table Name, HttpOnly, Expires
```

Browsers accept `Secure` cookies on `localhost`, which is why the same
`__Host-lap_sid` cookie works here and in production.

### ✅ Check

- `/api/health` returns `{"ok":true,"db":"up"}` through both paths.
- `http://localhost:8787/games/sound-labyrinth/` serves the game.
- The cookie table shows `__Host-lap_sid` with `HttpOnly = True`.

---

## R6 — Migrations

### R6.1 — Where they live

`api/migrations/0001_init.sql` (PLAN P10). The filename pattern sqlx expects is
`<version>_<name>.sql`, applied in ascending order and recorded in
`_sqlx_migrations`.

### R6.2 — Apply locally

```powershell
cd api
cargo run -- migrate        # DATABASE_URL must point at the local database
```

### R6.3 — Apply remotely

CI does this before every deploy (R8), but you can also do it by hand:

```powershell
$env:DATABASE_URL = "<learn_and_play_test connection string>"
cargo run -- migrate
```

> The migration step in CI needs `TEST_DATABASE_URL` (GitHub environment secret)
> and runs **before** the deploy, so a broken migration fails the job instead of
> shipping code that expects a schema that is not there.

### R6.4 — Inspect

```powershell
docker run --rm -it postgres:17 psql "<connection string>" -c "\dt"
docker run --rm -it postgres:17 psql "<connection string>" -c "select count(*) from users;"
```

### R6.5 — Rules

- Never edit an applied migration: its checksum is recorded. Fix forward with a
  new file.
- Keep migrations additive where you can (add a column with a default, backfill,
  then tighten), so a rollback of the application image still finds a schema it
  understands.
- `DELETE FROM users` really does remove everything a user owns; that is by
  design (`ON DELETE CASCADE`) and is what the delete-account test asserts.

### ✅ Check

- Running `cargo run -- migrate` twice changes nothing the second time.
- `\dt` lists `users`, `sessions`, `progress`, `auth_attempts` and
  `_sqlx_migrations`.

---

## R7 — Secrets, per environment

Secrets are set **once per Worker** with `wrangler secret put`; they never enter
the repository and never appear in `wrangler*.jsonc`.

| Name | Value | Used by |
| --- | --- | --- |
| `DATABASE_URL` | the Neon connection string | the Rust service (sqlx) |
| `PEPPER` | 32 random bytes, base64; **different** per environment | argon2 pepper |
| `PUBLIC_ORIGIN` | `https://test.play2learn.divanchyshyn.com` or `https://play2learn.divanchyshyn.com` | `Origin` checks and cookie decisions |
| `NOINDEX` | `1` on the test Worker only | adds `X-Robots-Tag: noindex` to API responses |

Non-secret values (`PUBLIC_ORIGIN`, `NOINDEX`) can live in the config file's
`vars` block instead; keeping the two apart makes the dashboard readable.

### R7.1 — Generate a pepper

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

### R7.2 — Set them

```powershell
# the test Worker
npx wrangler secret put DATABASE_URL --config wrangler.test.jsonc
npx wrangler secret put PEPPER       --config wrangler.test.jsonc
npx wrangler secret list --config wrangler.test.jsonc

# the production Worker (C13, after the cutover config exists)
npx wrangler secret put DATABASE_URL --name learn-and-play
npx wrangler secret put PEPPER       --name learn-and-play
npx wrangler secret list --name learn-and-play
```

`wrangler secret put` prompts for the value and stores it encrypted.

> **Rotating `PEPPER` invalidates every stored password hash** — the pepper is
> part of the derivation. If it ever has to change, it is a real migration:
> users would have to set new passwords, which this design cannot do (no email).
> Treat it as permanent, and keep a copy in your password manager.

### ✅ Check

- Both `secret list` calls show `DATABASE_URL` and `PEPPER`.
- `git status` does not list `.dev.vars` or `api/.env`.
- The test and production peppers are different values.

---

## R8 — CI and the deploy workflows

### R8.1 — `ci.yml` (every push and PR)

The Rust job runs **before** the npm steps, so a Rust failure fails fast:

```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    components: rustfmt, clippy
- uses: Swatinem/rust-cache@v2
  with:
    workspaces: api
- run: cargo fmt --manifest-path api/Cargo.toml --all --check
- run: cargo clippy --manifest-path api/Cargo.toml --all-targets -- -D warnings
- run: cargo test --manifest-path api/Cargo.toml     # services: postgres:17
- run: docker build -t learn-and-play-api:ci api
```

The `docker build` step is not decoration: the image is what ships, and it is the
one thing `cargo test` cannot check.

### R8.2 — `deploy-test.yml` (pull requests → the test environment)

- Triggers on `pull_request` (`opened`, `synchronize`, `reopened`) and
  `workflow_dispatch`.
- **Guards:** only same-repository heads (`github.event.pull_request.head.repo
  .full_name == github.repository`) — fork PRs never receive secrets — and
  `dependabot/**` branches are skipped so a dependency bump does not take the
  shared slot.
- **Concurrency:** `group: deploy-test`. **Never** reuse the production
  `cloudflare` group: its `cancel-in-progress: true` would cancel a production
  deploy that is waiting for approval.
- **Environment:** `cloudflare-test` (no reviewers), which supplies
  `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` for the smoke check.
- **Steps:** build `dist/` → write `dist/_headers` with
  `X-Robots-Tag: noindex` → `cargo run -- migrate` against `TEST_DATABASE_URL` →
  `npx wrangler deploy --config wrangler.test.jsonc` → smoke-check
  `/api/health` with the Access service-token headers → a sticky comment with
  the URL, the commit SHA and the smoke result.

One shared slot: whichever PR deployed most recently owns the hostname, and the
comment says which commit is live.

### R8.3 — `deploy-cloudflare.yml` (production, C13)

1. The `verify` job gains the same Rust steps as CI (so nothing is verified two
   different ways).
2. The `deploy` job needs the Rust toolchain **and Docker**, because
   `wrangler deploy` now builds and pushes the container image.
3. Add the migration step **before** the deploy:
   `npx wrangler d1 …` is gone — it is `cargo run -- migrate` with the production
   `DATABASE_URL`, or an equivalent step using the same connection string.
4. The `cloudflare-production` required-reviewer gate is **unchanged**. A failed
   migration fails the deploy job, so the site can never serve code against the
   wrong schema.
5. Update the required status checks in branch protection to include the Rust
   job (H8).

### R8.4 — Dependabot

`dependabot.yml` watches npm, GitHub Actions, **cargo** (`/api`) and **docker**
(`/api`), so crate and base-image updates arrive as pull requests like everything
else.

### ✅ Check

- A push to a branch runs lint, tests, build, the Rust steps and `docker build`,
  all green.
- Pushing to a pull request in this repository deploys and comments a URL.
- A push to `main` waits for approval, and after approval the site serves the
  new build.

---

## R9 — Verification checklist

Run the block for the milestone you just finished. These are the acceptance
criteria from PLAN P15.

### R9.0 — The universal checks (every time)

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
cargo fmt   --manifest-path api/Cargo.toml --all --check
cargo clippy --manifest-path api/Cargo.toml --all-targets -- -D warnings
cargo test  --manifest-path api/Cargo.toml
docker build -t learn-and-play-api:ci api
```

### R9.1 — M0: the container runs and the games are untouched

Record the production routes **before** the cutover (they must not change until
C13, and must be identical after it):

```powershell
$routes = @('/', '/games/sound-labyrinth/', '/games/snakes-and-ladders/',
            '/games/shop/', '/games/word-fishing/', '/games/card-battle/',
            '/games/number-line-hop/')
foreach ($r in $routes) { "$r`t" + (curl.exe -s -o NUL -w "%{http_code}" "https://play2learn.divanchyshyn.com$r") }
```

On the test hostname (through Access; add the service-token headers for a script):

```powershell
curl.exe -s -H "CF-Access-Client-Id: <id>" -H "CF-Access-Client-Secret: <secret>" `
  https://test.play2learn.divanchyshyn.com/api/health
```

**Pass:** the games load on both hostnames, `/api/health` returns JSON on the
test hostname, and the production route table is unchanged.

### R9.2 — M1: the database

- `cargo run -- migrate` against the test database applies `0001_init.sql` and
  is a no-op on the second run.
- `select count(*) from users` works and returns 0.

### R9.3 — M2: accounts

- `POST /api/account` returns a cookie; `/api/me` shows the username.
- A wrong password and an unknown username produce the **same** body, status and
  rough timing.
- After N failures from one IP, the next attempt is a `429`.
- `POST /api/password` keeps the current session and invalidates the others.
- `DELETE /api/account` leaves zero rows in `users`, `sessions` and `progress`
  for that id.
- **Hash timing (this one decides the instance size):** the C8 log line for a
  sign-in shows the argon2 duration. Under ~1.5 s on the `lite` instance is fine;
  over that, change `instance_type` to `"basic"` in `wrangler.test.jsonc` (and in
  the production config) and redeploy.

### R9.4 — M3: progress, and the fail-open guarantee

- Catch a word in Word Fishing on one browser profile, sign in, then sign in on a
  **fresh** profile: the fishing book and the gallery are there.
- Clear `localStorage` on a signed-in device, reload a game: it waits briefly and
  then shows the saved progress (the gate doing its job).
- Finish a picture in Sound Labyrinth offline, then come online: the picture
  arrives in the other profile without losing what either side had.
- **The fail-open test (the one that must never regress):** with the API stopped
  (or DevTools set to offline), open every game and play.
  **Every game must play exactly as before, with no error, spinner or delay
  anywhere.** If it does not, stop and fix it before continuing.

### R9.5 — M4: production, backups and Pages

- All seven production routes return the same status codes as the recorded
  table.
- The production deploy needed an approval (check the workflow run).
- A manual backup run produces a dump that restores into a scratch database
  (R10).
- With Pages set to None, the old `https://<user>.github.io/learn-and-play/` URL
  no longer serves the site.
- `npm.cmd run test:coverage` does not fall below `docs/audit/BASELINE.md`.

---

## R10 — Backup and restore

Neon's free tier has a short restore window, so C12 adds a nightly dump.

### R10.1 — What runs

`.github/workflows/backup.yml` (scheduled nightly and dispatchable by hand):

```
docker run --rm postgres:17 pg_dump "<DATABASE_URL>" | gzip > dump.sql.gz
aws s3 cp dump.sql.gz s3://learn-and-play-backups/<env>/<date>.sql.gz
```

It needs GitHub secrets for the production connection string
(`PRODUCTION_DATABASE_URL`) and the R2 S3 credentials (`R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`), the bucket from H7, and a lifecycle rule
that expires objects after ~30 days.

### R10.2 — Restore into a scratch database

```powershell
docker compose up -d db
docker exec -i <db container> psql -U postgres -c "create database restore_check;"
docker run --rm -i postgres:17 psql "postgresql://postgres:postgres@host.docker.internal:5432/restore_check?sslmode=disable" `
  < (aws s3 cp s3://learn-and-play-backups/prod/2026-10-05.sql.gz - | gzip -d)
```

(On Windows PowerShell, unpack first: `aws s3 cp … dump.sql.gz`, then
`gzip -d dump.sql.gz`, then pipe the `.sql` into `psql`.)

### R10.3 — Restoring for real

1. Take a fresh Neon restore point if you can.
2. Restore into a **new** database rather than overwriting production.
3. Point `DATABASE_URL` at it, redeploy, and verify a sign-in before deleting
   the old database.

### ✅ Check

A dump from the last 24 hours exists in R2, and the restore into the scratch
database contains the expected row counts (`users`, `progress`).

---

## R11 — Rollback and recovery

### R11.1 — Decide what actually broke

| Symptom | Almost certainly |
| --- | --- |
| Games do not load at all | the **assets** side (`assets.directory`, or a failed Worker deploy) — the serious one |
| Games load, `/api/*` returns 500s | the Rust service or a bad migration |
| `/api/*` times out on the first request of the day | the container is cold-starting (1-3 s) or the database is waking — not a fault |
| Sign-ins fail, everything else is fine | argon2 timing, a rotated `PEPPER`, or the database |
| Nothing happens after a push to `main` | the approval gate is still waiting — check the workflow run |
| The test hostname 404s | the test Worker has not been deployed since the last migration |

### R11.2 — Roll the Worker back

```powershell
npx wrangler versions list --name learn-and-play
npx wrangler rollback      --name learn-and-play
```

A rollback restores the previous version **including its assets**, which makes it
the fastest way back to a known-good state. Note that it does **not** roll the
container image back on its own: redeploy from the last good commit if the image
itself is the problem.

### R11.3 — Or revert in git

```powershell
git revert <commit>      # or git reset --hard <known-good> on your branch
git push
```

then approve the deploy as usual. Prefer this when the cause is a code change you
want to review before it comes back.

### R11.4 — Remove the backend entirely

1. Revert C13 (the `wrangler.jsonc` change) and delete `api/` and `edge/`.
2. Deploy. The site returns to exactly today's static-only Worker, because game
   pages never depended on the API.
3. Export the database first if it holds anything worth keeping (R10).
4. Delete the Neon database and the `learn-and-play-test` Worker once you are
   sure.

### R11.5 — A bad migration

1. Restore from the most recent dump, or use Neon's own restore.
2. Fix forward with a **new** migration file. Never edit one that has been
   applied: its checksum is recorded in `_sqlx_migrations`.

### R11.6 — A lost password

There is no recovery, by design (PLAN D8). If the account matters, the only path
is a human with database access setting a new hash by hand — a deliberate,
documented last resort, and the strongest argument for adding a recovery code
later (PLAN P17, "deliberately out of scope").

---

## R12 — Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `docker: failed to connect … dockerDesktopLinuxEngine` | Docker Desktop is not running | start it (R0.2) |
| `error: linker 'link.exe' not found` | MSVC build tools missing | install "Desktop development with C++" (R0.1) |
| `cargo test` cannot connect | Postgres not running | `docker compose up -d db` (R5.1) |
| `relation "users" does not exist` | migrations not applied to *this* database | `cargo run -- migrate` with the right `DATABASE_URL` (R6) |
| `/api/health` 404 on the deployed hostname | `run_worker_first`, `main`, or the route is wrong | re-check `wrangler.test.jsonc` / `wrangler.jsonc`, then `--dry-run` |
| `/api/health` 404 locally | `dist/` not built, or the path does not match | `npm.cmd run build`, and check the exact path |
| Games 404 after a deploy | `assets.directory` broken | restore `"./dist"` and run R9.1 immediately |
| The container never becomes healthy | the process does not listen on the configured port, or crashes on missing env | check `wrangler tail`; the app must start with no `DATABASE_URL` and report `db: "unconfigured"` |
| The first request of the day takes seconds | cold start (1-3 s) plus a database wake | expected; raise `sleepAfter` if it annoys you, and watch the cost |
| `429` on sign-in that never clears | the rate limiter is doing its job | wait out the window, or clear `auth_attempts` for that key |
| Cookie never arrives in the browser | `Secure`/`__Host-`/path mismatch | the cookie is `__Host-lap_sid`: `Secure`, `Path=/`, no `Domain`, HTTPS (or localhost) |
| Cookie is set but not forwarded | the Durable Object dropped `Set-Cookie` | the C8 acceptance check covers this; if it happens, copy `Set-Cookie` explicitly in the front door |
| CI: `cargo test` fails only in CI | toolchain or service-container drift | check `api/rust-toolchain.toml` and the `services:` block in `ci.yml` |
| CI: the image build times out | a cold cargo build in the image | confirm the layer cache step and `cargo-chef` stages are intact |
| Deploy: `wrangler` cannot find Docker | the runner lacks the daemon | `ubuntu-latest` has it; a self-hosted runner needs it installed |
| Deploy: authorization error on the image push | the token lacks the container permission | R2.2 |
| Coverage dropped | new `src/shared/*` or `src/account/*` modules are untested | PLAN P13; the baseline is in `docs/audit/BASELINE.md` |
| Access keeps asking for a code | the session expired, or a second policy wrote a shorter duration | Zero Trust → the application → session duration (R3.2) |

---

## R13 — Command cheat sheet

```powershell
# the project's own gates
npm.cmd run lint
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run build

# Rust
cargo fmt    --manifest-path api/Cargo.toml --all --check
cargo clippy --manifest-path api/Cargo.toml --all-targets -- -D warnings
cargo test   --manifest-path api/Cargo.toml
cargo run    --manifest-path api/Cargo.toml -- migrate
docker build -t learn-and-play-api:ci api

# local stack
docker compose up -d db
npx wrangler dev --config wrangler.test.jsonc
npx wrangler dev                      # production config, once C13 exists
npx wrangler tail --name learn-and-play --format pretty

# deploys and secrets
npx wrangler deploy --config wrangler.test.jsonc
npx wrangler deploy --dry-run
npx wrangler secret put PEPPER --config wrangler.test.jsonc
npx wrangler secret list --name learn-and-play
npx wrangler versions list --name learn-and-play
npx wrangler rollback      --name learn-and-play

# database
docker run --rm -it postgres:17 psql "<connection string>" -c "\dt"
docker run --rm -it postgres:17 psql "<connection string>" -c "select count(*) from users;"
```

---

## R14 — Permissions: letting the coding agent work on Rust

`opencode.json` currently allows the agent only `npm ci`, `npm run lint`,
`npm run test*`, `npm run build` and read-only git. Without a change the agent
**cannot run `cargo test`** and therefore cannot work on `api/` at all.

### R14.1 — The addition (C4)

In `opencode.json` → `agent.build.permission.bash`:

```jsonc
"cargo test*":  "allow",
"cargo check*": "allow",
"cargo clippy*": "allow",
"cargo fmt*":   "allow",
"cargo build*": "allow"
```

Deliberately **not** allowed: anything that deploys (`wrangler deploy`,
`wrangler secret put`), `cargo install*` (it fetches and runs third-party build
scripts), and anything touching `.env` / `.dev.vars`. The allowlist stays
deny-by-default: if a task needs something outside it, the agent stops and
explains.

### R14.2 — Update the documents that describe it

- `docs/agent-pipeline.md` — the guardrails table and the allowed-command list.
- `AGENTS.md` → *Agent pipeline* — the same list.
- `.opencode/agents/review.md` — the reviewer may run `cargo test`, `cargo
  clippy` and `cargo fmt --check`, and its security bullet must stop describing
  the project as "fully static, no backend".

### ✅ Check

`cargo test` appears in the allowlist, `wrangler` appears nowhere in it, and all
three documents agree with the file.

---

## Where to start, in one paragraph

Read `PLAN.md` **P2**, **P7**, **P10** and **P11**, then do **R0 → R1 → R2**
(Neon and Cloudflare are the only steps nobody can do from the repository), and
start at **C3**. Stop after **C6** and check R9.1: a Rust container answering
`/api/health` on `test.play2learn.divanchyshyn.com`, behind Access, with every
game page provably unchanged. That is M0 — a complete, valuable, zero-risk
result that also tells you whether this stack is pleasant to work in before any
account logic exists.
