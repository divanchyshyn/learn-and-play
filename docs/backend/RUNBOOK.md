# Backend runbook — accounts and progress on Cloudflare Workers Free + Cloud Run + Neon

> **Status: built.** This runbook takes the accounts and progress backend from
> nothing to a verified production deploy on **free tiers**: Cloudflare Workers
> Free serves the games and proxies `/api/*`, the Rust service runs on **Google
> Cloud Run**, and Postgres lives on **Neon**. It replaces the old
> Cloudflare-Containers runbook: there is no Workers Paid plan, no container in
> the Worker, no test hostname, no Cloudflare Access and no R2 bucket.
>
> Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) once — *The shape of the site*,
> *Accounts* and *Progress and sync* — then work from here. This file is the
> operational record: when a step changes, change it here in the same commit.

Written for **Windows PowerShell**. Use `npm.cmd` (not `npm`) in this repo, and
`curl.exe` (with the extension) so you get the real curl instead of PowerShell's
`Invoke-WebRequest` alias.

## How to use this runbook

Steps are numbered **R0 … R17**, and each ends with a **✅ Check**. Do not move
on from a failed check: every step is designed to fail loudly and early.

Keep **one PowerShell window** open for R0–R10: several steps set `$env:`
variables (`PROJECT_ID`, `REGION`, `API_URL`, `PEPPER`, `DOOR_SECRET`, `RUNTIME_SA`)
that later steps reuse. If a window closes, re-run the small assignment block at
the start of the step you are on.

### The two rules that must never be broken

1. **The money rule.** Everything in this runbook stays inside a free allowance.
   Never set `--min-instances` above 0, never add a keep-warm ping to Cloud Run
   or Neon, keep Cloud Run's `--max-instances` at 2, and check the Google Cloud
   billing report once a month. The free tiers are listed in R12.
2. **The fail-open rule.** A game must never break because the backend is down.
   If any step makes a game show an error, a spinner or a delay, stop: the
   failure-is-invisible rule in `ARCHITECTURE.md` (*Progress and sync*) has been
   broken. R11 has the check for it.

### Jump table

| Step | What it does | Time |
| --- | --- | --- |
| **R0** | Toolchain: Node, Docker, `gcloud`, wrangler, Rust | 30–60 min |
| **R1** | Neon: project, database, connection string | 15 min |
| **R2** | Google Cloud: project, billing, APIs, budget alert | 20 min |
| **R3** | Artifact Registry: the image repository | 10 min |
| **R4** | Service accounts and Workload Identity Federation | 20 min |
| **R5** | Secret Manager: database URL, pepper, door secret | 15 min |
| **R6** | Migrations and the first manual Cloud Run deploy | 40 min |
| **R7** | Cloudflare: point the Worker at the service, set the door secret | 15 min |
| **R8** | GitHub Actions: secrets, variables and the approval gate | 20 min |
| **R9** | The first automated deploy (merge and approve) | 20 min |
| **R10** | Cloudflare Free plan and cleanup of the old stack | 20 min |
| **R11** | Verification: routes, accounts, sync, fail-open | 30 min |
| **R12** | Costs and free-tier guardrails | 10 min |
| **R13** | Backups and restore (manual — there is no nightly job) | 15 min |
| **R14** | Rollback and recovery | — |
| **R15** | Troubleshooting | — |
| **R16** | Command cheat sheet | — |
| **R17** | The coding agent's permissions | — |

### Before you start

You need:

- The Cloudflare zone for `divanchyshyn.com`, with the `learn-and-play` Worker
  and its `play2learn.divanchyshyn.com` custom domain already attached.
- A Neon account (you already have one).
- A Google Cloud account that can create a **billing account**. Google requires
  a payment method even for the free tier; a new account normally gets a
  $300 / 90-day free trial. R2 explains what happens when the trial ends.
- About two hours. R0 is the longest part on a fresh machine.

Nothing in this runbook deploys the live site before **R9**. The first Cloud Run
deploy in R6 is a private smoke test; the live site keeps running the old Worker
until the merge in R9.

---

## R0 — Toolchain

### R0.1 — Node and npm

```powershell
node --version    # 22.x
npm.cmd --version
```

`npm.cmd install` installs Wrangler as a pinned devDependency, so `npx wrangler`
always uses the same version CI uses. Nothing needs a global install.

### R0.2 — Docker Desktop

Docker builds the service image and runs the throwaway Postgres used by the Rust
tests. It is not needed by the running site.

```powershell
docker version --format '{{.Server.Version}}'   # fails while the daemon is stopped
```

Start Docker Desktop and re-run until it prints a version.

### R0.3 — Google Cloud CLI

The CLI is how the project, repository, accounts and secrets are created, and how
the first manual deploy happens.

```powershell
winget install --id Google.CloudSDK -e
# then reopen the terminal
gcloud --version
```

If `winget` does not have the package, use the installer from
<https://cloud.google.com/sdk/docs/install> and run `gcloud init`.

```powershell
gcloud auth login
gcloud auth list
```

**Do not create a service-account JSON key.** CI authenticates with Workload
Identity Federation (R4), and there is no long-lived Google credential anywhere.

### R0.4 — Rust, without fighting Windows Smart App Control

Rust is installed on this machine, but **Smart App Control refuses to run freshly
built unsigned binaries**, which is exactly what `cargo test`, `cargo fmt` and
build scripts produce. The error starts with
`An Application Control policy has blocked this file. (os error 4551)`.

Run the Rust gates inside the official image instead (this is also closer to
CI). The integration tests need the local Postgres, and a container reaches the
host's published port through `host.docker.internal` on Docker Desktop:

```powershell
docker compose up -d db

docker run --rm -v "D:\Repositories\learn-and-play:/work" -w /work/api `
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/learn_and_play `
  -e CARGO_TARGET_DIR=/cargo-target `
  -v lap-cargo-target:/cargo-target `
  -v lap-cargo-registry:/usr/local/cargo/registry `
  rust:1-bookworm sh -c "cargo fmt --all --check && cargo test && cargo clippy --all-targets -- -D warnings"
```

The named volumes cache the dependency build, so the second run is fast.

### R0.5 — A Postgres client (optional, useful)

`psql` is not required by any workflow. The Neon console has a SQL editor, and
this one-liner talks to Neon with the official image:

```powershell
docker run --rm -it postgres:17 psql "<connection string>" -c "select version();"
```

### ✅ Check

```powershell
node --version
npm.cmd install
npx wrangler --version
gcloud --version
docker version --format '{{.Server.Version}}'
```

All five succeed. `git status` still shows no `.dev.vars` or `api/.env`.

---

## R1 — Neon: the database

### R1.1 — The project and its region

Sign in at <https://neon.tech>. Reuse your existing project if you already have
one; otherwise create one with the **US East (Ohio / `aws-us-east-2`)** region,
so it sits next to Cloud Run in `us-central1`.

> If your existing project is in Europe, **keep it**. The extra distance costs
> roughly 100 ms per database query, which only the account page and background
> sync ever notice; the games do not call the API. Moving a Neon project means
> creating a new one and restoring a dump, so it is not worth it for a hobby.

### R1.2 — One database

The production database is `learn_and_play`. There is **no test database any
more**: the pull-request test environment was retired with the paid stack. If an
old `learn_and_play_test` database or branch is still there, drop it in R10.

The schema is created by `api migrate` (R6), never by hand.

### R1.3 — The connection string

In the Neon console open **Connect** and copy the **direct connection** string
(not the pooled one — sqlx uses prepared statements, and the direct string keeps
that simple):

```text
postgresql://<user>:<password>@<host>.neon.tech/learn_and_play?sslmode=require
```

Append `sslmode=require` if it is missing. Keep it out of the repository: it goes
into Secret Manager (R5) and GitHub Actions (R8).

### R1.4 — The free-plan quirks to know before debugging them

- The compute **scales to zero after 5 minutes idle**; the first query after a
  quiet night waits for a wake-up. The service opens its pool lazily and checks a
  connection before handing it out, so this shows up as a slower first request,
  not a failure.
- The free plan keeps **100 CU-hours per project per month**, **1 GB of storage**,
  **5 GB of public network transfer**, **10 branches**, a **6-hour instant restore
  window** and **one manual snapshot**. Do not point a monitor at the database;
  a keep-warm ping burns compute hours and defeats the free allowance.
- All limits and the current numbers: <https://neon.com/faqs/free-plan-limits-and-quotas>.

### ✅ Check

```powershell
docker run --rm -it postgres:17 psql "<learn_and_play connection string>" -c "select version();"
```

It connects and prints a version string.

---

## R2 — Google Cloud: project, billing, APIs

### R2.1 — Create the project

Project IDs are globally unique. Pick one and use it everywhere (the examples
below use `learn-and-play-prod`; if that is taken, choose another and keep using
your choice).

```powershell
$env:PROJECT_ID = "learn-and-play-prod"
$env:REGION = "us-central1"

gcloud projects create $env:PROJECT_ID --name="Learn and Play"
gcloud config set project $env:PROJECT_ID
gcloud config set run/region $env:REGION
```

If the project already exists and belongs to you, skip the create and just set
`$env:PROJECT_ID` to it.

### R2.2 — Billing and the free trial

Google Cloud needs an active billing account even when the usage is inside the
free tier.

1. Open <https://console.cloud.google.com/billing> and create or confirm a
   billing account (name, country, address, payment method).
2. Link it to the project: **Billing → Account management → My projects →
   Learn and Play → Change billing**, or:

   ```powershell
   gcloud billing accounts list
   gcloud billing projects link $env:PROJECT_ID --billing-account=<ACCOUNT_ID>
   ```

3. If you are on the **free trial**: it lasts **90 days** or until the $300
   credit is gone. Before it ends, **upgrade to a paid billing account**
   (*Billing → Overview → Upgrade*). If you do not, the project's resources are
   stopped and, after a **30-day grace period**, permanently deleted. The always-
   free allowances continue after the upgrade; you are only billed for usage
   above them, which this runbook is built to avoid.
   Details: <https://cloud.google.com/free/docs/free-cloud-features>.

### R2.3 — Enable exactly the APIs this needs

```powershell
gcloud services enable `
  run.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  iam.googleapis.com `
  iamcredentials.googleapis.com `
  sts.googleapis.com `
  --project $env:PROJECT_ID
```

`iamcredentials` and `sts` are what Workload Identity Federation uses;
`run`, `artifactregistry` and `secretmanager` are the products themselves.

### R2.4 — A budget alert, so a mistake is visible

Console → **Billing → Budgets & alerts → Create budget**:

| Field | Value |
| --- | --- |
| Name | `learn-and-play-guard` |
| Scope | the project |
| Amount | **$1** (a tripwire, not a spending plan) |
| Alerts | 50 %, 90 %, 100 % by email |

At this site's volume the expected bill is **$0.00**. An email means something
in R12 is being exceeded and needs looking at.

### ✅ Check

```powershell
gcloud config get-value project
gcloud services list --enabled --project $env:PROJECT_ID | Select-String "run.googleapis.com|artifactregistry.googleapis.com|secretmanager.googleapis.com"
```

The project is the one you chose, and all three services are listed.

---

## R3 — Artifact Registry: where the image lives

Cloud Run pulls the service image from Artifact Registry. The free allowance is
0.5 GB-month, so the repository keeps only the newest images.

```powershell
gcloud artifacts repositories create lap `
  --repository-format=docker `
  --location=$env:REGION `
  --description="Learn and Play API images" `
  --project=$env:PROJECT_ID
```

Keep the last three (a rollback needs an image, not an archive):

```powershell
$policy = @'
[
  {
    "name": "keep-last-three",
    "action": { "type": "Keep" },
    "mostRecentVersions": { "keepCount": 3 }
  }
]
'@
$policyPath = Join-Path $env:TEMP "lap-artifact-cleanup.json"
Set-Content -Path $policyPath -Value $policy -Encoding ascii

gcloud artifacts repositories set-cleanup-policies lap `
  --location=$env:REGION `
  --project=$env:PROJECT_ID `
  --policy=$policyPath
```

### ✅ Check

```powershell
gcloud artifacts repositories describe lap --location=$env:REGION --project=$env:PROJECT_ID
```

It prints the repository and the cleanup policy.

---

## R4 — Service accounts and Workload Identity Federation

Two service accounts, deliberately separate:

| Account | Purpose | Roles |
| --- | --- | --- |
| `lap-runtime` | the identity the Cloud Run service runs as | only `secretmanager.secretAccessor` on the three secrets (R5) |
| `lap-deployer` | the identity GitHub Actions deploys as | `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser` on `lap-runtime` |

```powershell
$env:PROJECT_NUMBER = gcloud projects describe $env:PROJECT_ID --format='value(projectNumber)'
$env:RUNTIME_SA = "lap-runtime@$env:PROJECT_ID.iam.gserviceaccount.com"
$env:DEPLOYER_SA = "lap-deployer@$env:PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create lap-runtime `
  --display-name="Learn and Play runtime" --project=$env:PROJECT_ID
gcloud iam service-accounts create lap-deployer `
  --display-name="Learn and Play deployer" --project=$env:PROJECT_ID

gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:$env:DEPLOYER_SA" --role="roles/run.admin" --quiet
gcloud projects add-iam-policy-binding $env:PROJECT_ID `
  --member="serviceAccount:$env:DEPLOYER_SA" --role="roles/artifactregistry.writer" --quiet
gcloud iam service-accounts add-iam-policy-binding $env:RUNTIME_SA `
  --member="serviceAccount:$env:DEPLOYER_SA" `
  --role="roles/iam.serviceAccountUser" --project=$env:PROJECT_ID --quiet
```

The deployer may **deploy as** the runtime identity, which also means it can run
a revision that reads the secrets. Treat the deployer as able to use the secrets,
not as unable to. Its real protection is that only `main`-ref workflows in this
repository can obtain its token (R4.1/R4.2), and the `production` approval gates
the job that uses it.

### R4.1 — The Workload Identity pool

The `ref` claim matters. GitHub's `repository` claim is the same for every branch
of this repository, so a branch workflow could otherwise impersonate the deployer.

```powershell
gcloud iam workload-identity-pools create github `
  --location=global `
  --display-name="GitHub Actions" `
  --project=$env:PROJECT_ID

gcloud iam workload-identity-pools providers create-oidc github `
  --location=global `
  --workload-identity-pool=github `
  --display-name="GitHub OIDC" `
  --issuer-uri="https://token.actions.githubusercontent.com" `
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" `
  --attribute-condition="assertion.repository == 'divanchyshyn/learn-and-play' && assertion.ref == 'refs/heads/main'" `
  --project=$env:PROJECT_ID
```

The condition is the lock: only a workflow run in `divanchyshyn/learn-and-play`
**on `refs/heads/main`** can exchange its GitHub token for Google credentials.

### R4.2 — Let this repository use the deployer

```powershell
gcloud iam service-accounts add-iam-policy-binding $env:DEPLOYER_SA `
  --role="roles/iam.workloadIdentityUser" `
  --member="principalSet://iam.googleapis.com/projects/$env:PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.ref/refs/heads/main" `
  --project=$env:PROJECT_ID --quiet
```

The binding is on the `ref` attribute, not the repository, so even a valid
repository token from a feature branch does not match.

### R4.3 — The three values GitHub will need

Write these down; R8 copies them into repository variables:

```powershell
Write-Output "GCP_PROJECT_ID       = $env:PROJECT_ID"
Write-Output "GCP_REGION           = $env:REGION"
Write-Output "GCP_WIF_PROVIDER     = projects/$env:PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github"
Write-Output "GCP_DEPLOYER_SA      = $env:DEPLOYER_SA"
Write-Output "GCP_RUNTIME_SA       = $env:RUNTIME_SA"
```

### ✅ Check

```powershell
gcloud iam workload-identity-pools providers describe github `
  --location=global --workload-identity-pool=github --project=$env:PROJECT_ID
gcloud iam service-accounts list --project=$env:PROJECT_ID
```

The provider is `ACTIVE`, and both service accounts are listed.

---

## R5 — Secret Manager: the three things the service needs

| Secret | Used as | Meaning |
| --- | --- | --- |
| `lap-database-url` | `DATABASE_URL` | the Neon connection string from R1 |
| `lap-pepper` | `PEPPER` | the argon2 pepper; **changing it invalidates every password** |
| `lap-door-secret` | `DOOR_SECRET` | proves a request came through the Cloudflare Worker |

### R5.1 — Generate the pepper and the door secret

```powershell
function New-SecretString {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [Convert]::ToBase64String($bytes)
}

$env:PEPPER = New-SecretString
$env:DOOR_SECRET = New-SecretString

Write-Output "PEPPER      = $env:PEPPER"
Write-Output "DOOR_SECRET = $env:DOOR_SECRET"
```

**Copy both into your password manager now.** The pepper is permanent: losing it
does not lock anyone out (it lives in the deployment), but rotating it makes
every stored password hash unverifiable, and this design has no password
recovery. The door secret can be rotated, but it must change in **two** places
(Cloud Run and the Worker) in the same window.

### R5.2 — Create the secrets

Use the console if you prefer pasting values (Secret Manager → **Create
secret**), or the CLI. The CLI needs the value in a file with no trailing
newline:

```powershell
function New-Secret([string]$Name, [string]$Value) {
  $path = Join-Path $env:TEMP "$Name.txt"
  [System.IO.File]::WriteAllText($path, $Value)
  gcloud secrets create $Name --data-file=$path --project=$env:PROJECT_ID --replication-policy=automatic
  Remove-Item $path -Force
}

New-Secret "lap-database-url" "<learn_and_play connection string>"
New-Secret "lap-pepper"       $env:PEPPER
New-Secret "lap-door-secret"  $env:DOOR_SECRET
```

### R5.3 — Only the runtime may read them

```powershell
foreach ($name in "lap-database-url", "lap-pepper", "lap-door-secret") {
  gcloud secrets add-iam-policy-binding $name `
    --member="serviceAccount:$env:RUNTIME_SA" `
    --role="roles/secretmanager.secretAccessor" `
    --project=$env:PROJECT_ID --quiet
}
```

### ✅ Check

```powershell
gcloud secrets versions list lap-database-url --project=$env:PROJECT_ID
gcloud secrets versions access latest --secret=lap-pepper --project=$env:PROJECT_ID | ForEach-Object { $_.Length }
```

The first lists version 1; the second prints the length (44 for base64 of 32
bytes). Do not paste the values into logs or chat.

---

## R6 — Migrations and the first manual Cloud Run deploy

This step proves the whole Google Cloud path before the live site depends on it.
It does **not** touch the live Worker.

### R6.1 — Apply the schema to Neon

```powershell
$env:DATABASE_URL = "<learn_and_play connection string>"

docker run --rm -v "D:\Repositories\learn-and-play:/work" -w /work/api `
  -e DATABASE_URL -e CARGO_TARGET_DIR=/cargo-target `
  -v lap-cargo-target:/cargo-target `
  -v lap-cargo-registry:/usr/local/cargo/registry `
  rust:1-bookworm sh -c "cargo run --locked -- migrate"
```

It prints `migrations applied`. Running it twice is a no-op: the applied
migrations are recorded in `_sqlx_migrations`.

### R6.2 — Build and push the image

```powershell
gcloud auth configure-docker "$env:REGION-docker.pkg.dev"

$image = "$env:REGION-docker.pkg.dev/$env:PROJECT_ID/lap/api:manual"
docker build -t $image api
docker push $image
```

The image is `linux/amd64` and distroless, listens on `$PORT` and handles
SIGTERM; Cloud Run supplies all three behaviours.

### R6.3 — Deploy the service

Read the flags as the free-tier contract: one vCPU, half a gigabyte, at most two
instances, no minimum instance, and the three secrets mounted as environment
variables.

```powershell
gcloud run deploy learn-and-play-api `
  --project $env:PROJECT_ID `
  --image $image `
  --region $env:REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --cpu 1 `
  --memory 512Mi `
  --concurrency 20 `
  --min-instances 0 `
  --max-instances 2 `
  --timeout 60 `
  --service-account "lap-runtime@$env:PROJECT_ID.iam.gserviceaccount.com" `
  --set-env-vars "PUBLIC_ORIGIN=https://play2learn.divanchyshyn.com,NOINDEX=1,RUST_LOG=info" `
  --set-secrets "DATABASE_URL=lap-database-url:latest,PEPPER=lap-pepper:latest,DOOR_SECRET=lap-door-secret:latest" `
  --quiet
```

Notes:

- `--allow-unauthenticated` is required because Cloudflare has no Google
  identity. The **door secret** is what protects the public `run.app` address.
- `--min-instances 0` is the cost decision. A warm instance is billed around the
  clock; a cold start is a second or two.
- `PUBLIC_ORIGIN` must be exactly the site's origin (no trailing slash; the
  service trims one if present).

### R6.4 — Record the URL and check the door

```powershell
$env:API_URL = gcloud run services describe learn-and-play-api `
  --project $env:PROJECT_ID --region $env:REGION --format='value(status.url)'
Write-Output $env:API_URL

# Expected: 403, because this request did not come through the front door.
curl.exe -s -o NUL -w "%{http_code}`n" "$env:API_URL/api/health"
```

Then read the logs:

```powershell
gcloud run services logs read learn-and-play-api `
  --project $env:PROJECT_ID --region $env:REGION --limit 50
```

You are looking for `listening` with `database_configured=true` and
`door_configured=true`. If you see the warning
`DOOR_SECRET is not set`, the secret reference in R6.3 is wrong.

### ✅ Check

- `/api/health` on the `run.app` URL answers **403**.
- The logs show `door_configured=true` and no startup error.
- The revision is `Ready` in `gcloud run services describe ... --format='value(status.conditions)'`.

---

## R7 — Cloudflare: point the Worker at the service

Cloudflare stays the host. On the Free plan, static asset requests are free and
unlimited, and only `/api/*` counts toward the 100,000 requests/day Worker
allowance. The paid part of the old stack — Containers and the Durable Object —
is gone from the repository.

### R7.1 — Put the service URL in the Worker configuration

Open `wrangler.jsonc` and replace the empty `API_BASE_URL`:

```jsonc
"vars": {
  "API_BASE_URL": "https://learn-and-play-api-<hash>-uc.a.run.app"
}
```

The value is exactly `$env:API_URL` from R6.4. Commit the change: CI deploys the
Worker from this file.

### R7.2 — Set the door secret on the Worker

```powershell
npx wrangler secret put API_DOOR_SECRET
```

Paste the **same** `DOOR_SECRET` value from R5.1. It is stored encrypted and
never appears in the repository or in `wrangler.jsonc`.

### R7.3 — Validate before deploying

```powershell
npm.cmd run build
npx wrangler deploy --dry-run
npx wrangler secret list
```

`--dry-run` builds and bundles the Worker without publishing it; `secret list`
shows `API_DOOR_SECRET` and nothing else.

> **Do not downgrade the Cloudflare plan yet.** The live site still runs the old
> Worker until R9. Downgrading now would strand the old container before its
> replacement is live.

### ✅ Check

- `API_BASE_URL` in `wrangler.jsonc` is the R6 URL.
- `npx wrangler secret list` shows `API_DOOR_SECRET`.
- `npx wrangler deploy --dry-run` succeeds (no container warnings).

---

## R8 — GitHub Actions: secrets, variables, approval gate

### R8.1 — Create the `production` environment first

Repository → **Settings → Environments → New environment → `production`**:

- **Required reviewers**: add yourself.
- **Deployment branches**: `main` only.

This must exist **before the workflow that references it is merged**. GitHub
silently creates a referenced-but-missing environment **without** protection
rules, which is how a deploy gate disappears without anyone noticing.

### R8.2 — Repository secrets

Repository → **Settings → Secrets and variables → Actions → Secrets**:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the Cloudflare token (Workers Scripts: Edit, Account Settings: Read) |
| `CLOUDFLARE_ACCOUNT_ID` | the account id from the Cloudflare dashboard URL |
| `PRODUCTION_DATABASE_URL` | the Neon connection string from R1 (the migration job uses it) |

The Cloudflare token no longer needs any container permission; the Worker is a
plain script with static assets.

### R8.3 — Repository variables

**Variables** tab:

| Name | Value |
| --- | --- |
| `GCP_PROJECT_ID` | from R4.3 |
| `GCP_REGION` | `us-central1` |
| `GCP_WIF_PROVIDER` | from R4.3 (the full `projects/.../providers/github` path) |
| `GCP_DEPLOYER_SA` | from R4.3 |
| `GCP_RUNTIME_SA` | from R4.3 |
| `GCP_ARTIFACT_REPOSITORY` | optional, defaults to `lap` |
| `GCP_CLOUD_RUN_SERVICE` | optional, defaults to `learn-and-play-api` |

Nothing here is secret — a project id and a service-account email are not
credentials. The Workload Identity provider is the credential exchange, and it
only trusts this repository.

### R8.4 — Confirm the gate that protects `main`

Settings → Branches → the `main` rule. The required checks are:

- `Run game tests` (from `ci.yml`)
- `Check the Rust service` (from `ci.yml`)
- `Analyze JavaScript` (from CodeQL)

The deploy workflow (`deploy.yml`) is not a pull-request check; it runs on
`main` and waits for the `production` approval. Leaving the required checks as
they are is correct.

### ✅ Check

- `production` shows required reviewers and is limited to `main`.
- The three secrets and the GCP variables are present.
- The required checks are unchanged.

---

## R9 — The first automated deploy

### R9.1 — Merge and approve

1. Commit the `API_BASE_URL` change from R7 (on the branch that carries the
   backend change).
2. Open/refresh the pull request and confirm CI is green.
3. **Merge to `main`.**
4. Open **Actions → Deploy production**. The `verify` job runs; the `deploy` job
   waits at *Review pending deployments*. Approve it.

What the approved job does, in order:

1. downloads the verified `dist/` from the `verify` job;
2. applies `api migrate` against Neon (fails here rather than shipping code
   against a wrong schema);
3. signs in to Google with Workload Identity Federation;
4. builds and pushes `api/` to Artifact Registry;
5. deploys the new revision to Cloud Run;
6. deploys the Worker and its assets to Cloudflare;
7. smoke-checks the site, a game page, and the direct `run.app` refusal.

### R9.2 — Check the deploy

```powershell
# The site's API, through the front door
curl.exe -s https://play2learn.divanchyshyn.com/api/health
# Expected: {"ok":true,"db":"up"}

# The direct service address, without the front door
curl.exe -s -o NUL -w "%{http_code}`n" "$env:API_URL/api/health"
# Expected: 403

# A game page
curl.exe -s -o NUL -w "%{http_code}`n" https://play2learn.divanchyshyn.com/games/sound-labyrinth/
# Expected: 200
```

### ✅ Check

- The workflow is green.
- `/api/health` through the site is `200` and `db` is `up`.
- The direct `run.app` request is `403`.
- The library and a game page load.

---

## R10 — Cloudflare Free plan and cleanup

### R10.1 — Downgrade the plan

Dashboard → **Workers & Pages → Plans → Workers Free** (or **Billing →
Subscriptions** and cancel the Workers Paid subscription). Confirm the plan now
reads **Free**. Nothing in the deployed Worker needs a paid feature: the Worker
is a script plus static assets, and `/api/*` is a plain `fetch`.

Why this is safe: static asset requests are **free and unlimited**, and the Free
plan's 100,000 requests/day apply only to the `/api/*` requests that run the
script. If that daily cap is ever reached, the API answers an error and the
games continue to load from the asset router — fail-open, by design.

### R10.2 — Remove what the old stack left behind

Do this in any order, after R9 is verified:

| Remove | Where |
| --- | --- |
| the `learn-and-play-test` Worker | Workers & Pages → the Worker → Delete |
| `test.play2learn.divanchyshyn.com` | the Worker's custom domain, and the DNS record if it remains |
| the Access application for the test hostname | Zero Trust → Access → Applications |
| the Cloudflare R2 bucket (if the old backup workflow was ever enabled) | Cloudflare → R2 → Buckets |
| the `learn_and_play_test` database/branch | Neon console |
| the `cloudflare-test` and `cloudflare-production` environments | GitHub → Settings → Environments |
| the old container-specific token permission | Cloudflare → My Profile → API Tokens |

Git history keeps the old implementation; deleting the resources is what keeps
the account clean and the free tiers honest.

### R10.3 — The answer in one paragraph

**Cloudflare still hosts the site.** It serves `dist/` from its asset router on
the existing custom domain and runs one small Worker script that forwards
`/api/*` to Cloud Run. The paid part was only the Containers product; with the
Rust service on Cloud Run, Cloudflare is back on the Free plan. Keeping it is
better than moving hosting to Cloud Run: assets stay free and global, the API
stays same-origin (no CORS, no `SameSite=None` cookies, no second hostname), and
a backend outage can never take a game down.

### ✅ Check

- Cloudflare shows **Workers Free**.
- The test hostname no longer resolves or is gone.
- The live site and `/api/health` still work.
- GitHub no longer lists the old environments.

---

## R11 — Verification

Run this block after the first deploy and after any change that touches
accounts, sync or the deploy path.

### R11.1 — Every published route

```powershell
$routes = @('/',
            '/account/',
            '/games/sound-labyrinth/',
            '/games/snakes-and-ladders/',
            '/games/shop/',
            '/games/word-fishing/',
            '/games/card-battle/',
            '/games/number-line-hop/')
foreach ($route in $routes) {
  "$route`t" + (curl.exe -s -o NUL -w "%{http_code}" "https://play2learn.divanchyshyn.com$route")
}
```

Every line is `200`. None of them changed because of this migration.

### R11.2 — Accounts

```powershell
# Create an account and capture the session cookie
Invoke-RestMethod -Method Post -Uri https://play2learn.divanchyshyn.com/api/account `
  -ContentType 'application/json' `
  -Body '{"username":"testkid","password":"et-langt-passord"}' `
  -SessionVariable session

Invoke-RestMethod https://play2learn.divanchyshyn.com/api/me -WebSession $session
$session.Cookies.GetCookies('https://play2learn.divanchyshyn.com') |
  Format-Table Name, HttpOnly, Secure, Expires
```

- `/api/me` answers `signedIn: true` and the username.
- The cookie table shows `__Host-lap_sid` with `HttpOnly = True` and
  `Secure = True`.
- A wrong password and an unknown username produce the **same** status and body.
- `DELETE /api/account` leaves no rows for that id (the cascades do the rest).

### R11.3 — Progress, and the fail-open guarantee

- Catch a word in Word Fishing on one browser profile, sign in, then sign in on a
  **fresh** profile: the fishing book and the gallery are there.
- Clear `localStorage` on a signed-in device, reload a game: it waits at most
  1.5 seconds and then shows the saved progress.
- Finish a picture in Sound Labyrinth offline, come online: the picture arrives
  in the other profile without losing what either side had.
- **The fail-open test (must never regress):** with the API unreachable
  (DevTools → Network → Offline, or `gcloud run services update-traffic` to no
  revision), open every game and play.
  **Every game must play exactly as before, with no error, spinner or delay
  anywhere.** If it does not, stop and fix it before continuing.

### R11.4 — Cold start

Sign out, wait at least ten minutes (so Cloud Run scales to zero; Neon also
suspends after five), then sign in once. The first request pays the cold start;
it should complete within the 8-second client timeout. If it consistently takes
longer than that, check the Cloud Run revision and Neon compute in their
consoles before changing anything.

### ✅ Check

Everything above passes, and no game shows anything caused by the backend.

---

## R12 — Costs and free-tier guardrails

### R12.1 — The free allowances this design relies on

Current numbers change; the links are the authority, and R12.4 is the monthly
check that notices a change.

| Service | Free allowance | Used here |
| --- | --- | --- |
| **Cloud Run** (request-based billing) | 2,000,000 requests, 360,000 GB-seconds memory, 180,000 vCPU-seconds, 1 GB internet egress from North America per month | a family's sync traffic is millions of times under the request count; the egress is a few megabytes |
| **Cloudflare Workers Free** | 100,000 Worker requests/day; static assets free and unlimited | only `/api/*` invokes the Worker |
| **Neon Free** | 100 CU-hours per project/month, 1 GB storage, 5 GB transfer, scale to zero after 5 min | a hobby project uses a small fraction |
| **Artifact Registry** | 0.5 GB-month storage | the cleanup policy keeps three small images |
| **Secret Manager** | 6 active secret versions, 10,000 access operations/month | 3 secrets, read at instance start |
| **Cloud Logging** | 50 GiB/month | request logs only, never request bodies |
| **GitHub Actions** | free for public repositories | CI and the deploy |

Links:

- Cloud Run pricing and the always-free tier: <https://cloud.google.com/run/pricing>
- Google Cloud free features: <https://cloud.google.com/free/docs/free-cloud-features>
- Cloudflare static-assets billing: <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>
- Cloudflare Workers limits: <https://developers.cloudflare.com/workers/platform/limits/>
- Neon Free plan: <https://neon.com/faqs/free-plan-limits-and-quotas>
- Artifact Registry pricing: <https://cloud.google.com/artifact-registry/pricing>

### R12.2 — What would cost money

| Change | Effect |
| --- | --- |
| `--min-instances` above 0 | an always-warm instance burns memory and vCPU every hour, far outside the free monthly seconds |
| A cron or monitor pinging the API | keeps Cloud Run and Neon awake around the clock; the same trap |
| A Cloud Run region outside North America | internet egress is only free from North America; at this volume it is still pennies, but it is no longer exactly $0 |
| `--max-instances` above 2 | a traffic spike can start many billed instances; the cap is the cost ceiling |
| Artifact Registry without the cleanup policy | images accumulate past 0.5 GB |
| Neon past 100 CU-hours/month | compute is suspended until the next billing period |

### R12.3 — The trial clock

Free trial: 90 days or $300, whichever ends first. Before it ends, **upgrade to a
paid billing account** (R2.2); otherwise the project stops and its resources are
deleted after 30 days. After the upgrade, the always-free allowances still
apply — the card is a requirement of the platform, not a subscription.

### R12.4 — The monthly check (five minutes)

1. **Google Cloud → Billing → Reports**, scoped to the project: expected
   **$0.00**.
2. **Cloud Run → learn-and-play-api → Metrics**: request count and instance
   time near zero; no minimum instance.
3. **Neon console → Usage**: compute hours and storage well inside the free
   plan.
4. **Cloudflare → Workers & Pages → learn-and-play → Metrics**: `/api/*`
   requests far under 100,000/day.
5. **Artifact Registry → lap**: three images, a few hundred MB at most.

If a number looks wrong, fix the cause, not the alert.

### ✅ Check

The billing report is **$0.00**, and every dashboard is inside its allowance.

---

## R13 — Backups and restore

> **There is no automated backup.** The old nightly `pg_dump` to Cloudflare R2 was retired
> with the paid stack. That is a deliberate decision, and it has a price: if the
> database is dropped, corrupted by a bad migration, or the Neon project is
> deleted, data older than the restore window is **gone**. The games keep
> working; the accounts and progress do not come back. Read this section before
> risky work.

### R13.1 — What you have

- **Instant restore: 6 hours** of change history (capped at 1 GB) in the Neon
  console. This covers "I dropped a table a moment ago".
- **One manual snapshot**, which you replace each time you take a new one. Take
  one **before** a risky migration or a manual database change.
- **Ten branches**, each a copy-on-write point-in-time copy. A
  `backup-YYYY-MM-DD` branch is a cheap second copy for a big change.
- A local `pg_dump` you make yourself (R13.2) survives anything.

### R13.2 — A manual dump (before risky changes)

```powershell
$env:DATABASE_URL = "<learn_and_play connection string>"
$dumpDir = "D:\Backups\learn-and-play"
New-Item -ItemType Directory -Force -Path $dumpDir | Out-Null

docker run --rm -e DATABASE_URL -v "${dumpDir}:/backup" postgres:17 `
  sh -c 'pg_dump "$DATABASE_URL" --no-owner --no-privileges -f /backup/learn-and-play-$(date -u +%Y-%m-%d).sql'

Get-ChildItem $dumpDir
```

Never push a dump through PowerShell `>` redirection: it re-encodes the bytes.
Writing from inside the container to a mounted folder avoids that; compress the
file afterwards with `Compress-Archive` if you want.

### R13.3 — Restore into a scratch database

Create an empty database/branch in Neon and point `DATABASE_URL` at it, then:

```powershell
docker run --rm -e DATABASE_URL -v "${dumpDir}:/backup" postgres:17 `
  sh -c 'psql "$DATABASE_URL" -f /backup/learn-and-play-YYYY-MM-DD.sql'
```

Check the important tables before trusting it:

```powershell
docker run --rm -e DATABASE_URL postgres:17 `
  sh -c 'psql "$DATABASE_URL" -c "select count(*) from users; select count(*) from progress;"'
```

### R13.4 — Restoring production for real

1. Take a Neon snapshot first if you can, so the restore itself is reversible.
2. Restore into a **new** Neon branch/database, never over the live one.
3. Point `DATABASE_URL` (the Secret Manager secret) at it, redeploy, and verify
   a sign-in before dropping the old database.
4. Rotate nothing else: `PEPPER` must stay the same or the restored password
   hashes become unusable.

### ✅ Check

A dump from today exists outside the repository and restores into a scratch
database with the expected row counts.

---

## R14 — Rollback and recovery

### R14.1 — Decide what actually broke

| Symptom | Almost certainly |
| --- | --- |
| Games do not load at all | Cloudflare assets / a failed Worker deploy — the serious one |
| Games load, `/api/*` returns 500/502 | the Rust service or a bad migration |
| `/api/*` returns 403 | the door secret is missing or different on one side |
| The first request of the day takes seconds | Cloud Run cold start + Neon wake — not a fault |
| Sign-ins fail, everything else is fine | argon2/pepper, rate limiting, or the database |
| Deploy job waiting | the `production` approval gate |
| Deploy job fails at the image step | Workload Identity, Artifact Registry, or a missing variable |

### R14.2 — Roll the service back

```powershell
gcloud run revisions list --service learn-and-play-api `
  --project $env:PROJECT_ID --region $env:REGION

gcloud run services update-traffic learn-and-play-api `
  --project $env:PROJECT_ID --region $env:REGION `
  --to-revisions <PREVIOUS_REVISION>=100
```

The image for that revision is still in Artifact Registry (the cleanup policy
keeps three). This is the fastest way back if the service itself is the problem.

### R14.3 — Roll the Worker back

```powershell
npx wrangler versions list --name learn-and-play
npx wrangler rollback --name learn-and-play
```

**Warning:** once the account is on the Free plan, a very old Worker version
that still contains a Container cannot be activated. If the rollback target is
one of those, roll back to the nearest container-free version, or redeploy the
last good commit with the deploy workflow (`workflow_dispatch`).

### R14.4 — Or revert in git

```powershell
git revert <commit>
git push
```

then approve the deploy as usual. Prefer this when the cause is a code change
you want to review before it comes back.

### R14.5 — A bad migration

1. If it just happened: use Neon's **instant restore** (6 hours) to the moment
   before it, or restore your manual snapshot/dump (R13).
2. Fix forward with a **new** migration file. Never edit an applied migration:
   its checksum is recorded in `_sqlx_migrations`.
3. Keep migrations additive (add a column with a default, backfill, then
   tighten) so a rolled-back service still finds a schema it understands.

### R14.6 — Remove the backend entirely

The games never depended on any of this, so this is safe:

1. Revert the commits that added `/api/*`, `wrangler.jsonc`'s `API_BASE_URL`,
   and `api/`.
2. Deploy the Worker. The site is static again, exactly as before accounts.
3. Delete the Cloud Run service, the Artifact Registry repository, the three
   secrets and the Neon database once you are sure.

### R14.7 — A lost password

There is no recovery, by design: an account has no email address, so there is no
verified way back in. The sign-up page says so. The only last resort is a human
with database access setting a new hash by hand.

---

## R15 — Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Direct `run.app` request returns 200 | `DOOR_SECRET` is not set on Cloud Run | R5/R6.3: the `--set-secrets` flag and the runtime SA's `secretAccessor` binding |
| Site `/api/*` returns 403 | Worker secret and Cloud Run secret differ | R7.2: set `API_DOOR_SECRET` to the same value and redeploy the Worker |
| Site `/api/*` returns 503 `api_unconfigured` | `API_BASE_URL` is empty | R7.1: paste the service URL, redeploy |
| Site `/api/*` returns 502 `api_unavailable` | Cloud Run is down or the URL is wrong | `gcloud run services describe`, logs (R6.4) |
| `origin_mismatch` on sign-in | `PUBLIC_ORIGIN` is not the site origin | R6.3 env vars, then redeploy the revision |
| The cookie never arrives | `Set-Cookie` was merged or dropped | check the Worker proxy test and the response headers; the code preserves `getSetCookie()` |
| `relation "users" does not exist` | migrations not applied to *this* database | R6.1 with the right `DATABASE_URL` |
| `/api/health` says `db: down` | Neon suspended or the URL is wrong | Neon console; wait for the wake; check the secret value |
| Cloud Run deploy: permission denied on the secret | runtime SA lacks `secretAccessor` | R5.3 |
| Deploy: `Permission denied` on image push | deployer lacks `artifactregistry.writer` | R4 |
| Deploy: Workload Identity exchange fails | provider condition / repository mismatch | R4.1; the condition must name `divanchyshyn/learn-and-play` |
| Deploy: `iam.serviceAccounts.actAs` denied | deployer lacks `serviceAccountUser` on the runtime SA | R4 |
| Cloudflare returns 429 for `/api/*` | the Free plan's 100,000/day Worker limit was reached | wait for midnight UTC; the games still load. Do not upgrade the plan for this |
| Billing email from the budget alert | something exceeded the free allowance | R12.2, then remove the cause |
| Trial ended and the service stopped | the billing account was never upgraded | R2.2; restore within the 30-day grace period |
| `cargo test` fails with "Application Control policy" | Windows Smart App Control | run the Rust gates in Docker (R0.4) |
| `npm.cmd install` fails with EPERM | a file under `node_modules` is locked | close editors/terminals using it, then retry |
| Panic on startup about `PORT` | a non-numeric `PORT` | Cloud Run supplies `8080`; remove any manual override |

---

## R16 — Command cheat sheet

```powershell
# the project's own gates
npm.cmd run lint
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run build

# Rust (Windows Smart App Control: run it in Docker)
docker compose up -d db
docker run --rm -v "D:\Repositories\learn-and-play:/work" -w /work/api `
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/learn_and_play `
  -e CARGO_TARGET_DIR=/cargo-target `
  -v lap-cargo-target:/cargo-target -v lap-cargo-registry:/usr/local/cargo/registry `
  rust:1-bookworm sh -c "cargo fmt --all --check && cargo test && cargo clippy --all-targets -- -D warnings"
docker build -t learn-and-play-api:ci api

# local stack
docker compose up -d db
cargo run --manifest-path api/Cargo.toml            # the API on :8080
npx wrangler dev                                    # the site + Worker on :8787

# Google Cloud
gcloud run services describe learn-and-play-api --project $env:PROJECT_ID --region $env:REGION
gcloud run revisions list --service learn-and-play-api --project $env:PROJECT_ID --region $env:REGION
gcloud run services logs read learn-and-play-api --project $env:PROJECT_ID --region $env:REGION
gcloud run services update-traffic learn-and-play-api --project $env:PROJECT_ID --region $env:REGION --to-revisions <REVISION>=100
gcloud artifacts repositories describe lap --location=$env:REGION --project=$env:PROJECT_ID
gcloud secrets versions list lap-door-secret --project=$env:PROJECT_ID

# Cloudflare
npx wrangler deploy --dry-run
npx wrangler deploy
npx wrangler tail --name learn-and-play --format pretty
npx wrangler versions list --name learn-and-play
npx wrangler rollback --name learn-and-play

# database
docker run --rm -it postgres:17 psql "<connection string>" -c "\dt"
```

---

## R17 — Permissions: the coding agent's allowlist

`opencode.json` allows the agent `npm ci`, `npm run lint`, `npm run test*`,
`npm run build`, `cargo fmt|check|test|clippy|build`, `docker build` and
read-only git. It deliberately does **not** allow `gcloud`, `wrangler deploy`,
`docker push`, `cargo install` or anything that reads a secret or touches
`.env` / `.dev.vars`.

That matters more now, not less: deploying is a Google Cloud call with a
Workload Identity token, and the agent has neither the CLI nor the credentials.
If a task needs one of those, the agent stops and explains.

### ✅ Check

`opencode.json` still has no `gcloud`/`wrangler` entry, and the review agent's
security section still points at `AGENTS.md` → *Stack and deployment*.

---

## Before you merge: the pre-merge checklist

The backend change only takes effect on `main`. Tick these first:

- [ ] Neon has the production database and the connection string opens it (R1).
- [ ] The Google Cloud project is linked to billing, the APIs are enabled, and
      the $1 budget alert exists (R2).
- [ ] The `lap` repository exists with the keep-last-three policy (R3).
- [ ] `lap-runtime`, `lap-deployer` and the Workload Identity provider exist
      and are bound (R4).
- [ ] The three secrets exist and the runtime account can read them (R5).
- [ ] The first manual Cloud Run deploy answers **403** on its direct address
      and logs `door_configured=true` (R6).
- [ ] `API_BASE_URL` is in `wrangler.jsonc` and `API_DOOR_SECRET` is on the
      Worker (R7).
- [ ] `production` exists **with required reviewers and main-only branches**,
      and the secrets/variables are in place (R8).
- [ ] CI is green on the pull request.

Then merge, approve the deploy, and finish R9 → R11.

## Where to start, in one paragraph

Do **R0 → R1 → R2** first; they are the only steps that need accounts outside
this machine. Then create the repository (R3), the accounts and federation
(R4), and the secrets (R5) — after that the manual smoke deploy in R6 either
works or tells you exactly which Google Cloud piece is wrong. Point Cloudflare
at it (R7), wire the GitHub gate (R8), merge (R9), and only then let the
Cloudflare plan drop to Free (R10). Read `ARCHITECTURE.md` once before you
change any of it: the reasons are recorded there, not here.
