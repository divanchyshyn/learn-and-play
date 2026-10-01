# Backend runbook — accounts and cross-device progress (Rust + Cloudflare)

> **Status: nothing has been built yet.** This runbook is the execution guide for
> [`PLAN.md`](./PLAN.md). Read `PLAN.md` P2 (decisions) and P7 (the CPU limit)
> once, then work from here.
>
> Everything is written for **Windows PowerShell**. Use `npm.cmd` (not `npm`) in
> this repo — the execution policy can block `npm.ps1`. Use `curl.exe` (with the
> extension) so you get the real curl instead of PowerShell's `Invoke-WebRequest`
> alias.

## How to use this runbook

Steps are numbered **R0 … R14** and each one ends with a **✅ Check** that tells
you it worked. Do not move on from a failed check — every step is designed to fail
loudly and early.

### Jump table

| Step | What it does | Serves | Time |
| --- | --- | --- | --- |
| **R0** | Install Rust, wasm target, worker-build, wrangler | WP1 | 30-60 min |
| **R1** | Cloudflare dashboard: D1, token scopes, secrets, environments | WP1, WP2 | 20 min |
| **R2** | Read the canonical `workers-rs` config from a throwaway template | WP1 | 15 min |
| **R3** | Wire the repo: `worker/`, `wrangler.jsonc`, `.gitignore` | WP1 | 30 min |
| **R4** | Local dev loop (`wrangler dev`, local D1, hitting the API) | WP1 – WP5 | 20 min |
| **R5** | Migrations, local and remote (+ Time Travel) | WP2 | 15 min |
| **R6** | The pepper secret (`.dev.vars`, `wrangler secret put`) | WP3 | 10 min |
| **R7** | CI and deploy workflow edits | WP7 | 45 min |
| **R8** | The verification checklist for every milestone | all | 20 min |
| **R9** | Rollback and recovery | all | — |
| **R10** | The CPU-budget experiment (measure before deciding anything permanent) | WP1, P7 | 30 min |
| **R11** | Troubleshooting table | all | — |
| **R12** | Command cheat sheet | all | — |
| **R13** | Permissions: the coding agent's bash allowlist | WP7 | 10 min |
| **R14** | Documentation edits, including the ready-to-paste `AGENTS.md` amendment | WP0, WP8 | 45 min |

### Milestone → steps

| Milestone (PLAN P16) | Steps |
| --- | --- |
| **M0** — `/api/health` deployed, games untouched | R0, R1 (partial), R2, R3, R4, R8 (M0 block) |
| **M1** — D1 + accounts round trip | R1 (D1), R5, R6, R8 (M1 block) |
| **M2** — one key synced end to end | R4, R8 (M2 block) |
| **M3** — all keys + Pages decision | R8 (M3 block), R14 |
| **M4** — tests, CI, hardening, privacy | R7, R8 (M4 block), R13, R14 |

### The one rule that must never be broken

**A game must never break because the backend is down.** If any step makes a game
show an error, a spinner or a delay, stop: you have broken PLAN P11's fail-open
requirement. R8 has the check for it.

---

## R0 — Prerequisites: install the Rust toolchain

Nothing here is in the repo yet. Do all of it once, on the development machine.

### R0.1 — The Microsoft C++ linker

The default Windows Rust toolchain (`stable-x86_64-pc-windows-msvc`) needs the
MSVC linker for **host-target builds — which is what `cargo test` uses**. Without
it, `cargo test` fails even though the wasm build would work.

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e
```

In the installer, tick **"Desktop development with C++"**. (Alternatively, skip
this and let `rustup-init` offer to install the prerequisites in R0.2.)

> If you would rather not install Visual Studio Build Tools at all, the
> alternative is the GNU toolchain (`rustup toolchain install stable-gnu` plus a
> mingw-w64 install). It works, but it is a rabbit hole. The MSVC path is the
> documented one.

### R0.2 — rustup and Rust

```powershell
winget install --id Rustlang.Rustup -e
```

Then **close and reopen the terminal** so `PATH` picks up `%USERPROFILE%\.cargo\bin`.

```powershell
rustc --version
cargo --version
rustup --version
```

### R0.3 — The Workers wasm target

```powershell
rustup target add wasm32-unknown-unknown
rustup target list --installed
```

### R0.4 — `worker-build`

This is the tool that turns the Rust crate into something Wrangler can deploy. It
takes a few minutes to compile the first time.

```powershell
cargo install worker-build --locked
worker-build --version
```

> `worker-build` downloads a `wasm-opt` binary on first use, which is the most
> common thing to fail behind a corporate proxy or on Windows. If it fails, the
> build still works with `wasm-opt` disabled — you just get a larger bundle. CI on
> `ubuntu-latest` is the authority on whether the real build works.

### R0.5 — Wrangler (on demand)

Wrangler does **not** need to become a project dependency. It is used in CI via
`wrangler-action`; locally, `npx` downloads it on demand.

```powershell
npx --yes wrangler@latest --version
npx --yes wrangler@latest login
npx --yes wrangler@latest whoami
```

`login` opens a browser and stores an OAuth token locally. `whoami` must print
your account (and the account id, which also appears in the Cloudflare dashboard
URL).

> **Open decision (PLAN Q2):** if the repeated `npx --yes wrangler@latest` becomes
> tiresome, add `wrangler` to `devDependencies` and call it as `npx wrangler`.
> That changes `package.json`, so it is a deliberate choice, not a default.

### R0.6 — `cargo-generate` (optional)

Only needed if you prefer scaffolding over cloning (see R2 for the clone-based
route, which is the recommended one).

```powershell
cargo install cargo-generate --locked
```

### ✅ Check

```powershell
rustc --version; cargo --version; worker-build --version
rustup target list --installed | Select-String wasm32
npx --yes wrangler@latest whoami
```

All four succeed, and `wasm32-unknown-unknown` is in the installed list.

## R1 — Cloudflare: account, database, token, secrets

Do this in the dashboard, plus two CLI commands.

### R1.1 — Confirm the plan

Dashboard → **Workers & Pages** → **Plans**. Confirm you are on the **Free** plan.
(Free includes D1 with 10 databases, 5 GB, 5M rows read/day, 100k rows
written/day — see PLAN P6.)

### R1.2 — Create the D1 database

```powershell
npx --yes wrangler@latest d1 create learn-and-play
```

The command prints a JSON snippet containing `database_id`. **Copy that id** — it
goes into `wrangler.jsonc` in R3.

Or: Dashboard → **Workers & Pages** → **D1** → **Create database** → name it
`learn-and-play`.

```powershell
npx --yes wrangler@latest d1 list
```

### R1.3 — Widen the API token used by CI

Dashboard → **My Profile** → **API Tokens** → open the token stored in the
repository secret `CLOUDFLARE_API_TOKEN`.

It currently only deploys static assets. Add:

| Scope | Permission | Why |
| --- | --- | --- |
| Account | **Workers Scripts: Edit** | deploy the Worker script (probably already present) |
| Account | **Workers D1: Edit** | apply migrations, run queries in CI |
| Account | **Account Settings: Read** | resolve the account id |

> Cloudflare renames these permissions from time to time. Pick the closest
> available equivalents, and prefer the narrowest token that still deploys.
> Alternative to consider: a separate token used only by the deploy job.

### R1.4 — Confirm the repository secrets and environment

- Repository → **Settings** → **Secrets and variables** → **Actions**: confirm
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist.
- Repository → **Settings** → **Environments**: confirm `cloudflare-production`
  exists **with required reviewers**. The deploy job references it, and a
  referenced-but-missing environment is created *without* protection rules — which
  would silently remove the human approval gate. **Check this before deploying.**

### R1.5 — Optional: note the workers.dev hostname

Dashboard → **Workers & Pages** → your account's `*.workers.dev` subdomain. Preview
deployments (PLAN P14, R10) hand out URLs there, which is the safest place to run
the CPU experiment.

### ✅ Check

- `npx --yes wrangler@latest d1 list` shows `learn-and-play` with a `database_id`.
- `cloudflare-production` shows **required reviewers** in the dashboard.
- The token has a D1 permission.

---

## R2 — Read the canonical `workers-rs` config (do this before writing any config)

`wrangler.jsonc` keys, the `main` path and the build command have moved between
`workers-rs` versions. **Never copy a config snippet from a document — including
this one.** Fetch the current template and read it.

### R2.1 — Clone the template repository (recommended)

Outside the project directory, in a throwaway folder:

```powershell
git clone --depth 1 https://github.com/cloudflare/workers-rs "$env:TEMP\workers-rs-probe"
Get-ChildItem "$env:TEMP\workers-rs-probe\templates"
```

### R2.2 — Read these five things

```powershell
# 1. The Wrangler config: `main`, the build command, compatibility_date
Get-Content "$env:TEMP\workers-rs-probe\templates\hello-world\wrangler.toml"

# 2. The release profile settings that keep the wasm binary small
Get-Content "$env:TEMP\workers-rs-probe\templates\hello-world\Cargo.toml"

# 3. The current handler signature (`#[event(fetch)]` and its arguments)
Get-Content "$env:TEMP\workers-rs-probe\templates\hello-world\src\lib.rs"

# 4. Whether the toolchain is pinned, and how
Get-Content "$env:TEMP\workers-rs-probe\rust-toolchain.toml"

# 5. Whether a template uses a workspace or a single crate
Get-ChildItem "$env:TEMP\workers-rs-probe\templates" -Recurse -Filter Cargo.toml |
  Select-Object -ExpandProperty FullName
```

Also skim the `examples/` folder — it is the best documentation of what
`workers-rs` can actually do today (D1, KV, Durable Objects, secrets).

### R2.3 — Write down the four answers

| Question | Answer for this project |
| --- | --- |
| What does `main` point at? | ⬅ **the generated shim, most likely, not the `.rs` file** |
| What is the build command? | ⬅ probably `worker-build --release`, maybe with a `cargo install` |
| Which `[profile.release]` keys? | `lto = true`, `strip = true`, `codegen-units = 1` |
| Is the toolchain pinned? | ⬅ copy the pattern into `worker/rust-toolchain.toml` |

> **Alternative (interactive):** `cargo generate cloudflare/workers-rs` scaffolds a
> project, but it prompts and writes a whole project. Reading the templates from a
> shallow clone (R2.1) is deterministic, non-interactive and leaves nothing behind
> — which also matches this repo's habit of doing generation outside the repository.

### R2.4 — Clean up

```powershell
Remove-Item -Recurse -Force "$env:TEMP\workers-rs-probe"
```

### ✅ Check

You can state, without looking it up again, what `main` must contain for this
project's Wrangler config. If you cannot, re-read R2.2.

## R3 — Repo wiring (the M0 commit)

### R3.1 — Create the workspace

Create `worker/Cargo.toml` as a workspace with two members:

```toml
[workspace]
members = ["crates/core", "crates/app"]
resolver = "2"

[profile.release]
lto = true
strip = true
codegen-units = 1
```

Then `worker/crates/core/Cargo.toml` (**no `worker` dependency** — this is what
makes `cargo test` fast and reliable) and `worker/crates/app/Cargo.toml` (depends
on `worker`, `serde`, `serde_json`, and on `core` through a path dependency). Use
the exact dependency lines you read in R2.

`worker/rust-toolchain.toml`, following the template's pattern:

```toml
[toolchain]
channel = "stable"
targets = ["wasm32-unknown-unknown"]
components = ["rustfmt", "clippy"]
```

`rustup` installs the pinned target automatically when you build inside `worker/`,
which is what keeps CI and your machine in agreement.

### R3.2 — Write `worker/crates/app/src/lib.rs`

Just the health route for M0 — no database, no cookies:

```rust
use worker::*;

#[event(fetch)]
async fn main(req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    let path = req.path();
    if path == "/api/health" {
        let mut res = Response::from_json(&serde_json::json!({ "ok": true }))?;
        res.headers_mut().set("content-type", "application/json")?;
        return Ok(res);
    }
    Response::error("Not found", 404)
}
```

> The exact `Response` API differs between versions — check `examples/` from R2. If
> the template's API differs, follow the template, not this snippet.

### R3.3 — `wrangler.jsonc`

Keep the existing comments' spirit, replace the "growing later" note with what is
actually being added, and use **your** `database_id` from R1.2 and the **`main`
value you verified in R2.3**:

```jsonc
{
  "name": "learn-and-play",
  "main": "<from R2.3 — likely the generated shim>",
  "compatibility_date": "2026-09-20",
  "build": {
    "command": "worker-build --release",
    "cwd": "worker"
  },
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "learn-and-play", "database_id": "<from R1.2>" }
  ]
}
```

Two safety notes:

- `run_worker_first` as an **array** means game pages still never invoke the
  Worker. Do not set it to `true` — that would run Rust on every asset request and
  make the free request budget a real concern.
- `html_handling` stays at its default on purpose: it is what keeps
  `/games/<slug>` → `/games/<slug>/` working exactly as it does today.

### R3.4 — `.gitignore`

```
node_modules/
dist/
.wrangler/
coverage/
worker/target/
worker/build/
.dev.vars
```

`.dev.vars` holds the local pepper and **must never be committed** — same rule as
`.env`.

### R3.5 — `package.json` scripts (optional, but recommended)

```jsonc
"api:dev":   "wrangler dev",
"rust:test": "cargo test --manifest-path worker/Cargo.toml",
"rust:lint": "cargo clippy --manifest-path worker/Cargo.toml --all-targets -- -D warnings"
```

> **`npm run build` stays exactly as it is.** Vite builds `dist/`; the Rust build is
> invoked by Wrangler (`wrangler dev` / `wrangler deploy`) through `build.command`.
> Do not chain `worker-build` into `npm run build` — it would slow every local build
> and CI step for no benefit.

### ✅ Check

```powershell
npm.cmd run build
cargo test --manifest-path worker/Cargo.toml
cargo build --manifest-path worker/crates/app/Cargo.toml --target wasm32-unknown-unknown --release
```

All three succeed. Then continue to R4 to actually run it.

---

## R4 — Local development

### R4.1 — The loop you will use most

```powershell
cd worker
cargo test -p core      # the fast loop: pure logic, no wasm, no network
cargo clippy --all-targets -- -D warnings
cargo fmt
```

### R4.2 — Running the whole thing locally

`wrangler dev` serves BOTH `dist/` and `/api/*` on one port, with a local D1
(Miniflare). Build the assets first:

```powershell
npm.cmd run build
npx --yes wrangler@latest dev
```

Open <http://localhost:8787> — the library and the games are served from `dist/`,
and `/api/health` hits your Rust code.

> **Important:** local dev does **not** enforce the production 10 ms CPU limit the
> same way. Something that runs fine here can fail as `Worker exceeded CPU time`
> in production. That is exactly what R10 exists to check.

### R4.3 — Hitting the API with PowerShell

```powershell
# Health
Invoke-RestMethod http://localhost:8787/api/health

# Create an account and capture the session cookie
Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/account `
  -ContentType 'application/json' -Body '{}' -SessionVariable session

# Use the cookie for the next request
Invoke-RestMethod http://localhost:8787/api/me -WebSession $session

# Look at the cookie
$session.Cookies.GetCookies('http://localhost:8787') | Format-Table Name, HttpOnly, Expires
```

`-SessionVariable` / `-WebSession` is how you keep the `HttpOnly` cookie across
requests without a browser. Browsers accept `Secure` cookies on `localhost`, so a
`Secure`-flagged cookie works in local dev too.

### R4.4 — Optional: the Vite hot-reload loop with a proxy

`npm.cmd run dev` gives instant frontend reload but knows nothing about `/api`.
If you want both, add a proxy to `vite.config.js`:

```js
server: {
  proxy: {
    '/api': 'http://localhost:8787',   // run `wrangler dev` alongside
  },
},
```

Two terminals then: `npx wrangler dev` (API + a built `dist/`) and `npm.cmd run dev`
(frontend HMR, proxying `/api`).

> **Discipline note:** this is the only time you touch `vite.config.js`. Nothing
> else in this plan adds a build-time dependency to the frontend.

### R4.5 — Testing against the real (remote) D1, without deploying

```powershell
npx --yes wrangler@latest dev --remote
```

This binds to the real D1 and the real secrets, so it is a good way to validate a
migration before deploying. It also writes to production data — treat it as
production.

### ✅ Check

- `Invoke-RestMethod http://localhost:8787/api/health` returns `ok = True`.
- `http://localhost:8787/games/sound-labyrinth/` serves the game.

## R5 — Migrations

### R5.1 — Create the file

`worker/migrations/0001_init.sql` — the SQL is in PLAN P10. The filename pattern
Wrangler expects is `<number>_<name>.sql`, applied in ascending order.

### R5.2 — Apply locally first

```powershell
npx --yes wrangler@latest d1 migrations apply learn-and-play --local
npx --yes wrangler@latest d1 migrations list learn-and-play --local
```

### R5.3 — Apply remotely

```powershell
npx --yes wrangler@latest d1 migrations apply learn-and-play --remote
npx --yes wrangler@latest d1 migrations list learn-and-play --remote
```

### R5.4 — Inspect

```powershell
npx --yes wrangler@latest d1 execute learn-and-play --remote `
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

npx --yes wrangler@latest d1 execute learn-and-play --remote `
  --command "SELECT COUNT(*) AS users FROM users;"
```

### R5.5 — Recovery: Time Travel

Free plan keeps **7 days** of point-in-time recovery (PLAN P6).

```powershell
npx --yes wrangler@latest d1 time-travel info learn-and-play
npx --yes wrangler@latest d1 time-travel restore learn-and-play --timestamp=<ISO-8601>
```

Keep a backup before any risky migration:

```powershell
npx --yes wrangler@latest d1 export learn-and-play --remote --output=backup.sql
```

> `backup.sql` contains account data. **Never commit it** — and treat it like the
> credential store it is (it holds `secret_hash` values).

### ✅ Check

- Applying twice changes nothing (the second run reports no pending migrations).
- The table list matches PLAN P10.

## R6 — The pepper secret

The pepper is what stops a leaked database from verifying guesses offline.

### R6.1 — Generate one (32 random bytes, base64)

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

### R6.2 — Local only: `.dev.vars`

Create `.dev.vars` in the repository root (it is already gitignored per R3.4):

```
PEPPER="<the value from R6.1>"
```

### R6.3 — Deployed

```powershell
npx --yes wrangler@latest secret put PEPPER --name learn-and-play
npx --yes wrangler@latest secret list --name learn-and-play
```

`wrangler secret put` prompts for the value and stores it encrypted. It is never
written to the repository and never appears in `wrangler.jsonc`.

> **Rotating the pepper later invalidates every existing player code** (the hash
> changes). If that ever becomes necessary, it needs a migration that re-hashes on
> next sign-in — write it down as a real task, not a one-liner.

### ✅ Check

- `npx --yes wrangler@latest secret list --name learn-and-play` shows `PEPPER`.
- `git status` does **not** list `.dev.vars`.

---

## R7 — CI and deploy workflow edits

### R7.1 — `ci.yml` and the `verify` job of `deploy-cloudflare.yml`

Insert **before** the existing npm steps, so a Rust failure fails fast. Keep the
action versions already used in the file.

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

Why the last step: `cargo test` proves the *host* build only; the wasm target is
what actually ships, and it is the one that can surprise you.

### R7.2 — `deploy-cloudflare.yml`

1. **`verify` job:** add the R7.1 block (so nothing is verified twice *differently*).
2. **`deploy` job:** the same Rust toolchain + cache steps are required there,
   because `wrangler deploy` now runs `build.command` (`worker-build --release`).
   Without Rust in the deploy job, the deploy fails.
3. **Migration step, before the deploy:**

```yaml
- name: Apply D1 migrations
  run: npx wrangler d1 migrations apply learn-and-play --remote
```

   The `deploy` job currently runs `npm ci`-free (it only downloads the `dist`
   artifact), so you may need to add `npm ci` for `npx wrangler`, or use
   `cloudflare/wrangler-action@v4` a second time with an explicit `command`. Check
   what the file looks like when you get there and prefer the smallest change.
4. **Token scope** — see R1.3. A missing D1 permission shows up as an
   authorization error on the migration step.
5. **Approval gate** — do **not** change the `cloudflare-production` environment
   reference. The human approval stays.
6. A failed migration fails the deploy job, so the site can never run code against
   the wrong schema.

### R7.3 — `dependabot.yml` (optional)

Add a `cargo` entry for `/worker` so crates get update PRs alongside npm and
Actions:

```yaml
- package-ecosystem: cargo
  directory: /worker
  schedule:
    interval: weekly
```

### R7.4 — Worker size sanity check

After the first deploy, look at the Worker's size in the dashboard (and the
startup time). Limits: 64 MiB and 1 second startup — you will be far inside, but
check once so you notice if a crate balloons it later.

### ✅ Check

- A push to a branch runs lint, tests, build **and** the Rust steps, all green.
- `deploy-cloudflare.yml` runs on `main` and **waits** for approval.
- After approval, `curl.exe -sI https://play2learn.divanchyshyn.com/api/health`
  shows the Worker responding.

## R8 — Verification checklist

Run the block for the milestone you just finished. These are the acceptance
criteria from PLAN P15.

### R8.0 — The universal checks (run every time)

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
cargo fmt --manifest-path worker/Cargo.toml --all --check
cargo clippy --manifest-path worker/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path worker/Cargo.toml
```

### R8.1 — M0: the games are untouched

Record the game routes **before** deploying, and compare **after**:

```powershell
$routes = @('/', '/games/sound-labyrinth/', '/games/snakes-and-ladders/',
            '/games/shop/', '/games/word-fishing/', '/games/card-battle/',
            '/games/number-line-hop/')
# before
foreach ($r in $routes) { "$r`t" + (curl.exe -s -o NUL -w "%{http_code}" "https://play2learn.divanchyshyn.com$r") }
# ... deploy ...
# after: identical output
```

Also confirm the production build still contains every published route:

```powershell
Get-ChildItem dist/games -Directory | Select-Object -ExpandProperty Name
Get-ChildItem dist/games -Recurse -Filter index.html | Select-Object -ExpandProperty FullName
```

**Pass:** all routes return the same status codes as before, and every game still
has a `dist/games/<slug>/index.html`.

### R8.2 — M1: accounts

- `POST /api/account` (via `Invoke-RestMethod`, R4.3) returns a code once.
- Signing in again with the same code works; with a wrong code it fails with the
  **same** shape of response.
- `GET /api/me` is `signedIn: false` without the cookie and `true` with it.
- `DELETE /api/session` then `GET /api/me` reports signed out.
- `SELECT COUNT(*) FROM users` grew by exactly one per account created.

### R8.3 — M2: sync, and the fail-open guarantee

- Play Sound Labyrinth on one browser profile, finish a picture, then sign in:
  the gallery is uploaded (check `SELECT payload FROM progress`).
- Sign in on a second browser profile: the gallery arrives, and the next run
  collects a picture you had not seen (proof the `round` rebuild works).
- **The fail-open test (the one that must never regress):** with the Worker
  offline (or with DevTools set to offline), open each game and play.
  **Every game must play exactly as before, and no error, spinner or delay may
  appear anywhere.** If it does, stop and fix it before continuing.

### R8.4 — M3: all keys + the Pages decision

- `wordFishing:journal` and `cardBattle:album` sync and merge (catch a word on one
  device, confirm it is in the book on the other).
- If Pages was retired: the old `github.io` URL is gone by choice and the README
  records it. If it was kept: the API works cross-origin, which means CORS headers
  and cross-site cookies were verified deliberately.

### R8.5 — M4: hardening

- `DELETE /api/account` leaves zero rows in `users`, `credentials`, `sessions`,
  `progress` for that id.
- A huge payload is rejected; an unknown `record_key` is rejected; a stale push is
  rejected.
- `npm.cmd run test:coverage` does not fall below the baseline (see PLAN R9 / Q7
  about the currently missing `docs/audit/BASELINE.md`).

---

## R9 — Rollback and recovery

### R9.1 — Decide what actually broke

| Symptom | Almost certainly |
| --- | --- |
| Games do not load at all | the **assets** side (`assets.directory`, or the worker build failed) — this is the serious one |
| Games load, `/api/*` returns 500s | the Worker code or a bad migration |
| Logins fail, everything else is fine | the two auth routes (CPU, secret, or D1) |
| Nothing happens after the first deploy | the approval gate is still waiting — check the workflow run |

Because `run_worker_first` scopes Rust to `/api/*`, "the site is down" should be
almost impossible. If the whole site is down, you changed something in the
`assets` block, and reverting that one key fixes it.

### R9.2 — Roll the Worker back

```powershell
npx --yes wrangler@latest versions list --name learn-and-play
npx --yes wrangler@latest rollback --name learn-and-play
```

A rollback restores the previous version **including its assets**, so it is the
fastest way back to a known-good state.

### R9.3 — Or revert in git

```powershell
git revert <commit>          # or git reset --hard <known-good> on your branch
git push
```

Then approve the deploy as usual. Prefer this when the cause is a code change you
want to review before it comes back.

### R9.4 — Remove the backend entirely

1. `git revert` the `wrangler.jsonc` change and delete `worker/`.
2. Deploy. The site returns to exactly today's static-only Worker.
3. Optionally export the data first:
   `npx --yes wrangler@latest d1 export learn-and-play --remote --output=backup.sql`
4. Delete the D1 database in the dashboard once you are sure.

**The games never depended on the backend, so this is a clean removal.**

### R9.5 — Bad migration

1. `npx --yes wrangler@latest d1 time-travel info learn-and-play`
2. `npx --yes wrangler@latest d1 time-travel restore learn-and-play --timestamp=<before the migration>`
3. Fix forward with a **new** migration file. Never edit an applied migration —
   the migrations table has already recorded it.

### R9.6 — Lost player code

There is no recovery by design (no email, no PII). The account and its progress
are still in D1; only the proof of ownership is gone. Document this plainly in the
README (WP8) and treat it as the strongest argument for adding a passkey or an
email identifier later (PLAN WP9).

## R10 — The CPU-budget experiment (before re-deciding the credential)

Purpose: replace PLAN P7's estimates with **your** numbers, in **your** runtime.
Only needed if you are tempted by email+password, or want to know your headroom.

### R10.1 — Add a dev-only route

```rust
// TEMPORARY, dev-only. Remove before this reaches `main`.
// GET /api/debug/hash?iterations=100000
if req.path() == "/api/debug/hash" {
    let iterations: u32 = req
        .url()?
        .query_pairs()
        .find(|(k, _)| k == "iterations")
        .and_then(|(_, v)| v.parse().ok())
        .unwrap_or(10_000);

    let start = Date::now().as_millis();          // wall clock, as a sanity check
    // ... run the computation (e.g. a PBKDF2/HMAC loop) `iterations` times ...
    let elapsed = Date::now().as_millis() - start;

    return Response::from_json(&serde_json::json!({
        "iterations": iterations,
        "wall_ms": elapsed,
    }));
}
```

### R10.2 — Deploy it somewhere harmless

Do **not** test this on the production domain. Use a preview deployment, which
gets its own `*.workers.dev` URL:

```powershell
npx --yes wrangler@latest versions upload --name learn-and-play
```

### R10.3 — Measure CPU time, not wall time

Wall time includes queueing and I/O, so it only proves "not absurd". The number
that matters is **CPU time**, which Cloudflare reports:

```powershell
npx --yes wrangler@latest tail learn-and-play --format pretty
```

and in the dashboard: **Workers & Pages → your Worker → Metrics** (CPU time per
request) plus **Logs**. Hit the endpoint several times with different `iterations`
values and read the CPU time off the run.

### R10.4 — Read the result

| Observation | Conclusion |
| --- | --- |
| 10,000 iterations is already well over 10 ms of CPU | confirmed: passwords are off the table on Free |
| ~100,000 iterations lands comfortably under 10 ms | a password KDF with a real work factor may fit — revisit Path 1 |
| anything over the line is reported as `Error 1102` | that is the ceiling failing, and it is a hard failure |

### R10.5 — Remove the route

Delete it before merging. A debug endpoint that computes arbitrary hashes should
not survive into production.

## R11 — Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `cargo: command not found` | PATH not refreshed after rustup | close and reopen the terminal |
| `can't find crate for 'std' ... wasm32` | missing target | `rustup target add wasm32-unknown-unknown` |
| `worker-build: command not found` | not installed | `cargo install worker-build --locked` (R0.4) |
| `wasm-opt` download fails | proxy / network / Windows | retry; the bundle is still valid without it, and CI on ubuntu is the authority |
| `cargo test` fails to link | MSVC build tools missing | R0.1, then reopen the terminal |
| `/api/health` 404 in production | `run_worker_first` or `main` wrong | re-check R2.3 and R3.3 |
| `/api/health` 404 locally | `dist/` not built, or the path does not match | `npm.cmd run build`; confirm the path is exactly `/api/health` |
| Games 404 after deploying | `assets.directory` broken | restore `"./dist"`; run R8.1 immediately |
| `Worker exceeded CPU time` (1102) | the 10 ms ceiling | R10; simplify the route, or revisit the credential decision |
| Cookie not sent by the browser | `SameSite` / `Secure` / path mismatch | `SameSite=Lax`, `Secure`, `Path=/`; browsers allow `Secure` on `localhost` |
| Cookie not sent cross-origin | the GitHub Pages origin | retire Pages (R14), or add CORS + `SameSite=None` deliberately |
| `no such table: users` | migration applied to the wrong database | `--local` vs `--remote` mismatch; R5 |
| D1 authorization error in CI | the token lacks a D1 permission | R1.3 |
| Deploy job: environment not found | the environment exists without reviewers | R1.4 — check the protection rules |
| Deploy fails, no Rust available | `build.command` runs `worker-build` | R7.2 step 2 |
| A game shows an error when the API is down | **a real bug** | R8.3's fail-open rule; sync must swallow every failure |
| Rust tests pass locally, fail in CI | toolchain drift | `worker/rust-toolchain.toml`, and match the CI channel |
| Coverage dropped after adding files | new `src/shared/*` modules are untested | PLAN P13's coverage caveat, PLAN Q7 |

## R12 — Command cheat sheet

### Rust (run from the repository root)

```powershell
cargo test --manifest-path worker/Cargo.toml                 # all tests
cargo test -p core                                           # just the pure logic
cargo clippy --manifest-path worker/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path worker/Cargo.toml
cargo build --manifest-path worker/crates/app/Cargo.toml --target wasm32-unknown-unknown --release
```

### Local development

```powershell
npm.cmd run build                       # build dist/ (unchanged)
npx --yes wrangler@latest dev           # dist/ + /api on :8787 with a local D1
npx --yes wrangler@latest dev --remote  # same, against the REAL D1 (careful)
```

### D1

```powershell
npx --yes wrangler@latest d1 list
npx --yes wrangler@latest d1 migrations apply learn-and-play --local
npx --yes wrangler@latest d1 migrations apply learn-and-play --remote
npx --yes wrangler@latest d1 migrations list  learn-and-play --remote
npx --yes wrangler@latest d1 execute learn-and-play --remote --command "SELECT COUNT(*) FROM users;"
npx --yes wrangler@latest d1 export  learn-and-play --remote --output=backup.sql
npx --yes wrangler@latest d1 time-travel info learn-and-play
```

### Secrets and deploys

```powershell
npx --yes wrangler@latest secret put PEPPER --name learn-and-play
npx --yes wrangler@latest secret list --name learn-and-play
npx --yes wrangler@latest versions upload --name learn-and-play   # preview URL
npx --yes wrangler@latest versions list   --name learn-and-play
npx --yes wrangler@latest rollback        --name learn-and-play
npx --yes wrangler@latest tail            --name learn-and-play --format pretty
```

### The project's own gates (unchanged, plus Rust)

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run build
```

## R13 — Permissions: letting the coding agent work on Rust

`opencode.json` currently allows the agent only `npm ci`, `npm run lint`,
`npm run test*`, `npm run build` and read-only git. Without a change, the agent
**cannot run `cargo test`** and therefore cannot work on the backend at all.

### R13.1 — The addition (PLAN Q5)

In `opencode.json` → `agent.build.permission.bash`:

```jsonc
"cargo test*": "allow",
"cargo clippy*": "allow",
"cargo fmt*": "allow",
"cargo check*": "allow",
"cargo build*": "allow"
```

Deliberately **not** allowed:

- anything that deploys (`wrangler deploy`, `wrangler d1 migrations apply --remote`),
- `cargo install*` (it fetches and executes third-party build scripts),
- anything touching `.env` / `.dev.vars`.

The allowlist stays deny-by-default. If a task needs something outside it, the
agent stops and explains — that is by design, not a workaround.

### R13.2 — Update the docs that describe it

- `docs/agent-pipeline.md` — the paragraph listing the allowed shell commands.
- `AGENTS.md` → *Agent pipeline* — the same list, if it names one.

### ✅ Check

`cargo test` appears in the allowlist, `wrangler` appears nowhere, and both
documents agree with the file.

## R14 — Documentation edits (WP0, WP8)

These edits are what make the change *honest*. A code change that leaves the docs
claiming "the app is fully static" is an unfinished change by this repo's own
rules.

### R14.1 — `AGENTS.md`: replace the static-only rule

Current text (under *Stack and deployment*):

> *"Keep the app fully static: no server-side rendering, no API dependencies, no
> runtime secrets. Adding an `/api/*` route, a datastore binding, or anything the
> browser needs at runtime is an amendment to this rule, agreed deliberately,
> never an implementation detail."*

Ready-to-paste replacement:

```markdown
- The games are fully static: no server-side rendering, no API dependency, no
  runtime secret, and nothing the browser needs in order to play. A game page is
  served by Cloudflare's asset router and never invokes the Worker script, so a
  game cannot be broken by the backend.
- Accounts and cross-device progress are a deliberate, human-agreed exception,
  added after this rule was written. They live behind `/api/*` on the same Worker
  (`run_worker_first: ["/api/*"]`), in `worker/` (Rust, compiled to WebAssembly)
  with a D1 database, and behind one runtime secret (the HMAC pepper). What this
  costs: the site now has a database, a second deploy step (migrations), a
  credential to protect, and sync code that can lose progress if it is wrong.
  What it does not cost: the games. Sync is fail-open by rule — a game must keep
  working, unchanged, with the backend entirely down — and the games' stored
  values win for anything still in progress.
- `localStorage` remains the source of truth for play. The API is a mirror: only
  durable achievements sync, the client merges with the game's own codec, and an
  in-progress session or a mute setting never leaves the device.
- Do not add a third-party runtime dependency (an auth service, an email sender,
  a datastore) without a human decision. The current choice is a player code
  (a high-entropy "spillkode"), which is free-tier safe; email + password does not
  fit the Workers Free 10 ms CPU budget and needs a paid plan.
```

### R14.2 — `AGENTS.md`: structure, testing, definition of done, deployment

- **Structure block:** add `worker/` (workspace root, `crates/core` pure logic,
  `crates/app` the Worker, `migrations/`), `docs/backend/PLAN.md`,
  `docs/backend/RUNBOOK.md`, and the new shared modules
  `src/shared/api.js|syncable.js|sync.js|account.js`.
- **Testing section:** add that pure backend logic lives in `worker/crates/core`
  and is covered by `cargo test` on the host target, that the `app` crate stays
  thin on purpose, and that the fail-open behaviour has a test.
- **Definition of done:** `cargo fmt --check`, `cargo clippy -- -D warnings` and
  `cargo test` join `npm run lint/test/build`, and a change that adds a synced key
  must update `src/shared/syncable.js` **and** the Worker's key allowlist.
- **Deployment section:** `wrangler deploy` now compiles Rust and applies D1
  migrations before deploying; the `cloudflare-production` reviewer gate is
  unchanged.

### R14.3 — `README.md`

- The account feature in one honest paragraph: what an account is (a player code),
  what syncs (achievements), what does not (in-progress sessions, mute settings),
  and that **a lost code cannot be recovered by design**, because no email or other
  personal data is stored.
- The new `/api/*` surface and where the backend lives.
- The privacy paragraph (R14.5).
- The game list and routes table stay as they are.

### R14.4 — `wrangler.jsonc` comments

Replace the "Growing later: an `/api/*` route means…" note with a description of
what is actually configured: the Worker script, `run_worker_first: ["/api/*"]`, the
D1 binding — and keep the note that the custom domain is attached in the dashboard
and not in the repository.

### R14.5 — The privacy note (WP8)

Keep it short and true:

- no names, no birthdays, no email addresses, no analytics;
- an account is a uuid, a timestamp, a hashed player code, and the games' own
  progress blobs;
- the blobs are the same values a game already stores on the device, and they
  contain no personal data;
- `DELETE /api/account` erases the account, its credential, its sessions and all
  its progress in one step.

### R14.6 — The GitHub Pages decision

`deploy-pages.yml` publishes a build that **cannot** reach `/api/*` (different
origin). Choose one and write the choice down:

| Choose | Then |
| --- | --- |
| **Retire it** (recommended, and already anticipated by the README) | delete `.github/workflows/deploy-pages.yml`, remove the `github.io` paragraph from the README, and record that the old URLs were retired deliberately |
| **Keep it** | point the build at the API with `VITE_API_BASE=https://play2learn.divanchyshyn.com`, add CORS headers for the `github.io` origin, and set the cookie `SameSite=None; Secure` — then verify that a cross-site login actually works, because this is the fragile path |

### ✅ Check

- No document in the repo still claims the app is purely static, unqualified.
- The costs listed in PLAN P3 appear in some form in `AGENTS.md`.
- The README explains what an account is and that the code cannot be recovered.

---

## Where to start, in one paragraph

If you are picking this up cold in a new session: read `PLAN.md` **P2**, **P7**,
**P11** and **P15**, then start at **R0**. Do **R0 → R1 → R2 → R3 → R4** and stop.
That gets you M0: a Rust Worker answering `/api/health` on the real domain, with
every game page provably unchanged — a complete, valuable, zero-risk experiment
that will also tell you whether Rust-on-Workers is pleasant for you. Only then
continue to R5/R6 (D1 + accounts) and beyond.

