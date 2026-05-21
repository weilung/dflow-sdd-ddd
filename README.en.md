# Dflow

[繁體中文](README.md) | **English**

> **AI collaboration without DDD = accelerated chaos; with DDD = AI constrained inside the domain model upfront.**
> A Rich Domain Model (business rules encoded into domain objects themselves, not scattered across services or prompts) puts invariants, business rules, and Aggregate boundaries inside the objects — every line of code the AI writes must pass through that contract. Dflow treats DDD as the semantic backbone of SDD.

Dflow is a spec-first workflow kit for AI-assisted software development. It gives your AI coding agent a concrete process for turning change requests into structured specs, domain language, implementation plans, drift checks, and reviewable code instead of jumping straight from prompt to code.

The goal is not the process itself, but repeatable software change with clearer meaning, fewer scattered rules, and less prompt-dependent behavior.

## Key Features

| Feature | What it gives engineering teams |
|---|---|
| **Spec-first development** | Pushes alignment to before implementation — avoids the round-trip where AI jumps from an ambiguous prompt straight to code, then has to be redirected after the wrong direction lands. |
| **Greenfield and Brownfield tracks** | Not limited to new projects; an existing codebase doesn't need a big-bang refactor first — you can change behavior while progressively extracting scattered domain rules. |
| **Hybrid workflow control** | Not autopilot, not pure manual — commands for explicit entry, AI nudges when you forget to start a flow, and pauses at key decisions to confirm direction. The three layers together keep AI from running off-track without turning every step into bureaucratic overhead. |
| **DDD semantic backbone** | AI is most likely to invent plausible-but-wrong business rules (when a discount is valid, what an account can or cannot do) — review rarely catches this. Write the domain language, boundaries, and rules down first, and AI fills in details under project constraints instead of by guess. |
| **Three-layer documentation model** | Matches how feature branches actually evolve: phase (one propose-implement-archive cycle) / feature (the whole branch's running state and resume pointer) / system (cross-feature long-term knowledge). Many spec tools only ship phase + system, which breaks down when a feature branch spans multiple phases. Detailed below. |
| **Change-depth-based tiers (T1/T2/T3)** | AI scales specification and verification by change depth: color/typo gets one inline row in `_index.md`; bug fixes get a lightweight spec plus focused verification; new features or bounded-context-level changes go through a full phase-spec plus layer-by-layer implementation planning / verification. Small changes don't get dragged down by the process. |
| **Drift verification** | `/dflow:verify` cross-checks specs, domain documents, implementation, tests, and tech-debt records to surface the "documentation still describes the old behavior" drift that PR review by eye usually misses. |
| **Multi-AI-tool rule sharing** | A canonical project guide plus thin tool-specific shims (`CLAUDE.md` / `AGENTS.md` / Copilot instructions) — teams switching between Claude, Codex, and Copilot don't have to maintain multiple copies of workflow rules. |

## Get Started

Prerequisites: Node.js / npm installed, with the global npm bin directory on
your `PATH`.

Install Dflow globally, then run it from the root of the project you want to
adopt it in:

```bash
npm install -g dflow-sdd-ddd
dflow init
```

The init flow asks whether the project is greenfield or brownfield, then
previews the files it will create. Existing files are not overwritten. Init
creates workflow documentation and AI instruction files; it does not inspect,
refactor, or migrate your application code.

If the project is already initialized and you later add another AI coding
tool, run:

```bash
dflow configure-agents
```

If you also want tool-native command / prompt wrappers, use the opt-in mode:

```bash
dflow configure-agents --command-adapters
```

This command only configures AI instruction files and optional command
adapters. It does not rerun project initialization or touch existing specs.

### Alternative: try without installing

If you cannot or do not want to do a global install (no admin rights,
ephemeral environment, or one-shot evaluation), every Dflow CLI command is
also available through `npx`:

```bash
npx dflow-sdd-ddd init
npx dflow-sdd-ddd doctor
npx dflow-sdd-ddd configure-agents
```

When using this path, all commands in the same session must also use the full
`npx dflow-sdd-ddd <subcommand>` form. The bare `dflow` alias is only
available after a global install.

### Check legacy artifacts (optional)

To check whether the project still has legacy or pre-V1 artifacts (such as
a top-level `specs/` directory or a `_共用/` directory left over from older
Dflow forms), run:

```bash
dflow doctor
```

`doctor` is a read-only health check. It never modifies files; it only
reports findings and points at the migration guide. Freshly initialized
projects won't have legacy artifacts and can skip this step.

### Start using the Dflow workflow

After init, start work through the Dflow workflow in your AI coding agent:

```text
/dflow:new-feature
/dflow:modify-existing
/dflow:bug-fix
/dflow:new-phase
/dflow:finish-feature
/dflow:verify
/dflow:pr-review
```

`/dflow:*` is Dflow's canonical shared vocabulary; each AI tool's `/` parser
behaves differently. Use these practical invocation forms:

| Tool | Recommended invocation |
|---|---|
| Claude Code after `--command-adapters` | `/dflow:<id>`, for example `/dflow:new-feature` |
| GitHub Copilot | `/dflow:<id>` as chat text; `/dflow-<id>` in the VS Code prompt menu |
| Codex CLI | no-slash plain text `dflow:<id>`, for example `dflow:new-feature` |

If your tool does not support custom slash commands, use the workflow name as
a plain instruction in chat. Dflow is Markdown-based workflow material plus a
scaffolding CLI, so it can be used with AI coding agents that can read project
instructions and repository context.

For the first adoption pass, use a branch or disposable sample project so your
team can inspect the generated `dflow/specs/` workspace before bringing the
workflow into an active codebase.

For a guided evaluation walk-through — what `init` creates, AI tool support,
track choice, and a 30-minute sample-project playbook — see [Evaluating
Dflow](docs/evaluating-dflow.en.md). For end-to-end scenario walk-throughs of
Greenfield and Brownfield workflows with worked spec outputs, see the
[`tutorial/`](tutorial/README.md) index.

## Project Tracks

| Track | Use it when | Main outcome |
|---|---|---|
| **Greenfield** | You are starting a new system or a new bounded area with room to shape architecture and domain model early. | Clean spec baseline, domain model ownership, feature-by-feature implementation through SDD. |
| **Brownfield** | You are adding or changing behavior in an existing codebase where business rules may already be scattered. | Progressive domain extraction, safer change planning, and migration-ready domain knowledge. |

These tracks distinguish the project's starting state (new vs existing codebase), not a framework choice; the design makes no assumption about language or stack. Dflow should be read as a workflow system for software teams that want AI assistance without giving up domain clarity.

Filled-in examples for common stacks (.NET, Java/Spring, Node/TypeScript, Python, Go, PHP/Laravel) are in [`docs/examples-by-stack.md`](./docs/examples-by-stack.md).

### Track Choice and Migration

Track is fixed at `dflow init` time and **cannot be switched in-place** (there is no `/dflow:switch-to-greenfield` command). Brownfield is by design a preparation path toward Greenfield: domain code extracted into the project's domain layer (e.g., `src/Domain/`) and the domain documents under `dflow/specs/domain/` (glossary, rules, models, events) are all migration-ready assets — at the eventual rewrite (a new project + fresh `dflow init` with Greenfield track), they can be lifted directly. `dflow/specs/migration/tech-debt.md` is the brownfield-specific migration debt log.

Per-BC migration is also supported — once a Bounded Context's business logic is fully extracted into the domain layer and the presentation layer is reduced to UI binding, that BC is already in a Clean Architecture state; the whole system doesn't have to switch in one go. The brownfield `/dflow:modify-existing`'s "assess presentation-layer business logic" step becomes a no-op for that BC naturally.

## Workflow Model

Dflow uses a hybrid design with three layers of user-AI interaction:

| Layer | Purpose |
|---|---|
| **Command-first entry** | Developers intentionally start work with commands such as `/dflow:new-feature` or `/dflow:modify-existing`. |
| **Auto-trigger safety net** | When the conversation clearly implies a feature, phase, bug fix, verification, or review, the AI should suggest the matching Dflow flow. |
| **Transparent decision checkpoints** | At key moments (flow entry, Step Gates between major steps, important internal steps), the AI stops to announce what it is about to do and waits for the developer to approve direction, preventing autopilot drift. |

### Workflow Internal Structure

Each time you issue a `/dflow:xxx` command, a **Workflow run** starts. Inside a Workflow run there are numbered **Step**s (e.g. `/dflow:new-feature` has 8 Steps). Step-to-Step boundaries come in two kinds:

- **Step Gate** — AI must stop, announce the upcoming Step, and wait for the developer to confirm direction. Confirmation can be `/dflow:next`, natural-language "OK / continue", or implicit (developer just provides the data the next Step needs).
- **Step-internal transition** — AI announces "Step N complete, entering Step N+1" and proceeds without waiting.

Step Gates are not placed between every Step. In `/dflow:new-feature`'s 8 Steps, only 4 are Step Gates; the rest are step-internal transitions.

### Change-depth-based tiers

Dflow scales specification, implementation planning, and verification by the depth of the change (T1 / T2 / T3 tiers):

| Tier | Typical use | Expected weight |
|---|---|---|
| **T1 Heavy** | New feature, new phase, new Aggregate / Bounded Context, architectural change, new business rule | Full phase-spec, domain modeling, behavior examples, implementation plan, verification and completion checks |
| **T2 Light** | Bug fix (logic error), UI input validation tweak, narrow change with a BR (business rule) delta | Lightweight spec, focused verification, confirm the fix lands in the correct architectural layer |
| **T3 Trivial** | Button color, copy/text fix, typo, pure formatting — **no business rule change, no Domain concept change, no data structure change** | One inline row in `_index.md`, no separate spec file |

Tier choice is not always up to the developer — `/dflow:new-feature` and `/dflow:new-phase` always default to T1, while `/dflow:modify-existing` and `/dflow:bug-fix` let the AI judge T1/T2/T3 based on the actual change.

**Not every change goes through Dflow**: pure typo / pure formatting commits (e.g. `prettier` / `dotnet format` autoruns) don't even need a T3 inline row — `git commit` directly. Dflow is for changes that carry business meaning or structural impact, not for tooling-driven noise.

Transparent decision checkpoints and the Tier system are related but separate: checkpoints govern how the AI communicates the workflow; tiers govern how much specification, implementation planning, and verification the change needs.

## Documentation Model

In practice a feature branch usually goes through several propose → implement → complete cycles before it fully finishes — multiple milestones, multiple iterations, multiple commits. Dflow's three-layer documentation model matches that rhythm:

| Layer | File | Purpose | git analogue |
|---|---|---|---|
| **Phase Delta** | `phase-spec-{date}-{slug}.md` (or a lightweight spec) | Records what this cycle changes, why, and how it will be implemented and verified | A milestone slice inside a feature branch |
| **Feature Snapshot** | `_index.md` (one per feature directory) | Feature-level dashboard: phase list, cumulative BR Snapshot, Resume Pointer | The feature branch's own "current state" |
| **System State** | `rules.md` / `behavior.md` / `glossary.md` / `context-map.md` | Cross-feature long-term knowledge: glossary, business rules, models, conventions, tech debt | The accumulated "what the system actually is right now" on main / trunk |

`_index.md` is the key middle layer. Many spec tools only ship phase + system, but feature branches that span multiple phases are the norm, and without a middle layer three problems show up:

- You have to read every phase-spec to know "what has this feature accumulated so far"
- Picking up the work in a new conversation means rebuilding context — you can't tell where the previous session left off
- The archival granularity is either too fine or too coarse — archive each phase individually and you lose the feature-level view, or fold everything into the system layer and you lose the phase trail

Dflow solves these with `_index.md`: the Current BR Snapshot regenerates after each completed phase, the Resume Pointer carries continuation instructions, and the whole feature directory is the natural archival unit. At `/dflow:finish-feature`, Dflow reconciles the BR Snapshot into `rules.md` / `behavior.md` (promoting the feature layer into the system layer) and then `git mv`s the whole feature directory to `completed/`.

## Files Created by Init

A typical initialized project receives a `dflow/` workspace:

```text
dflow/
└── specs/
    ├── shared/
    │   ├── _overview.md
    │   ├── _conventions.md
    │   └── Git-principles-*.md
    ├── domain/
    │   ├── glossary.md
    │   └── context-map.md
    ├── architecture/
    │   └── tech-debt.md
    └── features/
        ├── active/
        └── completed/
```

Dflow also creates or provides a mergeable project instruction file for your AI coding agent. The exact file depends on the target tool and existing project setup; Dflow avoids overwriting existing project instructions.

When you select AI agent setup during init, Dflow writes
`dflow/specs/shared/AI-AGENT-GUIDE.md` as the canonical project guide, then
creates small tool-specific **pointer files** (often called "shims" — short
files whose only job is to redirect the tool to the canonical guide):

| Tool target | Generated file |
|---|---|
| Codex / Copilot coding agent | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |

If one of those files already exists, Dflow leaves it unchanged and writes a
merge snippet under `dflow/specs/shared/` instead. The project guide stays the
single source of truth, so teams can use multiple AI tools without maintaining
multiple copies of the workflow rules.

You can run `dflow configure-agents` later to add more tool shims as the team
adopts additional AI coding agents. If you need Claude / Copilot tool-native
command entries, use `dflow configure-agents --command-adapters`.

For tool-specific walk-throughs of what `init` writes and how Dflow's
workflow commands appear in a given AI tool, see the per-tool guides under
`docs/`:

- [Using Dflow with Claude Code](docs/using-with-claude-code.en.md)
- [Using Dflow with Codex CLI](docs/using-with-codex.en.md)
- [Using Dflow with GitHub Copilot](docs/using-with-github-copilot.en.md)

Init does not copy the `tutorial/` directory into your project. The
[`tutorial/`](tutorial/README.md) directory lives in this source repository
as evaluation material for understanding how Dflow works on Greenfield and
Brownfield scenarios.

## Main Flows

Dflow commands fall into four categories by role. A "what should I run?" cheat sheet appears at the end.

### Entry commands (start a workflow)

Start a Workflow run; can be invoked without any pre-existing feature. The three are independent — none is a prerequisite for the others.

| Flow | When to use it | Typical outputs |
|---|---|---|
| `/dflow:new-feature` | A completely new feature, or a new piece of business logic the system needs to support | Feature directory + `_index.md` + first phase-spec (always T1) |
| `/dflow:modify-existing` | Change to existing behavior — **when you're not sure which category the change belongs to**, AI dispatches internally | T1 → escalates to new-phase / new-feature; T2 → lightweight-spec; T3 → inline row in `_index.md` |
| `/dflow:bug-fix` | A defect where expected behavior can be stated narrowly | AI judges tier (typically T2 lightweight-spec). Orphan bugs build a minimal feature directory automatically |

### Feature-internal commands (active feature only)

Usable only inside an already-started active feature. Targets pointing at `completed/` are refused.

| Flow | When to use it | Typical outputs |
|---|---|---|
| `/dflow:new-phase` | An active feature needs another implementation slice | New `phase-spec-{date}-{slug}.md` + Implementation Tasks + implementation / verification + phase marked completed (always T1) |
| `/dflow:finish-feature` | All phases of a feature are done and need closure | `git mv` the whole feature directory to `completed/`, sync BR Snapshot into the BC layer, emit an Integration Summary (does not auto-merge) |

### Workflow control (manage an in-progress workflow run)

| Flow | When to use it |
|---|---|
| `/dflow:status` | See which workflow / Step / progress you are at |
| `/dflow:next` | Confirm to pass a Step Gate (equivalent to natural-language "OK" / "continue") |
| `/dflow:cancel` | Abort the current workflow run and return to free conversation. Artifacts created so far are kept |

### Standalone tools (callable any time, not tied to any feature or workflow)

| Flow | When to use it | Typical outputs |
|---|---|---|
| `/dflow:verify` | Need to confirm docs, code, tests, and tech-debt records are still in sync | Drift report across spec, domain docs, implementation, tests, and debt records |
| `/dflow:pr-review` | A change is ready for review | SDD/DDD compliance review checklist with risks, gaps, and follow-up items |
| `/dflow:report-dflow-feedback` | You or the AI found a Dflow issue or improvement while using it | Sanitized local feedback draft; nothing is submitted automatically |

### What should I run? (rule of thumb)

| What I want to do | Run |
|---|---|
| Completely new feature (unrelated to any existing feature) | `/dflow:new-feature` |
| Add the next planned phase to an active feature | `/dflow:new-phase` |
| Fix a specific bug | `/dflow:bug-fix` |
| **Not sure** what category — just changing existing behavior | `/dflow:modify-existing` |
| All phases of a feature are done, need closure | `/dflow:finish-feature` |
| Run a change review | `/dflow:pr-review` |
| Check doc vs code drift | `/dflow:verify` |

### Completed features are frozen history

Once `/dflow:finish-feature` moves a feature directory into `completed/`, **no direct writes are allowed** — not new phase-specs, not lightweight-specs, not even inline rows in `_index.md`. To change anything later, you build a **follow-up feature**: a new feature directory with a fresh SPEC-ID and `follow-up-of: {original SPEC-ID}` metadata pointing back to the original.

Why: "completed = frozen history" is a core Dflow guarantee. Accepting post-completion edits would erase the feature-lifecycle endpoint and make `_index.md`'s BR Snapshot unreliable. `/dflow:modify-existing` detects when the target is a completed feature and prompts the developer with three choices: A — follow-up; B — independent new feature via `/dflow:new-feature`; C (refused, re-directed to A).

## Why DDD Matters More with AI

AI agents are strong at filling in missing details. When the missing detail is something the AI can derive from rules or patterns (naming conventions, boilerplate syntax), that is useful. When the missing detail is **business meaning** — what a "valid" discount looks like, what an account should not be allowed to do — the AI can invent plausible rules that pass review by looking reasonable but are actually wrong.

Dflow treats DDD as the semantic structure behind the spec. Ubiquitous language keeps names consistent. Bounded contexts keep meanings from leaking across areas. Domain rules define what is correct, allowed, or forbidden before implementation starts.

In a code-first workflow, design often appears after the fact in classes, handlers, and tests. In an AI-assisted workflow, the spec must become the precondition for generation. The practical flow becomes:

```text
Domain meaning -> Structured spec -> AI implementation -> Code as output
```

For a longer explanation, see [Why DDD Matters More with AI](docs/why-ddd-for-ai.en.md).

## Repository Layout

| Path | Purpose |
|---|---|
| `bin/` | CLI entrypoint. |
| `lib/` | Init runtime implementation. |
| `templates/` | Files copied by the init command. |
| `test/` | Smoke tests for generated output. |
| `tutorial/` | Guided learning scenarios and expected outputs. |
| `sdd-ddd-*-skill/` | Source workflow material consumed by AI coding agents. |

## Contributing and Releases

See [CONTRIBUTING.md](CONTRIBUTING.md) for issue and pull request guidance.
Pull requests run an automated verification workflow on GitHub before review.
Maintainer-facing release rules are documented in [Release and Versioning
Policy](docs/release-versioning-policy.md), with the manual npm flow in [npm
Publish Checklist](docs/npm-publish-checklist.md).

## Status

Dflow is currently published as `dflow-sdd-ddd` on npm. The latest published
npm package is `0.2.0`, covering:

- Project initialization (`dflow init`)
- Workflow documentation (the `/dflow:*` flows)
- Multi-AI agent setup (CLAUDE.md / AGENTS.md / Copilot instructions shims)
- AI-agent-readable SDD/DDD guidance
- Public migration tooling: manual migration guide plus `dflow doctor` read-only health check
- Public onboarding: evaluator guide and per-tool walkthroughs for Claude Code and Codex CLI
- A verification-only CI workflow (it does not execute publish)

The GitHub source may include post-`0.2.0` repository changes before the
next npm release is published. See [CHANGELOG.md](CHANGELOG.md) for full
release history.

## License

MIT License. See [LICENSE](LICENSE).
