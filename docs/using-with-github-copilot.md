# Using Dflow with GitHub Copilot

A walk-through of what Dflow looks like when your AI coding agent is GitHub Copilot (IDE chat + inline completions). About 10 minutes to read.

This guide focuses on the Copilot experience specifically. For the tool-neutral evaluation flow, see `docs/evaluating-dflow.md`. For the full Get Started and feature list, see `README.md`.

## Who this guide is for

You are using or evaluating Dflow with GitHub Copilot in an IDE (e.g., VS Code). This guide covers what Copilot sees after `init`, the repository shim location, how to invoke Dflow workflows from the IDE, and Copilot-specific UX and permission patterns worth knowing.

## Prerequisites

- GitHub Copilot enabled in your IDE (VS Code, JetBrains, or GitHub.dev).
- A project initialized with `npx dflow-sdd-ddd init` (so the repository shim exists).
- Basic familiarity with the Dflow canonical guide: `dflow/specs/shared/AI-AGENT-GUIDE.md`.

## What GitHub Copilot sees after `init`

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

## Using Dflow workflow commands with GitHub Copilot

Copilot is an IDE-first assistant (chat panel + inline completions), not a CLI tool. Treat Dflow workflow names as plain chat instructions rather than CLI slash commands:

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

### Sample conversation flow

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

### Pre-existing repository instructions

If a `.github/copilot-instructions.md` file already exists in your project, `init` does not overwrite it. Instead, it writes a merge snippet under `dflow/specs/shared/` that you can review and paste into your existing file manually. This avoids destroying custom Copilot instructions you already had.

Look for a file named `dflow/specs/shared/COPILOT-INSTRUCTIONS-MERGE-SNIPPET.md` and paste the relevant sections into your existing `.github/copilot-instructions.md`.

### Notes on slash-command passthrough

Copilot may or may not passthrough raw `/dflow:*` slash commands depending on the IDE integration and Copilot version. If Copilot does not recognize a slash-prefixed workflow name, re-send the request as plain prose:

```text
You: Instead of /dflow:new-feature, try: "Please help me start a new Dflow
     feature workflow. Read dflow/specs/shared/AI-AGENT-GUIDE.md first."
```

## Differences vs other AI tools

- Shim path: Copilot uses `.github/copilot-instructions.md` (not `AGENTS.md` or `CLAUDE.md`).
- Markdown import: Copilot shim has NO `@dflow/specs/shared/AI-AGENT-GUIDE.md` import. This contrasts with Claude/Gemini CLI shims which inline via `@` imports.
- Tool model: Copilot is IDE-based (chat panel + inline completions); Codex/Claude Code are CLI-based agents. Copilot interacts through the editor UI rather than a command-line session.
- Workflow invocation: With CLI agents you may type `/dflow:*` to the agent process; with Copilot prefer plain-chat phrasing in the Copilot Chat or editor comments.
- Permission model: Copilot relies on the IDE's permission and extension sandbox. It may prompt for or be governed by editor-level approvals; CLI tools often have explicit sandbox flags and separate permission gates.

## Common patterns and gotchas

- Keep `.github/copilot-instructions.md` thin. The canonical Dflow guide (`dflow/specs/shared/AI-AGENT-GUIDE.md`) is the source of truth.
- If Copilot appears to be working only from the shim text, ask it to open or read `dflow/specs/shared/AI-AGENT-GUIDE.md` before continuing.
- Copilot's inline completions may suggest code without following Dflow workflows; explicitly request the workflow when you need spec-driven output.
- Copilot chat context may not automatically include repository instruction files from `.github/` in all IDE versions (verify with maintainer).
- Use plain prose to name workflows when slash-prefixed forms are rejected by the IDE.

## Where to go next

- If you have not run `init`: run `npx dflow-sdd-ddd init` and choose the Copilot target to create `.github/copilot-instructions.md`.
- Read `dflow/specs/shared/AI-AGENT-GUIDE.md` before starting a workflow.
- See `tutorial/01-greenfield/` for conversation examples that demonstrate Copilot chat flows.

----

Note: anything marked "(verify with maintainer)" above indicates behaviour that varies by Copilot/IDE version and should be confirmed with a maintainer before assuming exact passthrough semantics.