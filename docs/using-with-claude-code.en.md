# Using Dflow with Claude Code

> [繁體中文](using-with-claude-code.md) | **English**

A walk-through of what Dflow looks like when your AI coding agent is
[Claude Code](https://claude.com/claude-code). About 10 minutes to read.

This guide focuses on the Claude Code experience specifically. For the
tool-neutral evaluation flow, see
[`docs/evaluating-dflow.en.md`](evaluating-dflow.en.md). For the full Get Started
and feature list, see [`README.md`](../README.en.md).

## Who This Guide Is For

You are using or evaluating Dflow with Claude Code as your AI coding agent.
This guide covers what Claude Code sees after `init`, how Dflow's slash
commands are recognized, and the small Claude-Code-specific patterns worth
knowing.

You do not need to read this before running `init`. It is most useful after
you have run `init` once and want to understand what Claude Code is
actually loading.

## Prerequisites

- Claude Code CLI installed (see [claude.ai/code](https://claude.com/claude-code)).
- Node.js / npm available (Dflow ships through npm). Install globally with
  `npm install -g dflow-sdd-ddd`, or use `npx dflow-sdd-ddd` for the no-install path.
- A project directory you are comfortable initializing in. A branch or a
  disposable sample project is recommended for first contact; see the
  [evaluator guide playbook](evaluating-dflow.en.md#a-30-minute-evaluation-playbook).

You do not need a paid Claude Code plan to read this document. Running
`/dflow:*` workflows requires Claude Code itself; the workflows are
text-based and do not require additional API keys beyond Claude Code's own
auth.

## What Claude Code Sees After `init`

Running `dflow init` (or `npx dflow-sdd-ddd init` on the no-install path) and
selecting Claude Code as a target tool creates a thin shim at the project root:

```markdown
# CLAUDE.md - Dflow Project Instructions

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md`

Keep tool-specific instruction files small. The Dflow guide above is the
single source of truth for project workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.

If your tool supports Markdown imports, the canonical guide is imported
below:

@dflow/specs/shared/AI-AGENT-GUIDE.md
```

Two things happen when Claude Code starts in this project:

1. Claude Code automatically loads `CLAUDE.md` from the project root into
   its context. This is Claude Code's standard project instructions
   mechanism.
2. The trailing `@dflow/specs/shared/AI-AGENT-GUIDE.md` line uses Claude
   Code's Markdown import syntax to inline the canonical Dflow guide. So
   Claude Code effectively reads both files as one set of instructions.

The canonical guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is where the
real workflow rules live: project context (track, tech stack, prose
language), the `/dflow:*` workflow table, source-of-truth file paths, and
core SDD/DDD rules. The `CLAUDE.md` shim stays small precisely so the
canonical guide can evolve without Claude-Code-specific edits.

If a `CLAUDE.md` already existed in the project, `init` does not overwrite
it. Instead it writes a merge snippet under `dflow/specs/shared/` that you
can paste into your existing `CLAUDE.md` manually. This avoids destroying
custom project instructions you already had.

## Using Dflow Slash Commands in Claude Code

By default, Dflow's canonical `/dflow:*` slash commands are workflow names
recognized by the AI through the workflow table in `AI-AGENT-GUIDE.md`, not
Claude Code's built-in slash command system. You type them as plain chat:

```text
/dflow:new-feature
```

Claude Code treats this as input. Because it has the workflow table loaded
via `CLAUDE.md` import, it recognizes the prefix and enters the matching
workflow. A typical conversation looks like:

```text
You: /dflow:new-feature

Claude Code: Entering new-feature workflow. Please describe the user-facing
capability or business behavior you want to add.

You: Allow expense submitters to attach a receipt image when filing an
expense.

Claude Code: I'll start by drafting a feature spec under
dflow/specs/features/active/. Before I do, I need a short answer on:
[clarifying questions about scope, owner, priority]
```

The workflow then walks you through spec drafting, behavior examples,
implementation planning, and finish-feature drift checks. The exact
sequence depends on which workflow you entered (`/dflow:new-feature`,
`/dflow:modify-existing`, `/dflow:bug-fix`, etc.). All workflow definitions
live under the Dflow skill source; Claude Code follows them by reading the
skill files when needed.

Available workflow entry points:

| Command | Use when |
|---|---|
| `/dflow:new-feature` | A new user-visible capability or business behavior is requested. |
| `/dflow:modify-existing` | Existing behavior needs to change. |
| `/dflow:bug-fix` | A defect can be described with expected vs actual behavior. |
| `/dflow:new-phase` | An active feature needs another implementation slice. |
| `/dflow:finish-feature` | Implementation is complete and needs drift closure. |
| `/dflow:verify` | Specs, domain docs, implementation, and tests need consistency checks. |
| `/dflow:pr-review` | A change is ready for SDD/DDD review. |
| `/dflow:report-dflow-feedback` | You found a Dflow issue or improvement and want a sanitized upstream feedback draft. |

If you forget a command name, ask Claude Code "what dflow workflows are
available?" — the answer comes from the workflow table it already has
loaded.

### Optional Command Adapters

If you want Claude Code to expose tool-native command entries, run this in an
initialized project:

```bash
dflow configure-agents --command-adapters
```

After you select Claude Code, Dflow projects thin wrappers from the command
registry inside the canonical guide:

- `.claude/commands/dflow/dflow-<id>.md`

These wrappers use adapter-native names, for example `/dflow-new-feature`.
Their body only points to the canonical `/dflow:new-feature` workflow and
`dflow/specs/shared/AI-AGENT-GUIDE.md`; it does not copy workflow steps.
Dflow v1 does not promise that Claude Code's menu will expose the exact
colon form `/dflow:new-feature`. The canonical name remains in the guide and
wrapper body.

## Differences vs Other AI Tools

The canonical guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is identical
across tools. Only the root-level shim differs:

| Tool | Generated shim | Loads canonical guide via |
|---|---|---|
| Claude Code | `CLAUDE.md` | `@dflow/specs/shared/AI-AGENT-GUIDE.md` Markdown import |
| Codex / Copilot coding agent | `AGENTS.md` | Reads file content directly when starting |
| GitHub Copilot | `.github/copilot-instructions.md` | Reads file content directly |

You can run `dflow configure-agents` later to add another tool's shim without
re-running `init`. Multiple tools can be active in the same project and stay
synchronized via the canonical guide.

If your team uses both Claude Code and Codex CLI on the same project (a
common setup), no extra coordination is needed. Both tools read the same
canonical guide; only the shim file differs.

## Common Patterns and Gotchas

**Keep `CLAUDE.md` thin.** If you find yourself adding workflow rules,
spec locations, or SDD constraints to `CLAUDE.md`, those belong in
`dflow/specs/shared/AI-AGENT-GUIDE.md` instead. The shim stays small so
that other tools' shims don't drift away from it.

**Default `/dflow:*` is not a Claude Code Skill installation.** `init` does
not install anything into Claude Code's skill system. The slash commands are
plain text patterns the AI recognizes from the workflow table. If you later
run `dflow configure-agents --command-adapters`, the added files are thin
command wrappers, not a second workflow definition.

**Choose either legacy Claude skills or the installed adapter.** If the
project still has legacy `.claude/skills/sdd-ddd-*` skills, choose either
those skills or `--command-adapters`. If they must temporarily coexist, use
Claude Code skill override / `disable-model-invocation` settings to prevent
the legacy skill from auto-triggering. Otherwise the same `/dflow:*` intent
may trigger both the legacy skill and the installed adapter. Installed
adapter wrappers must stay thin pointers and should not copy workflow
semantics.

**Permission gates and Dflow workflow gates are separate.** Claude Code may
ask permission to run a tool (e.g., write a file). Dflow's workflows have
their own approval gates (e.g., "I drafted the spec — do you want me to
proceed to implementation?"). Both can fire on the same action; this is
expected and not a sign of misconfiguration.

**The `@` import is not recursive.** `CLAUDE.md` imports
`AI-AGENT-GUIDE.md`, but if `AI-AGENT-GUIDE.md` references other files
(e.g., feature specs), those are not auto-loaded — Claude Code reads them
on demand when entering the relevant workflow. This keeps context usage
proportional to active work.

**A pre-existing `CLAUDE.md` is preserved.** `init` will not overwrite your
existing project instructions. Look under `dflow/specs/shared/` for the
merge snippet `init` wrote and paste the relevant sections into your
existing `CLAUDE.md` manually.

**Cross-machine projects work.** `dflow/specs/` is plain Markdown checked
into your repo. Anyone cloning the repo and using Claude Code in it will
see the same Dflow setup automatically through the committed `CLAUDE.md`
shim and the canonical guide.

## Where to Go Next

If you have not run `init` yet:

- Follow the [evaluator guide playbook](evaluating-dflow.en.md#a-30-minute-evaluation-playbook)
  to try it on a disposable sample project.

If you have run `init` and want to see end-to-end workflow examples:

- Read [`tutorial/01-greenfield/`](../tutorial/01-greenfield/walkthrough-00-setup.md) or
  [`tutorial/02-brownfield/`](../tutorial/02-brownfield/walkthrough-00-setup.md). The
  tutorial walk-throughs show conversation flows and the resulting
  `dflow/specs/` outputs.

If you want to understand the design rationale:

- Read [`docs/why-ddd-for-ai.en.md`](why-ddd-for-ai.en.md).

If something does not work as described:

- File a docs feedback issue (see [`CONTRIBUTING.md`](../CONTRIBUTING.md)).
  Per-tool documentation is new and feedback specifically about Claude Code
  behavior is valuable.
