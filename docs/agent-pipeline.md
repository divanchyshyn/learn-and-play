# Coding agent pipeline

How this repository turns a GitHub issue into a reviewed pull request with a
coding agent, and what a human still has to do.

## The shape of it

```
Issue labelled `ai-ready`  (or a `/oc` comment)
        │
        ▼
.github/workflows/opencode.yml
   • checks out the default branch on a Linux runner
   • `npm ci` so the agent can run the real toolchain
   • runs OpenCode with the `build` agent
   • the agent must satisfy AGENTS.md -> "Definition of done"
        │
        ▼
   branch + pull request  (body closes the issue)
        │
        ├─ .github/workflows/ci.yml              lint + test + build   (required)
        ├─ .github/workflows/codeql.yml          security analysis     (required)
        └─ .github/workflows/opencode-review.yml read-only review comment
        │
        ▼
   HUMAN REVIEW  →  merge  →  deploy-cloudflare.yml: verify  →  APPROVE  →  live
```

The human steps are reviewing the pull request and approving the production
deploy. Merging is the same as it has always been, and the live site is still
never touched without you.

## Engine

- **Model:** `deepseek/deepseek-flash` — DeepSeek's V4.1 Flash, called straight on
  DeepSeek's own API instead of through a gateway. 1M-token context, built for
  long-horizon agent work. Off-peak it costs about $0.15 per million input tokens
  and $0.60 per million output tokens, with cache reads at $0.003 per million;
  peak hours (01:00–04:00 and 06:00–10:00 UTC, Monday to Friday) double all three.
- **Reasoning effort:** `max` everywhere. Set once in `opencode.json` under
  `provider.deepseek.models."deepseek-flash".options`, so the `build` agent, the
  `review` agent and any subagent all inherit it. Thinking mode is on by default
  and `reasoning_effort` accepts `low`, `high` and `max`, so `max` is the ceiling.
- **Provider lock:** `enabled_providers: ["deepseek"]` means no other provider
  can be loaded even if another key leaks into the environment.
- **Variant:** the `review` workflow and the GitHub action both pass `variant:
  max` / `--variant max`. The available variants come from the model's
  `reasoning_options` on Models.dev (`low`, `high`, `max`), so they survive the
  move to the direct API.

## Files that make it work

| File | Purpose |
| --- | --- |
| `opencode.json` | Model, provider lock, and the `build` agent's permission allowlist |
| `.opencode/agents/review.md` | Read-only reviewer agent (`mode: primary`, because the GitHub action only accepts primary agents) |
| `.github/workflows/opencode.yml` | Starts the agent from an issue label or `/oc` comment |
| `.github/workflows/opencode-review.yml` | Runs the reviewer on every in-repo pull request |
| `.github/workflows/ci.yml` | lint + test + build, now including the build |
| `.github/workflows/codeql.yml` | CodeQL analysis on pull requests and weekly |
| `.github/dependabot.yml` | Weekly npm and actions updates, grouped |
| `.github/ISSUE_TEMPLATE/` | Issue forms whose fields double as the agent's brief |
| `AGENTS.md` | The contract: conventions, testing rules, definition of done |

## One-time setup

These are repository settings, not files, so they have to be done by hand once.

1. **Create a dedicated DeepSeek key.** Sign in at
   [platform.deepseek.com](https://platform.deepseek.com), open **API keys**, and
   create a key named `learn-and-play CI`. Do not reuse your IDE key. DeepSeek is
   prepaid and has no per-key credit limit, so the real brake is the account
   balance: top up a small amount (about $10–$20 is generous for this model) and
   check the balance at the dashboard when a run fails unexpectedly. A separate
   key means you can delete or rotate the CI key without breaking your local
   setup.

   One regression against OpenRouter: GitHub secret scanning covers DeepSeek keys
   only on private repositories with Advanced Security, while OpenRouter's key
   pattern is on the public list. A leaked `DEEPSEEK_API_KEY` in a public
   repository is therefore **not** detected automatically — treat it as
   un-scanned and delete the key as soon as it is exposed.
2. **Add it as a secret.** Settings → Secrets and variables → Actions → new
   repository secret named `DEEPSEEK_API_KEY`. Then delete the old
   `OPENROUTER_API_KEY` secret and disable the OpenRouter key itself.
3. **Protect `main`.** Settings → Branches → add a rule for `main`:
   - require a pull request before merging
   - require at least one approval
   - require status checks: `Run game tests` (ci.yml) and `Analyze JavaScript` (CodeQL)
   - require branches to be up to date, and block force pushes
   This is the setting that makes every other promise here true — it is what
   stops an agent (or anyone) from reaching the published site unreviewed.
4. **Install the OpenCode GitHub App.** Run `opencode github install` locally, or
   install `github.com/apps/opencode-agent` on this repository. The pull request
   is opened with the app's token, which matters: pull requests opened with the
   default `GITHUB_TOKEN` do **not** trigger other workflows, so CI and the
   reviewer would never run on the agent's work.
5. **Create labels.** Issues → Labels → add `ai-ready`, `ai-in-progress`,
   `ai-blocked`, `skip-ai-review`, and optionally `risk:low` / `risk:high`.
6. **Enable CodeQL.** Settings → Code scanning. CodeQL is free for public
   repositories; it uses the workflow in `codeql.yml`.
7. **Gate the production deploy.** Settings → Environments → new environment
   named `cloudflare-production`, with yourself under **Required reviewers**
   (optionally restricted to the `main` branch). The `deploy-cloudflare.yml`
   deploy job references that environment, so it waits for your approval before
   it can reach the live site, while `deploy-pages.yml` keeps publishing
   automatically. Create the environment *before* merging a change to that
   workflow: an environment that is referenced but not yet configured is created
   empty, so that first deploy would run unreviewed. If a required-reviewer rule
   ever appears on the `github-pages` environment, Pages starts waiting for
   approval too – remove the rule there to keep Pages hands-free.

## Day to day

- **Start the agent:** add the `ai-ready` label to an issue. Or comment `/oc`
  (or `/opencode`) on any issue for a one-off run.
- **Skip the reviewer:** add the `skip-ai-review` label to a pull request.
  Dependabot pull requests are skipped automatically to save review spend; its
  dependency bumps are covered by `ci.yml`.
- **Steer a pull request:** comment on it with `/oc <instruction>`, or comment on
  a specific line in the pull request's **Files** tab to have the agent work on
  just that spot. Both go through the `comment` job in `opencode.yml`.
- **Run it locally first:** install the CLI (`npm i -g opencode-ai`), run
  `opencode auth login` and choose DeepSeek, then `opencode models` to confirm
  `deepseek/deepseek-flash` is listed. A dry run:

  ```powershell
  opencode run --auto --model deepseek/deepseek-flash "summarise AGENTS.md"
  ```
  On Windows the OpenCode docs recommend WSL for the best experience.

## Guardrails

| Threat | What stops it |
| --- | --- |
| Prompt injection from an issue or diff telling the agent to exfiltrate | `webfetch`, `websearch` and `external_directory` are denied; the bash allowlist has no `curl`, `wget`, `env` or `printenv` |
| The agent reaching production | Branch protection on `main`; the agent only ever opens a pull request. The Cloudflare deploy job additionally waits on the `cloudflare-production` environment's required reviewers, so even a merged change needs a human approval before it goes live |
| Adding dependencies behind your back | `npm install` is denied; only `npm ci` is allowed. The agent must stop and ask |
| Secrets leaking into the agent's shell | `DEEPSEEK_API_KEY` is the only secret in the job, and the bash allowlist cannot read the environment |
| The reviewer changing what it reviews | The `review` agent denies `edit`; the workflow's `GITHUB_TOKEN` has `contents: read` plus `pull-requests: write`, which is only good for posting comments |
| Untrusted forks | The reviewer only runs for pull requests whose head repo is this repository, so forks never see the secrets |
| An account with no repository permission driving the agent | The `opencode.yml` action refuses any actor without `admin`/`write` permission, so bot-authored comment events can never drive the build agent. The reviewer no longer uses that action — it posts with `GITHUB_TOKEN`, which needs no such assertion, so bot-authored pull requests (the agent's own) still get reviewed |
| Runaway loops or cost | `timeout-minutes: 30` on both agent jobs, plus a prepaid DeepSeek balance kept deliberately small |
| Supply chain in the action itself | `anomalyco/opencode/github` (the build job) is pinned to `v2.0.3`; the reviewer installs a fixed `opencode` binary (1.18.31) and caches it, so the install only runs on a cache miss |

### Two honest caveats

- Pinning the action tag pins the **workflow script**, not the agent. The
  `opencode.yml` build job boots by downloading the latest `opencode` binary, so
  the agent version still moves there. The reviewer is pinned fully instead: it
  installs `opencode` 1.18.31 directly with `curl | bash` and caches the binary.
  Pin the build job the same way if you want strict reproducibility.
- The reviewer's read-only guarantee comes from the `review` agent's `edit: deny`
  permission, not from the workflow `permissions:` block. The review comment is
  posted with the workflow's `GITHUB_TOKEN` (`pull-requests: write`), which is
  the only thing that token is trusted for.

## Costs

Reasoning tokens bill as output. A chatty turn at `max` effort might emit 30k
output tokens, which is about $0.018 off-peak and about $0.036 in peak hours;
input is mostly cache reads at $0.003 per million off-peak. A full agent run of
~50 turns typically lands well under a dollar off-peak, so `max` everywhere is
the right default here. DeepSeek charges the peak rate between 01:00–04:00 and
06:00–10:00 UTC, Monday to Friday, excluding Chinese public holidays, so a long
run started in that window costs up to twice as much.

## Where this goes next

Phases 0–3 are in place: governance, the pipelines, the issue-to-pull-request
flow and the automated review. Two optional steps remain, and both should wait
until the current loop feels boring and reliable:

- **Auto-close on merge.** Already works if the agent writes `Closes #<n>` in the
  pull request body. Confirm it on the first real run.
- **Widen autonomy.** Auto-merge for Dependabot patch bumps and documents-only
  changes once CI and the reviewer have a track record. Keep anything risky —
  new games, shared helpers, workflows — behind human review permanently.

## Troubleshooting

- **No workflow ran after labelling.** Check the label name is exactly `ai-ready`.
- **The agent ran but no pull request appeared.** Read the job log; without the
  OpenCode App installed, the token exchange step fails.
- **CI never ran on the agent's pull request.** The pull request was opened with
  `GITHUB_TOKEN` instead of the app token.
- **The reviewer said nothing.** Check the pull request is not from a fork and
  does not carry `skip-ai-review`, and that the agent name is `review`.
- **The reviewer failed with `User opencode-agent[bot] does not have write
  permissions` (run 35502128859).** The `anomalyco/opencode/github` action
  asserts, before it does anything else, that the event actor has `admin` or
  `write` permission on the repository. For a `pull_request` event the actor is
  the PR author, and the agent's own bot account is never a collaborator, so the
  reviewer died on the first agent pull request before reviewing anything.
  Dependabot had already hit the same assertion earlier. The review workflow no
  longer uses that action: it runs `opencode run` headless and posts the comment
  with `GITHUB_TOKEN`, which needs no actor assertion. If this error ever shows
  up again it will come from `opencode.yml` (the build or `/oc` comment job)
  triggered by a bot account — add that login to the job's `if` condition, or
  label the pull request `skip-ai-review` and re-run.
- **`opencode github install` overwrote `opencode.yml`.** The installer writes its
  stock template, which drops the `ai-ready` label trigger, the job timeouts and
  the pinned action ref. Once the tuned version is committed, restore it with
  `git checkout -- .github/workflows/opencode.yml`. The action itself never
  rewrites the file at run time, so this only happens when you run the installer.
- **The agent failed with a DeepSeek authentication or balance error.** DeepSeek
  is prepaid and has no per-key credit limit, so top up the account balance at
  platform.deepseek.com, and check that `DEEPSEEK_API_KEY` still points at a key
  that has not been deleted. A `model not found` error means DeepSeek renamed the
  model: run `opencode models`, then update the id in `opencode.json`, both
  workflows and `.opencode/agents/review.md`.
- **Tests fail only in CI.** The local convention is `npm.cmd` on Windows; CI
  uses plain `npm` on Linux. Run `npm.cmd run lint; npm.cmd run test; npm.cmd run build`
  before handing off.
