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

The canonical guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is the
**command registry and router**: project context (track, tech stack, prose
language), the `/dflow:*` workflow table, source-of-truth file paths, and
core SDD/DDD rules. The executable workflow steps (Step 1→N, step gates,
completion checklists) live in the **vendored workflow bundle** that `init`
projects into `dflow/specs/shared/dflow-workflows/`. Both are plain Markdown
checked into your repo, so they travel with the project when cloned. The
`CLAUDE.md` shim stays small precisely so the canonical guide can evolve
without Claude-Code-specific edits.

If a `CLAUDE.md` already existed in the project, `init` does not overwrite
custom content. A Dflow-generated shim is refreshed in place; another file
that already points to `dflow/specs/shared/AI-AGENT-GUIDE.md` is skipped
without adding a second pointer. Otherwise Dflow shows the change in the
confirmation preview and appends a marked
`<!-- dflow-generated: agent-shim START/END -->` block at the end of the file;
re-running refreshes that same block in place without duplicating it. Dflow
writes a fallback merge snippet under `dflow/specs/shared/` only when the file
contains conflicting or malformed Dflow markers.

## Using Dflow Slash Commands in Claude Code

Dflow's canonical `/dflow:*` names are the shared workflow vocabulary across
tools. Each tool has different `/` parser behavior, and Claude Code accepts
`/dflow:<id>` only when that slash command has been registered. Install the
command adapters below, then invoke the Claude Code registered name:

```text
/dflow:new-feature
```

After adapters are installed, Claude Code registers
`.claude/commands/dflow/<id>.md` as `/dflow:<id>`. The wrapper points back to
the canonical workflow in `AI-AGENT-GUIDE.md`. A typical conversation looks
like:

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
`/dflow:modify-existing`, `/dflow:bug-fix`, etc.). The executable step
definitions (Step 1→N, step gates, completion checklists) are in the
vendored workflow bundle at `dflow/specs/shared/dflow-workflows/`; `init`
projects this bundle into every initialized project so the workflow steps
are self-contained and reachable without any external source dependency.

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

If command adapters are not installed yet, or if Claude Code treats a
slash-prefixed input as an unknown command, resend it as plain text, for
example `dflow:new-feature` or `Run the Dflow /dflow:new-feature workflow.`,
so the model can follow the canonical guide.

### Optional Command Adapters

If you want Claude Code to expose tool-native command entries, run this in an
initialized project:

```bash
dflow configure-agents --command-adapters
```

After you select Claude Code, Dflow projects thin wrappers from the command
registry inside the canonical guide:

- `.claude/commands/dflow/<id>.md`

These wrappers use Claude Code's directory namespace names, for example
`/dflow:new-feature`. Their body only points to the canonical
`/dflow:new-feature` workflow and `dflow/specs/shared/AI-AGENT-GUIDE.md`; it
does not copy workflow steps. Projects upgraded from Dflow 0.5.0 may still
have old `.claude/commands/dflow/dflow-*.md` files, which make Claude Code show
both the old `/dflow:dflow-<id>` names and the new `/dflow:<id>` names. When you
re-run `dflow configure-agents --command-adapters`, Dflow **automatically
detects and removes** these 0.5.0-generated stale wrappers: the files to remove
are listed in the confirmation preview (marked `remove`) and deleted only after
you confirm. Dflow removes only files whose content **exactly matches** the
0.5.0 generated output; if you have edited the file, or it is one you placed in
the same namespace yourself, Dflow leaves it in place and prints a warning so
you can review it manually.

### Version Control and Upgrades for Generated Adapters

`.claude/commands/dflow/<id>.md` is a **generated artifact** projected from the
canonical guide. Dflow's **recommended default** is to not version-control it
and regenerate it after clone with `dflow configure-agents --command-adapters`;
teams that want a native command menu immediately after clone may instead
**version-control** it. Use one consistent policy across all tools in a project
(see the policy overview and ignore-vs-track trade-off in
[README "Files Created by Init"](../README.en.md#files-created-by-init)).

When using the gitignore default, add this to the project `.gitignore` (**only
if you reserve the `.claude/commands/dflow/` namespace for Dflow**):

```gitignore
.claude/commands/dflow/
```

Note: this rule also ignores any custom commands you place in the same
directory. If the directory is **already version-controlled**, adding the
ignore rule does not remove it from version control automatically; first run:

```bash
git rm --cached -r .claude/commands/dflow/
```

(`--cached` removes it from version control while keeping the working-tree
files.)

After upgrading Dflow, re-running `dflow configure-agents --command-adapters`
re-projects adapters from the **new registry**, but an existing
`dflow/specs/shared/AI-AGENT-GUIDE.md` is **not** overwritten — "re-projecting
adapters" is not the same as "migrating the canonical guide." Re-project with
the **same dflow CLI version** to avoid a registry / guide version mismatch.

### Optional Skill Adapter (Restore Natural-Language Auto-Trigger)

Command adapters give you a `/` menu entry, but they **do not auto-trigger** —
you have to invoke the command yourself. If you want to restore the "say 'I want
to add a feature' and it shows up automatically" experience, run this in an
initialized project:

```bash
dflow configure-agents --skills
```

After you select Claude Code, Dflow generates a thin skill:

- `.claude/skills/dflow/SKILL.md`

This skill does not copy workflow steps; its body points to the canonical
`dflow/specs/shared/AI-AGENT-GUIDE.md` (command registry and routing rules) and
`dflow/specs/shared/dflow-workflows/` (vendored bundle with executable step
definitions).
Its behavior:

- **Auto-triggers on** feature / bug-fix workflows, product/domain behavior
  changes, new requirements, and spec-impacting architecture / domain-model
  decisions.
- **Does not trigger on** pure refactors, infrastructure chores, formatting, or
  general code questions.
- When engaged by natural language it **does not enter a workflow directly**: it
  judges the intent, **suggests the matching `/dflow:` command, and waits for
  your confirmation** before proceeding.

**The four combinations** (command adapters and the skill are each independently
opt-in):

| Installed | Entry behavior |
|---|---|
| Neither | Root shim only (CLAUDE.md points to the guide); no `/` menu, no auto-trigger |
| Command adapters only | `/dflow:*` appears in the `/` menu; no natural-language auto-trigger |
| Skill only | Natural-language auto-trigger (suggest-and-wait); no `/` menu |
| Both | `/` menu + natural-language safety net **may coexist** |

**Both may coexist with no mutex needed** (validated in a real Claude Code
environment): the skill name `dflow` does not collide with the command adapters'
`dflow:<id>` names, explicit commands load their own adapter precisely with no
double-fire; the skill acts as a natural-language safety net while command
adapters provide the `/` menu.

After installing, verify with `/skills` or by asking "What skills are
available?". Note: adding a new top-level skills directory may require
**restarting Claude Code** before it is watched. Also, a personal / enterprise
skill at `~/.claude/skills/dflow` can **override** the project skill (per the
Claude docs); use `/skills` to check which one is active.

**Version-control policy**: `.claude/skills/dflow/SKILL.md` is a **generated
artifact**, just like the command adapters, and follows the same default — do
not version-control it and regenerate it after clone with
`dflow configure-agents --skills` (`.claude/skills/dflow/` is already in the
recommended gitignore set); clone-ready teams may version-control it instead.
Re-running `--skills` is idempotent: an existing marker-stamped skill is
rewritten cleanly. If `.claude/skills/dflow/SKILL.md` is **not** Dflow-generated
(no `<!-- dflow-generated: skill-adapter -->` marker), Dflow leaves it unchanged
and prints a warning asking you to remove or rename it.

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

**`/dflow:*` is not a Claude Code Skill installation.** `init` does not
install anything into Claude Code's skill system. Without command adapters,
Dflow names are text triggers the AI recognizes from the workflow table. After
you run `dflow configure-agents --command-adapters`, the added files are thin
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
custom project instructions. Dflow-generated shims are refreshed in place; it
skips other files that already point to `AI-AGENT-GUIDE.md`. Otherwise it shows
the marked Dflow block in the confirmation preview, then refreshes that same
block in place on later runs.
If you delete the block, the next `init` / `configure-agents` run appends it
again. Look under `dflow/specs/shared/` for a fallback merge snippet only when
there is a marker conflict to resolve manually.

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
