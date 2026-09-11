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
   HUMAN REVIEW  →  merge  →  deploy-pages.yml  →  issue closes
```

The only human step is reviewing the pull request. Merging is the same as it has
always been, so the published site is never touched without you.

## Engine

- **Model:** `openrouter/deepseek/deepseek-v4.1-flash` — DeepSeek's V4.1 family,
  1M-token context, built for long-horizon agent work. Roughly $0.15 per million
  input tokens and $0.60 per million output tokens, with very cheap cached reads.
- **Reasoning effort:** `max` everywhere. Set once in `opencode.json` under
  `provider.openrouter.models."deepseek/deepseek-v4.1-flash".options`, so the
  `build` agent, the `review` agent and any subagent all inherit it. The model's
  provider only accepts `low`, `high` and `max`, so `max` is the ceiling.
- **Provider lock:** `enabled_providers: ["openrouter"]` means no other provider
  can be loaded even if another key leaks into the environment.

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

1. **Add the provider key.** Settings → Secrets and variables → Actions → new
   repository secret named `OPENROUTER_API_KEY`. Also set a spend limit on the
   OpenRouter key so a runaway loop cannot surprise you.
2. **Protect `main`.** Settings → Branches → add a rule for `main`:
   - require a pull request before merging
   - require at least one approval
   - require status checks: `Run game tests` (ci.yml) and `Analyze JavaScript` (CodeQL)
   - require branches to be up to date, and block force pushes
   This is the setting that makes every other promise here true — it is what
   stops an agent (or anyone) from reaching the published site unreviewed.
3. **Install the OpenCode GitHub App.** Run `opencode github install` locally, or
   install `github.com/apps/opencode-agent` on this repository. The pull request
   is opened with the app's token, which matters: pull requests opened with the
   default `GITHUB_TOKEN` do **not** trigger other workflows, so CI and the
   reviewer would never run on the agent's work.
4. **Create labels.** Issues → Labels → add `ai-ready`, `ai-in-progress`,
   `ai-blocked`, `skip-ai-review`, and optionally `risk:low` / `risk:high`.
5. **Enable CodeQL.** Settings → Code scanning. CodeQL is free for public
   repositories; it uses the workflow in `codeql.yml`.

## Day to day

- **Start the agent:** add the `ai-ready` label to an issue. Or comment `/oc`
  (or `/opencode`) on any issue for a one-off run.
- **Skip the reviewer:** add the `skip-ai-review` label to a pull request.
- **Steer a pull request:** comment on it with `/oc <instruction>`.
- **Run it locally first:** install the CLI (`npm i -g opencode-ai`), run
  `opencode auth login` and choose OpenRouter, then `opencode models` to confirm
  `openrouter/deepseek/deepseek-v4.1-flash` is listed. A dry run:

  ```powershell
  opencode run --auto --model openrouter/deepseek/deepseek-v4.1-flash "summarise AGENTS.md"
  ```
  On Windows the OpenCode docs recommend WSL for the best experience.

## Guardrails

| Threat | What stops it |
| --- | --- |
| Prompt injection from an issue or diff telling the agent to exfiltrate | `webfetch`, `websearch` and `external_directory` are denied; the bash allowlist has no `curl`, `wget`, `env` or `printenv` |
| The agent reaching production | Branch protection on `main`; the agent only ever opens a pull request |
| Adding dependencies behind your back | `npm install` is denied; only `npm ci` is allowed. The agent must stop and ask |
| Secrets leaking into the agent's shell | `OPENROUTER_API_KEY` is the only secret in the job, and the bash allowlist cannot read the environment |
| The reviewer changing what it reviews | The `review` agent denies `edit`; the review workflow grants `contents: read` |
| Untrusted forks | The reviewer only runs for pull requests whose head repo is this repository |
| Runaway loops or cost | `timeout-minutes: 30` on both agent jobs, plus an OpenRouter spend limit |
| Supply chain in the action itself | `anomalyco/opencode/github` is pinned to the release tag `v1.18.30` |

### Two honest caveats

- Pinning the action tag pins the **workflow script**, not the agent. The action
  boots by downloading the latest `opencode` binary, so the agent version still
  moves. Pinning fully would mean replacing the action with an explicit
  `curl | bash` install of a fixed version — worth doing if you want strict
  reproducibility.
- The reviewer's read-only guarantee comes from the `review` agent's `edit: deny`
  permission, not from the workflow `permissions:` block, because the OpenCode
  App token (not `GITHUB_TOKEN`) is what performs the API calls.

## Costs

Reasoning tokens bill as output. A chatty turn at `max` effort might emit 30k
output tokens, which is about $0.018; input is mostly cache reads at $0.003 per
million. A full agent run of ~50 turns typically lands well under a dollar, so
`max` everywhere is the right default here.

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
- **Tests fail only in CI.** The local convention is `npm.cmd` on Windows; CI
  uses plain `npm` on Linux. Run `npm.cmd run lint; npm.cmd run test; npm.cmd run build`
  before handing off.
