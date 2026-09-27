# Dflow Command Reference

> [繁體中文](commands.md) | **English**

> **You do not need this page for normal use.** Describe what you want to do and the AI
> picks the workflow, stopping at each decision point to confirm with you — that is how
> Dflow is meant to be used, see
> [README "You don't need to learn the commands first"](../README.en.md#you-dont-need-to-learn-the-commands-first).
>
> This page is for three situations: you want to name a flow directly, the AI picked the
> wrong one and you want to correct it, or you are taking stock of what Dflow covers.

## Command Inventory

Dflow commands fall into four roles.

### Entry commands (start a workflow)

Start a workflow run; usable with no existing feature. The three are independent — none
is a prerequisite for another.

| Flow | When | Typical output |
|---|---|---|
| `/dflow:new-feature` | A brand-new capability, or a new business rule the system must implement | Feature directory + `_index.md` + first phase-spec (always T1) |
| `/dflow:modify-existing` | Changing existing behavior — use it when **you are not sure which category the change falls into**; the AI routes internally | T1 → escalate to new-phase / new-feature; T2 → lightweight-spec; T3 → one inline row in `_index.md` |
| `/dflow:bug-fix` | A defect you can state as expected vs actual behavior | The AI judges the tier (usually a T2 lightweight-spec). An orphan bug with no host feature opens a minimal (zero-phase) host: a **functional bug** goes to `bugfix/BUG-{NUMBER}-{slug}`, other standalone T2 / T3 work to `feature/{SPEC-ID}-{slug}` |

⚠ `/dflow:bug-fix` and `/dflow:modify-existing` **run the same flow document**; the tier
comes from the ceremony cascade, not from which command you typed. Picking the wrong one
of these two has no consequence.

### Feature-internal commands (active feature only)

Available only inside a started, active feature. Pointing them at a `completed/` feature
is rejected.

| Flow | When | Typical output |
|---|---|---|
| `/dflow:new-phase` | An active feature needs another implementation slice | A new `phase-spec-{date}-{slug}.md` + Implementation Tasks + implementation / verification + phase marked complete (always T1) |
| `/dflow:finish-feature` | Every phase is done and the feature is being closed out | `git mv` the whole feature dir to `completed/`, sync the BR Snapshot to the BC layer, emit an Integration Summary (no auto-merge) |

### Workflow control (manage an in-progress run)

| Flow | When |
|---|---|
| `/dflow:status` | See which workflow / Step you are in and how far along |
| `/dflow:next` | Confirm a Step Gate (same as saying "OK" / "continue") |
| `/dflow:cancel` | Abandon the current run and return to free conversation. Artifacts already created are kept |

### Standalone tools (callable any time, not tied to a feature or workflow)

| Flow | When | Typical output |
|---|---|---|
| `/dflow:verify` | You need to confirm docs, code, tests and debt records still agree | A drift report across specs, domain docs, implementation, tests and debt |
| `/dflow:pr-review` | A change is ready for review | An SDD/DDD compliance review list with risks, gaps and follow-ups |
| `/dflow:report-dflow-feedback` | You or the AI hit a problem in Dflow itself | A sanitized local draft, field-by-field aligned with the upstream issue form and ready to paste; nothing is sent automatically |

## What should I run? (rule of thumb)

**If you are not sure, you do not have to choose** — say what you want, or just run
`/dflow:modify-existing` and let the AI route it. The table below is for when you want to
skip that and name the flow yourself.

| What I want to do | Command |
|---|---|
| A brand-new capability (unrelated to any existing feature) | `/dflow:new-feature` |
| Add the next planned phase to an active feature | `/dflow:new-phase` |
| Fix a specific bug | `/dflow:bug-fix` |
| **Not sure** how to classify it, but it changes something that exists | `/dflow:modify-existing` |
| Every phase of a feature is done and it needs closing out | `/dflow:finish-feature` |
| Run a change review | `/dflow:pr-review` |
| Check for doc / code drift | `/dflow:verify` |

## How to type them in each AI tool

`/dflow:*` is Dflow's canonical shared vocabulary; each AI tool's `/` parser behaves
differently. Type them like this:

| Tool | How to invoke |
|---|---|
| Claude Code (after installing `--command-adapters`) | `/dflow:<id>`, e.g. `/dflow:new-feature` |
| GitHub Copilot (VS Code Chat) | Use `/dflow-<id>` as the command entry (hyphen, needs `--command-adapters`); natural-language auto-trigger also works. `/dflow:<id>` (colon) is only a way to refer to it in prose, not a command |
| GitHub Copilot CLI | No per-id commands; type `/dflow` to invoke the skill, then describe the workflow in natural language |
| Codex CLI | Plain text without a slash: `dflow:<id>`, e.g. `dflow:new-feature` |

If your tool has no custom slash commands, type the workflow name as an ordinary chat
message. Dflow is Markdown-based workflow material plus a scaffolding CLI, and works with
any AI coding assistant that can read project instructions and repository context.

**Command adapters are not required.** They are opt-in (`dflow configure-agents
--command-adapters`) and only turn these names into native `/` menu entries; natural
language triggering and plain-text invocation work without them.

## CLI commands (run in a terminal, not said to the AI)

The `/dflow:*` names above are workflows for your AI assistant. These four are the
`dflow` CLI itself:

| Command | Purpose |
|---|---|
| `dflow init` | Initialize Dflow in a project: asks for the track, Git policy, AI commit marking, and which AI tools to configure |
| `dflow configure-agents` | Idempotent re-projection: add AI tools, refresh the workflow bundle; `--skills` regenerates skills, `--command-adapters` generates native `/` commands |
| `dflow doctor` | Read-only health check and drift detection |
| `dflow render` | Turn `dflow/specs/` into browsable static HTML for humans |

Each command’s full set of flags is in its own `--help` (for example `dflow render --help`).
When to reach for `init`, `configure-agents` and `render`, and the version-control advice, are
in [README "Get Started"](../README.en.md#get-started); what to do about what `doctor` reports
is in [Upgrading an Existing Dflow Project](upgrading.en.md) and
[When `dflow doctor` is not sure](doctor-uncertainty.en.md).
