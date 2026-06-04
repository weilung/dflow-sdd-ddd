# Using Dflow with GitHub Copilot

> [繁體中文](using-with-github-copilot.md) | **English**

A walk-through of what Dflow looks like when your AI coding agent is GitHub Copilot (IDE chat + inline completions). About 10 minutes to read.

This guide focuses on the Copilot experience specifically. For the tool-neutral evaluation flow, see [`docs/evaluating-dflow.en.md`](evaluating-dflow.en.md). For the full Get Started and feature list, see [`README.md`](../README.en.md).

## Who This Guide Is For

You are using or evaluating Dflow with GitHub Copilot in an IDE (e.g., VS Code). This guide covers what Copilot sees after `init`, the repository shim location, how to invoke Dflow workflows from the IDE, and Copilot-specific UX and permission patterns worth knowing.

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

Before planning or editing code, read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md`
```

Key points:

- The Copilot shim is located at `.github/copilot-instructions.md` (see `lib/init.js` mapping).
- The Copilot shim does NOT include a Markdown `@` import. It points to the canonical guide by path only. Readers must open `dflow/specs/shared/AI-AGENT-GUIDE.md` explicitly.

## Using Dflow Workflow Commands with GitHub Copilot

By default, Copilot is an IDE-first assistant (chat panel + inline
completions), not a CLI tool. Treat Dflow workflow names as plain chat
instructions rather than CLI slash commands:

- In the Copilot Chat: "Run the Dflow /dflow:new-feature workflow" — Copilot should read the canonical guide and proceed.
- In code comments or editor chat, describe the workflow as plain text: `Run the Dflow /dflow:new-feature workflow.`

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

### Optional Prompt Adapters

If you want tool-native entries in a Copilot / VS Code environment that
supports prompt files, run this in an initialized project:

```bash
dflow configure-agents --command-adapters
```

After you select GitHub Copilot, Dflow projects thin prompt wrappers from the
command registry inside the canonical guide:

- `.github/prompts/dflow-<id>.prompt.md`

These prompts use `/dflow-<id>` in the Copilot / VS Code prompt menu, for
example `/dflow-new-feature`. Their body only points to the canonical
`/dflow:new-feature` workflow and `dflow/specs/shared/AI-AGENT-GUIDE.md`; it
does not copy workflow steps. Copilot's `/` parser behavior differs from
Claude and Codex: the prompt menu entry is `/dflow-<id>`, while chat text may
still name the canonical `/dflow:<id>` workflow.

### Skill Auto-Trigger Status on Copilot (Currently Deferred)

If you have seen `dflow configure-agents --skills` (the skill that restores
natural-language auto-trigger), note that in **PROPOSAL-056 Phase 1**, `--skills`
projects a project-level skill only for **Claude Code and Codex**; it does
**not** create `.github/skills` for GitHub Copilot, and it prints a deferral
note when run. Copilot skill auto-trigger is **currently deferred**, with no
committed timeline yet. Until then, Copilot users should use the prompt adapters
above (`dflow configure-agents --command-adapters`, which produce
`.github/prompts/dflow-*.prompt.md`) as the tool-native entry point.

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

### Notes on Slash-Command Passthrough

Copilot may or may not passthrough raw `/dflow:*` slash commands depending on the IDE integration and Copilot version. If Copilot does not recognize a slash-prefixed workflow name, re-send the request as plain prose:

```text
You: Instead of /dflow:new-feature, try: "Please help me start a new Dflow
     feature workflow. Read dflow/specs/shared/AI-AGENT-GUIDE.md first."
```

## Differences vs Other AI Tools

The canonical guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is the same across tools. Only the root-level shim differs:

| Tool | Generated shim | Loads canonical guide via |
|---|---|---|
| GitHub Copilot | `.github/copilot-instructions.md` | Reads repository instructions directly |
| Claude Code | `CLAUDE.md` | `@dflow/specs/shared/AI-AGENT-GUIDE.md` Markdown import |
| Codex / Copilot coding agent | `AGENTS.md` | Reads file content directly when starting |

- Shim path: Copilot uses `.github/copilot-instructions.md` (not `AGENTS.md` or `CLAUDE.md`).
- Markdown import: Copilot shim has NO `@dflow/specs/shared/AI-AGENT-GUIDE.md` import. This contrasts with the Claude Code shim, which inlines via an `@` import.
- Tool model: Copilot is IDE-based (chat panel + inline completions); Codex/Claude Code are CLI-based agents. Copilot interacts through the editor UI rather than a command-line session.
- Workflow invocation: canonical `/dflow:*` is shared vocabulary, but each tool's `/` parser behaves differently. In Copilot chat text, name `/dflow:<id>`; if you opt in to `--command-adapters`, the VS Code prompt menu name is `/dflow-<id>`, such as `/dflow-new-feature`.
- Permission model: Copilot relies on the IDE's permission and extension sandbox. It may prompt for or be governed by editor-level approvals; CLI tools often have explicit sandbox flags and separate permission gates.

## Common Patterns and Gotchas

- Keep `.github/copilot-instructions.md` thin. The canonical Dflow guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is the source of truth.
- If Copilot appears to be working only from the shim text, ask it to open or read `dflow/specs/shared/AI-AGENT-GUIDE.md` before continuing.
- Copilot's inline completions may suggest code without following Dflow workflows; explicitly request the workflow when you need spec-driven output.
- Copilot chat context may not automatically include repository instruction files from `.github/` in all IDE versions; behavior varies by Copilot / IDE version (see footer note).
- Use plain prose to name the canonical `/dflow:<id>` workflow when slash-prefixed forms are rejected by the IDE.
- Prompt adapters are thin wrappers generated from the canonical command registry; do not hand-write or copy Dflow workflow steps under `.github/prompts/`.

## Where to Go Next

- If you have not run `init`: run `dflow init` (after `npm install -g dflow-sdd-ddd`) or `npx dflow-sdd-ddd init` and choose the Copilot target to create `.github/copilot-instructions.md`.
- Read [`dflow/specs/shared/AI-AGENT-GUIDE.md`](../sdd-ddd-greenfield-skill/scaffolding/AI-AGENT-GUIDE.md) (or the brownfield equivalent) before starting a workflow.
- See [`tutorial/01-greenfield/`](../tutorial/01-greenfield/walkthrough-00-setup.md) for conversation examples that demonstrate Copilot chat flows.
- Read [`docs/why-ddd-for-ai.en.md`](why-ddd-for-ai.en.md) for the design rationale behind spec-first plus DDD.

---

Note on IDE behavior: Slash-command passthrough and automatic inclusion of `.github/` instruction files vary by Copilot / IDE version. Confirm with a maintainer before relying on exact semantics.
