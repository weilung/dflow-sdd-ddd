# Using Dflow with GitHub Copilot

> [繁體中文](using-with-github-copilot.md) | **English**

A walk-through of what Dflow looks like when your AI coding agent is GitHub Copilot. GitHub Copilot has two surfaces — **VS Code Copilot Chat** (the in-IDE chat panel + inline completions) and **GitHub Copilot CLI** (the terminal) — and they trigger Dflow and invoke commands differently, so this guide covers them separately. About 10 minutes to read.

This guide focuses on the Copilot experience specifically. For the tool-neutral evaluation flow, see [`docs/evaluating-dflow.en.md`](evaluating-dflow.en.md). For the full Get Started and feature list, see [`README.md`](../README.en.md).

## Who This Guide Is For

You are using or evaluating Dflow with GitHub Copilot, in either VS Code Copilot Chat or the GitHub Copilot CLI. This guide covers what Copilot sees after `init`, the repository shim location, how to invoke Dflow workflows on each surface, and Copilot-specific UX and permission patterns worth knowing.

## Prerequisites

- GitHub Copilot enabled in your IDE (VS Code, JetBrains, or GitHub.dev).
- A project initialized with `dflow init` (or `npx dflow-sdd-ddd init` on the
  no-install path) so the repository shim exists.
- Basic familiarity with the Dflow canonical guide: `dflow/specs/shared/AI-AGENT-GUIDE.md`.

## What GitHub Copilot Sees After `init`

`init` writes a small tool-specific shim for Copilot at:

- `.github/copilot-instructions.md` (note: this is inside `.github/`, not the project root)

Example generated shim:

```markdown
# GitHub Copilot Repository Instructions

This project uses Dflow for spec-first AI-assisted development.

For spec-impacting work — a new feature, a change to product, user-facing, or
domain behavior, a new requirement, or a bug-fix workflow — read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md` — command registry, routing rules, and project context.
- `dflow/specs/shared/dflow-workflows/` — vendored workflow bundle with executable step definitions.

For routine work (refactors, renames, chores, formatting, dependency bumps, or
general code questions), proceed normally; you need not read the guide first.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
```

Key points:

- The Copilot shim is located at `.github/copilot-instructions.md` (see `lib/init.js` mapping).
- The Copilot shim is a thin pointer to the canonical guide by path. Readers must open `dflow/specs/shared/AI-AGENT-GUIDE.md` explicitly.

## Using Dflow Workflow Commands with GitHub Copilot

GitHub Copilot has two surfaces, and Dflow triggering and command behavior
differ between them — sort out which one you are on first:

- **VS Code Copilot Chat** (the in-IDE chat panel): natural language **does
  auto-trigger** Dflow's skill; if you opt in to prompt adapters, the
  tool-native command `/dflow-<id>` (hyphen) is also available.
- **GitHub Copilot CLI** (the terminal): there is **no** natural-language
  auto-trigger; you first type `/dflow` to **manually engage** the skill and let
  it guide you; the per-id `/dflow-<id>` command is **not available** in the CLI.

Both surfaces share the same set of workflow entry points (same vocabulary;
only how you invoke them differs):

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

> **Syntax note**: in the table, `/dflow:<id>` (**colon**) is Dflow's canonical
> vocabulary and the **actual command** syntax for Claude / Codex. Copilot's
> prompt-adapter command uses `/dflow-<id>` (**hyphen**) instead, and only in VS
> Code; do not type the colon form literally as a command in Copilot (the
> Copilot CLI parses `/dflow:new-feature` down to `/dflow`). The two
> sub-sections below cover how to invoke on each surface.

### Surface A: VS Code Copilot Chat

- **Auto-trigger**: yes. Describe what you want in plain natural language in chat
  (e.g., "I want to add CSV export for users") and Dflow's skill engages on its
  own, picks the matching workflow, and starts in **suggest-and-wait** mode (it
  proposes a command and waits for your confirmation) rather than running the
  whole workflow unprompted.
- **Command**: `/dflow-<id>` (**hyphen**) works, but first run
  `dflow configure-agents --command-adapters` in the project to project
  `.github/prompts/dflow-<id>.prompt.md` (see the next section); then pick
  `/dflow-new-feature` from the prompt menu.
- **Plain text also works**: you can also describe the workflow in plain chat
  text (e.g., `Run the Dflow /dflow:new-feature workflow.`) — here
  `/dflow:new-feature` is just a **text reference**, not something parsed as a
  command.

### Surface B: GitHub Copilot CLI

- **Auto-trigger**: **none**. Sending plain natural language does **not** engage
  Dflow's skill.
- **How to engage**: type `/dflow` (no id suffix) to **manually engage** the
  skill; once engaged it lists the available workflows / asks what you want to
  do, and you then continue with a **natural-language description** (e.g., "I
  want to add CSV export") or by replying to the options it lists. It also runs
  in suggest-and-wait mode.
- **Command**: the per-id `/dflow-<id>` is **not available** in the CLI —
  `.github/prompts/dflow-<id>.prompt.md` is VS Code Chat-specific and the **CLI
  does not read it**, so `/dflow-new-feature` returns Unknown; the colon form
  `/dflow:new-feature` is parsed down to `/dflow`. The CLI has no per-id command
  entry; use the "`/dflow` to engage → describe in conversation" path instead.
- **What about the command the skill suggests**: once engaged, the skill may
  suggest a `/dflow:<id>` (that is the canonical form written for Claude /
  Codex). In Copilot you do **not** need to type that command string literally —
  in the CLI the skill is already engaged, so just describe the workflow you want
  in conversation or confirm; in VS Code, use the `/dflow-<id>` (hyphen)
  prompt-menu entry instead.

### Optional Prompt Adapters

If you want tool-native **command** entries in a VS Code Copilot environment
that supports prompt files, run this in an initialized project:

```bash
dflow configure-agents --command-adapters
```

After you select GitHub Copilot, Dflow projects thin prompt wrappers from the
command registry inside the canonical guide:

- `.github/prompts/dflow-<id>.prompt.md`

These prompts work **only in the VS Code Copilot Chat prompt menu** (as
`/dflow-<id>`, for example `/dflow-new-feature`); the **Copilot CLI does not
read** `.github/prompts/`, so this command path is unavailable in the CLI (see
"Surface B" above). Their body only points to the canonical `/dflow:new-feature`
workflow and `dflow/specs/shared/AI-AGENT-GUIDE.md`; it does not copy workflow
steps. Note the command syntax uses the **hyphen** `/dflow-<id>`, not the
canonical **colon** `/dflow:<id>` — the colon form is Claude / Codex's command
syntax and in Copilot can only be a text reference, never typed as a command.

### Skill Triggering on Copilot (Installed by Default)

Dflow projects the same tool-neutral thin skill for
**Claude Code, Codex, and GitHub Copilot**, each at its own project-level skill
path; Copilot's is `.github/skills/dflow/SKILL.md`. The skill now installs **by
default**: `dflow init` installs it when Copilot was selected (interactive runs
ask one default-yes question; non-interactive runs install without reading
extra stdin), `dflow configure-agents` asks the same question when Copilot is
newly selected without a skill, and `dflow configure-agents --skills` backfills
or force-regenerates it. Testing (2026-06-05) confirmed
Copilot discovers and runs the skill from its own native `.github/skills/` path
(it still works with the cross-read `.claude`/`.agents` paths removed); the
trigger differs by surface — **VS Code Chat auto-triggers on natural language**,
while the **Copilot CLI needs a `/dflow` to manually engage** it (details in
Surfaces A / B above).

> Note: Copilot also cross-reads `.claude/skills` and `.agents/skills`; if you
> select Copilot alongside Claude / Codex in the same project, the same `dflow`
> skill may surface from more than one path. The copies Dflow *generates* are
> byte-identical (same `name`), so they behave the same; but a pre-existing
> non-Dflow `dflow` skill at one of those paths is left untouched and could
> differ — remove or rename it to avoid a divergent same-name duplicate.

### Version Control and Upgrades for Generated Adapters

`.github/prompts/dflow-<id>.prompt.md` is a **generated artifact** projected
from the canonical guide. Dflow's **recommended default** is to not
version-control it and regenerate it after clone with `dflow configure-agents
--command-adapters`; teams that want a native prompt menu immediately after
clone may instead **version-control** it. Use one consistent policy across all
tools in a project (policy overview in
[README "Files Created by Init"](../README.en.md#files-created-by-init)).

When using the gitignore default, add this to the project `.gitignore` (**mind
the glob side effect**):

```gitignore
.github/prompts/dflow-*.prompt.md
```

This glob also ignores any of your own prompt files named with a `dflow-`
prefix. If you have custom prompts with the same prefix, use a more specific
rule or rename your custom files. If these prompts are **already
version-controlled**, adding the ignore rule does not remove them
automatically; first run:

```bash
git rm --cached .github/prompts/dflow-*.prompt.md
```

(`--cached` removes them from version control while keeping the working-tree
files.)

After upgrading Dflow, re-running `dflow configure-agents --command-adapters`
re-projects prompt adapters from the **new registry**, but an existing
`dflow/specs/shared/AI-AGENT-GUIDE.md` is **not** overwritten — "re-projecting
adapters" is not the same as "migrating the canonical guide." Re-project with
the **same dflow CLI version**.

### Sample Conversation Flow

A typical Copilot Chat workflow looks like this:

```text
You: I'd like to use the /dflow:new-feature workflow. We need to add the
     ability for users to export their data as CSV.

Copilot: I'll help you structure this as a new feature. Let me start by
         reviewing the AI-AGENT-GUIDE to understand the spec format.

         Before drafting the feature spec, I need to understand the scope:

         1. Should the CSV include all user data fields or a selected subset?
         2. Which user roles should be able to trigger the export?
         3. Are there any compliance or performance constraints I should know?

You: All fields, only admin users, and exports should complete within 30 seconds
     for datasets up to 1 million rows.

Copilot: Got it. I'll create the feature spec at dflow/specs/features/active/
         with these constraints. Let me also outline the implementation phases...
```

### Pre-Existing Repository Instructions

If a `.github/copilot-instructions.md` file already exists in your project,
`init` does not overwrite custom content. A Dflow-generated shim is refreshed
in place; another file that already points to
`dflow/specs/shared/AI-AGENT-GUIDE.md` is skipped. If the file does not yet
point to the guide, Dflow shows the change in the confirmation preview and
appends a marked `<!-- dflow-generated: agent-shim START/END -->` block at the
end of the file; re-running refreshes that same block in place without
duplicating it. This avoids destroying custom Copilot instructions you already
had. If you delete the block, the next `init` / `configure-agents` run appends
it again.

Look for the fallback merge snippet
`dflow/specs/shared/copilot-instructions-snippet.md` only when Dflow reports
conflicting or malformed markers, then resolve it manually in your existing
`.github/copilot-instructions.md`.

### Can You Type `/dflow:<id>` (the Colon Form) Directly?

The canonical `/dflow:<id>` (colon) is Claude / Codex's command syntax. In
Copilot, **do not type it literally as a command on either surface**:

- **VS Code Chat**: as a text reference it is fine (Copilot understands which
  workflow you mean); for a command entry, use the prompt-adapter `/dflow-<id>`
  (hyphen).
- **Copilot CLI**: typing `/dflow:new-feature` is parsed down to `/dflow` (it
  only engages the skill, without the id). Type `/dflow` to engage, then describe
  the workflow you want.

On any surface, whenever a slash form is not recognized, re-send the request as
plain prose:

```text
You: Please help me start a new Dflow feature workflow. Read
     dflow/specs/shared/AI-AGENT-GUIDE.md first.
```

## Differences vs Other AI Tools

The canonical guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is the same across tools. Only the root-level shim differs:

| Tool | Generated shim | Loads canonical guide via |
|---|---|---|
| GitHub Copilot | `.github/copilot-instructions.md` | Reads repository instructions directly |
| Claude Code | `CLAUDE.md` | Reads file content directly when starting |
| Codex / Copilot coding agent | `AGENTS.md` | Reads file content directly when starting |

- Shim path: Copilot uses `.github/copilot-instructions.md` (not `AGENTS.md` or `CLAUDE.md`).
- Loading: the Copilot shim is a thin pointer that does not inline the guide (same as the other tools now); the canonical guide is loaded on demand.
- Tool model: Copilot has two surfaces — VS Code Chat (chat panel + inline completions) and the Copilot CLI (terminal); Codex/Claude Code are CLI-based agents. The two Copilot surfaces interact with Dflow differently (see Surfaces A / B above).
- Workflow invocation: canonical `/dflow:*` is shared vocabulary, but each tool's `/` parser behaves differently. Claude / Codex take `/dflow:<id>` (colon) directly as a command; Copilot does **not** — in VS Code the command entry is the prompt-adapter `/dflow-<id>` (hyphen, requires `--command-adapters`), while the Copilot CLI has no per-id command and instead uses `/dflow` to engage the skill (see Surfaces A / B above).
- Permission model: Copilot relies on the IDE's permission and extension sandbox. It may prompt for or be governed by editor-level approvals; CLI tools often have explicit sandbox flags and separate permission gates.

## Common Patterns and Gotchas

- Keep `.github/copilot-instructions.md` thin. The canonical Dflow guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is the source of truth.
- If Copilot appears to be working only from the shim text, ask it to open or read `dflow/specs/shared/AI-AGENT-GUIDE.md` before continuing.
- Copilot's inline completions may suggest code without following Dflow workflows; explicitly request the workflow when you need spec-driven output.
- Copilot chat context may not automatically include repository instruction files from `.github/` in all IDE versions; behavior varies by Copilot / IDE version (see footer note).
- Sort out the surface first: VS Code Chat auto-triggers on natural language and uses `/dflow-<id>` for commands; the Copilot CLI has no auto-trigger, engage with `/dflow` first, and has no per-id command (see Surfaces A / B above).
- When a slash form is not recognized (occasional in VS Code Chat, or `/dflow-<id>` returning Unknown in the Copilot CLI), describe the workflow in plain prose, or in the CLI type `/dflow` to engage the skill first.
- Prompt adapters are thin wrappers generated from the canonical command registry; do not hand-write or copy Dflow workflow steps under `.github/prompts/`.

## Where to Go Next

- If you have not run `init`: run `dflow init` (after `npm install -g dflow-sdd-ddd`) or `npx dflow-sdd-ddd init` and choose the Copilot target to create `.github/copilot-instructions.md`.
- Read [`dflow/specs/shared/AI-AGENT-GUIDE.md`](../sdd-ddd-greenfield-skill/scaffolding/AI-AGENT-GUIDE.md) (or the brownfield equivalent) before starting a workflow.
- See [`tutorial/01-greenfield/`](../tutorial/01-greenfield/walkthrough-00-setup.md) for conversation examples that demonstrate Copilot chat flows.
- Read [`docs/why-ddd-for-ai.en.md`](why-ddd-for-ai.en.md) for the design rationale behind spec-first plus DDD.

---

Note on behavior: the surface differences described here (VS Code Chat auto-triggers on natural language, the Copilot CLI engages manually via `/dflow`, prompt adapters are VS Code-only) reflect 2026-06-05 testing; automatic inclusion of `.github/` instruction files and each surface's `/` command parsing may still vary by Copilot / IDE version. Confirm with a maintainer before relying on exact semantics.
