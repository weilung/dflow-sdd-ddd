# Dflow

[繁體中文](README.md) | **English**

Dflow is a spec-first workflow kit for AI-assisted software development. It gives your AI coding agent a concrete process for turning change requests into structured specs, domain language, implementation plans, drift checks, and reviewable code instead of jumping straight from prompt to code.

AI makes delivery faster, but it also makes ambiguous domain knowledge more dangerous. Dflow uses DDD ideas such as ubiquitous language, bounded contexts, domain rules, and model ownership as the semantic backbone of SDD, so the AI has constraints before it generates code. The goal is not ceremony for its own sake; the goal is repeatable software change with clearer meaning, fewer scattered rules, and less prompt-dependent behavior.

## Key Features

| Feature | What it gives engineering teams |
|---|---|
| **Spec-first development** | Every meaningful change starts from an explicit spec, acceptance behavior, and implementation plan before code changes begin. |
| **Greenfield and Brownfield tracks** | Start clean in a new project, or introduce Dflow into an existing codebase through progressive domain extraction and safer incremental change. |
| **Hybrid workflow control** | Command-first entry points for intentional work, auto-trigger checks as a safety net, and transparent phase gates so developers stay in control. |
| **DDD semantic backbone** | Captures domain language, context boundaries, business rules, and model decisions so AI output is constrained by project meaning. |
| **Three-layer documentation model** | Keeps short-lived phase deltas, feature snapshots, and system-level state separate, so specs stay useful instead of becoming one large document dump. |
| **Drift verification** | Checks whether specs, domain documents, implementation, tests, and technical debt records still describe the same system. |

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

This command only configures AI instruction files. It does not rerun project
initialization or touch existing specs.

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

To check whether the project still has legacy or pre-V1 artifacts (such as
a top-level `specs/` directory or a `_共用/` directory left over from older
Dflow forms), run:

```bash
dflow doctor
```

`doctor` is a read-only health check. It never modifies files; it only
reports findings and points at the migration guide.

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

If your tool does not support custom slash commands, use the same command names as plain instructions in chat. Dflow is Markdown-based workflow material plus a scaffolding CLI, so it can be used with AI coding agents that can read project instructions and repository context.

For the first adoption pass, use a branch or disposable sample project so your
team can inspect the generated `dflow/specs/` workspace before bringing the
workflow into an active codebase.

For a guided evaluation walk-through — what `init` creates, AI tool support,
track choice, and a 30-minute sample-project playbook — see [Evaluating
Dflow](docs/evaluating-dflow.md). For end-to-end scenario walk-throughs of
Greenfield and Brownfield workflows with worked spec outputs, see the
[`tutorial/`](tutorial/README.md) index.

## Project Tracks

| Track | Use it when | Main outcome |
|---|---|---|
| **Greenfield** | You are starting a new system or a new bounded area with room to shape architecture and domain model early. | Clean spec baseline, domain model ownership, feature-by-feature implementation through SDD. |
| **Brownfield** | You are adding or changing behavior in an existing codebase where business rules may already be scattered. | Progressive domain extraction, safer change planning, and migration-ready domain knowledge. |

These tracks describe adoption style, not framework branding. Dflow should be read as a workflow system for software teams that want AI assistance without giving up domain clarity.

## Workflow Model

Dflow uses a hybrid design:

| Layer | Purpose |
|---|---|
| **Command-first entry** | Developers intentionally start work with commands such as `/dflow:new-feature` or `/dflow:modify-existing`. |
| **Auto-trigger safety net** | When the conversation clearly implies a feature, phase, bug fix, verification, or review, the AI should suggest the matching Dflow flow. |
| **Transparency gates** | The AI announces flow entry, phase transitions, and important internal steps so the developer can approve direction before work expands. |

Dflow also scales ceremony by change risk:

| Tier | Typical use | Expected weight |
|---|---|---|
| **T1 Lightweight** | Small bug fixes or narrow edits. | Minimal spec, focused verification. |
| **T2 Standard** | Normal feature work. | Feature spec, behavior examples, implementation plan, finish checks. |
| **T3 Full** | Cross-cutting changes, new bounded contexts, risky architecture work. | Full domain modeling, phase planning, broader drift verification, stronger review gates. |

The transparency gates and T1/T2/T3 tiers are related but separate: transparency controls how the AI communicates the workflow; tiers control how much specification and verification the change needs.

## Documentation Model

Dflow separates documents by lifecycle:

| Layer | Shape | Purpose |
|---|---|---|
| **Phase Delta** | Short-lived phase spec. | Captures what this phase changes, why, and how it will be verified. |
| **Feature Snapshot** | Feature-level summary and behavior. | Preserves the accepted behavior and implementation decisions after phases complete. |
| **System State** | Shared domain and architecture documents. | Maintains durable knowledge such as glossary, context map, rules, models, conventions, and technical debt. |

This keeps AI collaboration grounded. The phase layer gives the agent immediate execution context, the feature layer records what was delivered, and the system layer becomes the long-term source of truth for future prompts and reviews.

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
creates small tool-specific shims that point back to it:

| Tool target | Generated file |
|---|---|
| Codex / Copilot coding agent | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Gemini CLI | `GEMINI.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |

If one of those files already exists, Dflow leaves it unchanged and writes a
merge snippet under `dflow/specs/shared/` instead. The project guide stays the
single source of truth, so teams can use multiple AI tools without maintaining
multiple copies of the workflow rules.

You can run `dflow configure-agents` later to add more tool shims as the team
adopts additional AI coding agents.

For tool-specific walk-throughs of what `init` writes and how Dflow's
workflow commands appear in a given AI tool, see the per-tool guides under
`docs/`:

- [Using Dflow with Claude Code](docs/using-with-claude-code.md)
- [Using Dflow with Codex CLI](docs/using-with-codex.md)
- [Using Dflow with Gemini CLI](docs/using-with-gemini-cli.md)
- [Using Dflow with GitHub Copilot](docs/using-with-github-copilot.md)

Init does not copy the `tutorial/` directory into your project. The
[`tutorial/`](tutorial/README.md) directory lives in this source repository
as evaluation material for understanding how Dflow works on Greenfield and
Brownfield scenarios.

## Main Flows

| Flow | When to use it | Typical outputs |
|---|---|---|
| `/dflow:new-feature` | A new user-visible capability or business behavior. | Feature spec, behavior examples, phase plan, domain updates. |
| `/dflow:modify-existing` | A change to behavior already present in the system. | Impact analysis, updated specs, adjusted domain rules, migration notes when needed. |
| `/dflow:bug-fix` | A defect where expected behavior can be stated narrowly. | Lightweight spec, reproduction, fix plan, regression check. |
| `/dflow:new-phase` | A feature needs another implementation slice. | Phase delta, acceptance checks, focused implementation plan. |
| `/dflow:finish-feature` | The implementation is done and needs closure. | Drift verification, feature snapshot, technical debt update, review checklist. |
| `/dflow:verify` | You need confidence that docs and code still match. | Drift report across spec, domain docs, implementation, tests, and debt records. |
| `/dflow:pr-review` | A change is ready for review. | SDD/DDD compliance review with risks, gaps, and follow-up items. |
| `/dflow:report-dflow-feedback` | You or the AI found a Dflow issue or improvement while using the workflow. | Sanitized local feedback draft for a GitHub issue or future PR; nothing is submitted automatically. |

## Why DDD Matters More with AI

AI agents are strong at filling gaps. That is useful when the missing detail is mechanical, but risky when the missing detail is business meaning. If a prompt does not define the language, boundaries, and allowed behavior, the model may invent plausible rules that are hard to notice in review.

Dflow treats DDD as the semantic structure behind the spec. Ubiquitous language keeps names consistent. Bounded contexts keep meanings from leaking across areas. Domain rules define what is correct, allowed, or forbidden before implementation starts.

In a code-first workflow, design often appears after the fact in classes, handlers, and tests. In an AI-assisted workflow, the spec must become the precondition for generation. The practical flow becomes:

```text
Domain meaning -> Structured spec -> AI implementation -> Code as output
```

For a longer explanation, see [Why DDD Matters More with AI](docs/why-ddd-for-ai.md).

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
npm package is `0.2.0`, covering project initialization, workflow
documentation, multi-AI agent setup, AI-agent-readable SDD/DDD guidance,
public migration tooling (manual migration guide and `dflow doctor`
read-only health check), public onboarding (evaluator guide and per-tool
walkthroughs for Claude Code and Codex CLI), and a verification-only CI
workflow.

The GitHub source may include post-`0.2.0` repository changes before the
next npm release is published. See [CHANGELOG.md](CHANGELOG.md) for full
release history.

## License

MIT License. See [LICENSE](LICENSE).
