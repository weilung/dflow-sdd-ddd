# Using Dflow with Codex CLI

> [繁體中文](using-with-codex.md) | **English**

A walk-through of what Dflow looks like when your AI coding agent is
[Codex CLI](https://developers.openai.com/codex/cli). About 10 minutes to
read.

This guide focuses on the Codex CLI experience specifically. For the
tool-neutral evaluation flow, see
[`docs/evaluating-dflow.en.md`](evaluating-dflow.en.md). For the full Get Started
and feature list, see [`README.md`](../README.en.md).

## Who This Guide Is For

You are using or evaluating Dflow with Codex CLI as your AI coding agent.
This guide covers what Codex sees after `init`, how the `AGENTS.md` shim
points to the canonical Dflow guide, and the Codex-specific command and
permission patterns worth knowing.

You do not need to read this before running `init`. It is most useful after
you have run `init` once and want to understand what Codex CLI is actually
loading.

## Prerequisites

- Codex CLI installed and authenticated (see
  [developers.openai.com/codex/cli](https://developers.openai.com/codex/cli)).
- Node.js / npm available (Dflow ships through npm). Install globally with
  `npm install -g dflow-sdd-ddd`, or use `npx dflow-sdd-ddd` for the no-install path.
- A project directory you are comfortable initializing in. A branch or a
  disposable sample project is recommended for first contact; see the
  [evaluator guide playbook](evaluating-dflow.en.md#a-30-minute-evaluation-playbook).
- Codex started from the initialized project root, or with `codex --cd` set
  to that root, so Codex's `AGENTS.md` discovery includes the Dflow shim.

Running Dflow workflows does not require a separate Dflow service or API key.
The workflows are Markdown-based instructions and project files.

## What Codex CLI Sees After `init`

Running `dflow init` (or `npx dflow-sdd-ddd init` on the no-install path) and
selecting `AGENTS.md - Codex / Copilot coding agent` as a target tool creates
a thin shim at the project root:

```markdown
# AGENTS.md - Dflow Project Instructions

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md`

Keep tool-specific instruction files small. The Dflow guide above is the
single source of truth for project workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
```

Two things matter when Codex starts in this project:

1. Codex CLI reads `AGENTS.md` as project instructions. This is Codex's
   standard repository-instruction mechanism.
2. The Dflow shim does not include a Markdown import line. Unlike the
   Claude Code shim, generated `AGENTS.md` does not contain
   `@dflow/specs/shared/AI-AGENT-GUIDE.md`.

That means Codex sees the pointer immediately, but the canonical Dflow guide
is not auto-inlined by the shim. Before planning or editing, Codex should
follow the pointer and read `dflow/specs/shared/AI-AGENT-GUIDE.md`. If Codex
starts answering a Dflow request without mentioning that file, steer it
explicitly: "Before continuing, read and follow
`dflow/specs/shared/AI-AGENT-GUIDE.md`."

The canonical guide is where the real workflow rules live: project context
(track, tech stack, prose language), the Dflow workflow table,
source-of-truth file paths, and core SDD/DDD rules. The `AGENTS.md` shim
stays small so the same canonical guide can serve Codex CLI, Claude Code,
GitHub Copilot, and other tools.

If an `AGENTS.md` already existed in the project, `init` does not overwrite
it. If the existing file does not already point to
`dflow/specs/shared/AI-AGENT-GUIDE.md`, `init` writes a merge snippet under
`dflow/specs/shared/AGENTS-md-snippet.md` that you can merge manually. This
avoids destroying custom project instructions you already had.

In the `dflow configure-agents --command-adapters` case, the corresponding
snippet path is `dflow/specs/shared/AGENTS-md-command-adapters-snippet.md`.

## Using Dflow Workflow Commands in Codex CLI

Codex CLI has its own built-in slash command layer for controlling the CLI
session. Commands such as `/permissions`, `/model`, `/status`, `/diff`,
`/review`, and `/init` are Codex CLI controls, not Dflow workflows.

Dflow's canonical `/dflow:*` entries are workflow names recognized by the AI
through `AI-AGENT-GUIDE.md`, not registered Codex CLI commands. Codex handles
the leading `/` first, so the reliable form is to remove the leading slash and
send the same name as plain text:

```text
dflow:new-feature
```

Or use a plain chat instruction:

```text
Run the Dflow dflow:new-feature workflow.
```

If Codex reports an unknown slash command, re-send it without the slash:

```text
Treat dflow:new-feature as the canonical /dflow:new-feature Dflow workflow
name. Read dflow/specs/shared/AI-AGENT-GUIDE.md and start that workflow.
```

A typical conversation looks like:

```text
You: dflow:new-feature

Codex CLI: I'll read dflow/specs/shared/AI-AGENT-GUIDE.md first, then use the
new-feature workflow. Please describe the user-visible capability or business
behavior you want to add.

You: Allow expense submitters to attach a receipt image when filing an
expense.

Codex CLI: I'll start by drafting a feature spec under
dflow/specs/features/active/. Before I do, I have a few clarifying questions.
```

The workflow then walks you through spec drafting, behavior examples,
implementation planning, and finish-feature drift checks. The exact
sequence depends on which workflow you entered (`dflow:new-feature`,
`dflow:modify-existing`, `dflow:bug-fix`, etc.; the canonical guide records
these as `/dflow:*`).

Available workflow entry points:

| Codex input | Use when |
|---|---|
| `dflow:new-feature` | A new user-visible capability or business behavior is requested. |
| `dflow:modify-existing` | Existing behavior needs to change. |
| `dflow:bug-fix` | A defect can be described with expected vs actual behavior. |
| `dflow:new-phase` | An active feature needs another implementation slice. |
| `dflow:finish-feature` | Implementation is complete and needs drift closure. |
| `dflow:verify` | Specs, domain docs, implementation, and tests need consistency checks. |
| `dflow:pr-review` | A change is ready for SDD/DDD review. |
| `dflow:report-dflow-feedback` | You found a Dflow issue or improvement and want a sanitized upstream feedback draft. |

If you forget a workflow name, ask Codex to read
`dflow/specs/shared/AI-AGENT-GUIDE.md` and list the available Dflow
workflows.

### Codex Behavior With Optional Command Adapters

For Codex, `dflow configure-agents --command-adapters` strengthens text
triggers only. It does not create Codex command files and it does not add
`.agents/skills/dflow/SKILL.md`. Codex v1 has no Dflow command-file adapter
equivalent to Claude `.claude/commands` or Copilot `.github/prompts`.

When you select `AGENTS.md - Codex / Copilot coding agent` in
`--command-adapters` mode and Dflow can create a new `AGENTS.md` shim, the
shim includes a trigger list generated from the canonical command registry.
Those triggers are still plain text prompts, for example:

```text
dflow:new-feature
```

If the project already has a custom `AGENTS.md`, Dflow still preserves that
file; merge the Dflow pointer manually from the generated snippet or the
documentation guidance.

In this mode, the Codex-target merge snippet filename is
`dflow/specs/shared/AGENTS-md-command-adapters-snippet.md`.

### Version-Control Policy for Generated Artifacts (Codex)

Codex does not generate command files, so there is **no derived adapter to
gitignore**. On the Codex side, what you version-control is the `AGENTS.md`
shim and `dflow/` (the canonical guide and specs); the merge helper
`dflow/specs/shared/AGENTS-md-command-adapters-snippet.md` is part of `dflow/`
and is **version-controlled along with `dflow/`**. `--command-adapters` only
strengthens the text triggers in `AGENTS.md` for Codex; it adds no `.claude/`,
`.github/`, or `.agents/` command files, so the Claude / Copilot
"version-control the generated adapter or not" trade-off does not apply on the
Codex side. The adapter version-control policy for other tools is covered in
[README "Files Created by Init"](../README.en.md#files-created-by-init) and the
per-tool guides.

## Differences vs Other AI Tools

The canonical guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is identical
across tools. Only the root-level shim differs:

| Tool | Generated shim | Loads canonical guide via |
|---|---|---|
| Claude Code | `CLAUDE.md` | `@dflow/specs/shared/AI-AGENT-GUIDE.md` Markdown import |
| Codex / Copilot coding agent | `AGENTS.md` | Project instructions load the shim; Codex must follow the pointer and read the guide |
| GitHub Copilot | `.github/copilot-instructions.md` | Reads repository instructions directly |

You can run `dflow configure-agents` later to add another tool's shim
without re-running `init`. If you need tool-native wrappers for Claude or
Copilot, opt in with `dflow configure-agents --command-adapters`. Codex
remains text-trigger-only in that mode. Multiple tools can be active in the
same project and stay synchronized via the canonical guide.

Codex also has its own project-instruction layering. It can read global
instructions from Codex home and project instructions from `AGENTS.md` files
between the project root and the current working directory. For Dflow, the
important practical rule is simple: start Codex at the initialized project
root, and keep the Dflow pointer in the nearest relevant `AGENTS.md`.

If your team uses both Claude Code and Codex CLI on the same project, no
extra Dflow coordination is needed. Both tools use the same canonical guide;
only the shim file and loading mechanism differ.

## Common Patterns and Gotchas

**Keep `AGENTS.md` thin.** If you find yourself adding workflow rules, spec
locations, or SDD constraints to `AGENTS.md`, those belong in
`dflow/specs/shared/AI-AGENT-GUIDE.md` instead. The shim stays small so that
other tools' shims do not drift away from it.

**Codex does not inline the Dflow guide from `AGENTS.md`.** The generated
Codex shim has a normal Markdown bullet pointing to the canonical guide, not
an `@...` import. Ask Codex to read `AI-AGENT-GUIDE.md` if it appears to be
working from the shim alone.

**`/dflow:*` is not a Codex CLI built-in slash command.** Codex slash commands
control the Codex session itself. When raw slash input is intercepted or
rejected, use the no-slash text form `dflow:<id>`, for example
`dflow:status`. The model should treat it as the canonical `/dflow:<id>`
workflow by reading `AI-AGENT-GUIDE.md`.

**Codex does not generate command files.** Even with `--command-adapters`,
Codex only strengthens text-trigger guidance in `AGENTS.md` / merge
snippets. Do not expect Codex-specific files under `.claude/commands`,
`.github/prompts`, or `.agents/skills/dflow/SKILL.md`.

**Do not confuse Codex `/init` with Dflow `init`.** Codex `/init` creates a
generic `AGENTS.md` scaffold for Codex. Dflow setup is `dflow init` (or
`npx dflow-sdd-ddd init` on the no-install path), and adding later tool shims
is `dflow configure-agents`.

**Permission gates and Dflow workflow gates are separate.** Codex may ask
permission to run a command, edit outside the workspace, or access network
depending on its sandbox and approval settings. Dflow workflows have their
own approval gates, such as confirming a spec before implementation. Both
can appear in the same session; this is expected.

**The common Codex local-work preset is workspace write plus on-request
approvals.** In current Codex CLI terminology this is
`--sandbox workspace-write --ask-for-approval on-request`. In that mode,
Codex can work inside the project and asks before going beyond the sandbox,
such as writing outside the workspace or accessing network.

**Existing `AGENTS.md` files are preserved.** If Dflow cannot safely write
the root shim because the file already exists, look under
`dflow/specs/shared/` for the merge snippet and merge the Dflow pointer into
your existing project instructions manually.

**Nested `AGENTS.md` files can change what Codex sees.** Codex layers project
instructions along the path to the current working directory. If a subfolder
has its own `AGENTS.md` or `AGENTS.override.md`, make sure it does not hide
or contradict the Dflow pointer you expect Codex to follow.

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
  Per-tool documentation is new and feedback specifically about Codex CLI
  behavior is valuable.
