# Evaluating Dflow

> [繁體中文](evaluating-dflow.md) | **English**

A short guide for first-time evaluators deciding whether Dflow fits a project.
About 10 minutes to read, optional 30 minutes to try in a sample project.

## Who This Guide Is For

You are deciding whether to introduce Dflow into a codebase. You may be a
tech lead evaluating workflow changes for an AI-assisted team, a solo
developer comparing AI coding workflows, or a team member asked to assess
Dflow before broader adoption.

This guide answers the most common evaluation questions in one place. It does
not replace [`README.md`](../README.en.md) (overview) or [`tutorial/`](../tutorial/)
(deep walk-throughs); it is a focused decision aid.

## What Is Dflow

Dflow is a workflow kit for AI-assisted development. It gives an AI coding
agent a concrete process for turning change requests into structured specs,
domain language, and reviewable code, instead of jumping from prompt straight
to code.

Dflow is Markdown-based workflow material plus a scaffolding CLI. It does not
require a runtime, server, or framework. Once `init` runs, Dflow lives entirely
in your project's `dflow/specs/` directory and AI instruction files.

## What `init` Creates and Does Not Do

`dflow init` (or `npx dflow-sdd-ddd init` on the no-install path) creates:

- A `dflow/specs/` workspace (overview, conventions, domain glossary, context
  map, architecture/tech-debt, features active/completed). See
  [`README.md` "Files Created by Init"](../README.en.md#files-created-by-init)
  for the full tree.
- A canonical project guide at `dflow/specs/shared/AI-AGENT-GUIDE.md`.
- Mergeable AI agent instruction files for the tools you select (e.g.,
  `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`). Each is a
  thin pointer to the canonical guide.

`init` does **not**:

- Inspect, refactor, or migrate your application code.
- Overwrite existing AI agent instruction files; if one exists, Dflow writes
  a merge snippet under `dflow/specs/shared/` instead.
- Modify your build system, package manager, or dependencies.
- Send any data anywhere; it is a local scaffolding command.

## How Dflow Works With Different AI Tools

Dflow targets multiple AI coding agents. After running `init`, you select one
or more tools and Dflow writes the corresponding shim:

| Tool | Generated file |
|---|---|
| Codex / Copilot coding agent | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |

Each shim points back to the canonical
`dflow/specs/shared/AI-AGENT-GUIDE.md`. Practical implications:

- Multiple tools can be active in the same project without diverging
  workflow rules.
- Switching or adding tools later does not require re-running `init`; use
  run `dflow configure-agents` to add another shim.
- The project guide stays the single source of truth for Dflow workflow
  behavior.

If your tool does not support custom slash commands, use the same command
names (e.g., `/dflow:new-feature`) as plain instructions in chat. Dflow is
Markdown-based workflow material; it works with any AI agent that can read
project instructions and repository context.

For a tool-specific walk-through of what `init` writes and how the slash
commands appear in conversation, see the per-tool guides:

- [Using Dflow with Claude Code](using-with-claude-code.en.md)
- [Using Dflow with Codex CLI](using-with-codex.en.md)
- [Using Dflow with GitHub Copilot](using-with-github-copilot.en.md)

## Greenfield or Brownfield: Choosing a Track

Pick **Greenfield** if:

- You are starting a new system or a new bounded module.
- You have room to shape architecture before legacy constraints accumulate.
- You want explicit domain models from feature 1.

Pick **Brownfield** if:

- You are extending or modifying an existing codebase.
- Business rules are scattered across handlers, stored procedures, UI code,
  or scripts.
- You want to introduce specs and domain extraction incrementally without
  refactoring everything first.

Mixed cases:

- New module inside an existing app: usually Greenfield, scoped to the new
  bounded context.
- Existing app with clean architecture and active development: either track
  works; Brownfield is safer if rules are not yet documented.

## A 30-Minute Evaluation Playbook

This walk-through lets you see what Dflow does without committing it to a
real codebase.

1. **Create a sample project** (Greenfield):

   ```bash
   mkdir dflow-sample && cd dflow-sample
   git init
   ```

2. **Install and run init**:

   ```bash
   npm install -g dflow-sdd-ddd
   dflow init
   ```

   If you prefer not to install globally, use `npx dflow-sdd-ddd init`
   instead. When prompted, choose Greenfield. Pick one AI tool to generate
   the shim for.

3. **Inspect what was created**:

   ```bash
   ls -la
   find dflow -type f
   ```

   Open `dflow/specs/shared/_overview.md`,
   `dflow/specs/shared/_conventions.md`, and
   `dflow/specs/shared/AI-AGENT-GUIDE.md` to see the shape.

4. **Read one tutorial walk-through** to see what a real feature flow looks
   like end to end:
   - Greenfield: [`tutorial/01-greenfield/`](../tutorial/01-greenfield/walkthrough-00-setup.md)
   - Brownfield: [`tutorial/02-brownfield/`](../tutorial/02-brownfield/walkthrough-00-setup.md)

5. **Optional: try one workflow command**. Open the sample project in your
   AI tool and ask it to run `/dflow:new-feature` (or paste the equivalent
   instruction in chat). Inspect what it writes to `dflow/specs/`.

6. **Decide and clean up**. If Dflow does not fit, delete the sample
   directory. There is no global state to clean; nothing was installed
   beyond the one-shot `npx` cache.

If you want a deeper read instead of running anything, the tutorial
walk-throughs cover the same flow with worked outputs you can compare
against.

## What If You Stop Using Dflow

Dflow is designed for low cost to try and low cost to leave:

- Nothing depends on the `dflow-sdd-ddd` CLI being installed after `init`.
- The generated files are plain Markdown; remove Dflow from a project with
  `rm -rf dflow/` plus deleting the AI agent shim files you no longer want.
- Existing project instruction files (e.g., a pre-existing `CLAUDE.md`) are
  not modified by Dflow, so reverting is straightforward.

This means an evaluation pass leaves no permanent footprint if you decide
not to adopt.

## Cost Per Feature: A Rough Estimate

Dflow scales ceremony to change risk through three tiers (see
[`README.md` "Workflow Model"](../README.en.md#workflow-model) for full
detail):

- **T1 Heavy** — new features, new phases, new Aggregates or Bounded
  Contexts, architecture changes, new business rules. A full phase-spec
  with domain modeling, behavior examples, an implementation plan, and
  verification + finish checks. The cost is real but proportional to
  the risk being managed.
- **T2 Light** — bug fixes (logic errors), UI verification adjustments,
  small changes with a business-rule delta. A lightweight spec, focused
  verification, and confirmation that the fix lands in the correct
  architectural layer.
- **T3 Trivial** — button colors, copy typos, pure formatting — **no
  business-rule, Domain, or data-structure changes**. One line in
  `_index.md`; no separate spec file.

Tier choice is not always manual: `/dflow:new-feature` and
`/dflow:new-phase` default to T1; `/dflow:modify-existing` and
`/dflow:bug-fix` let the AI judge T1/T2/T3 based on what is actually
changing. Pure typo / formatting commits (e.g., `prettier`,
`dotnet format`) can skip Dflow entirely and just `git commit` — Dflow
is for changes with business semantics or structural impact.

## Project Language Compatibility

Dflow templates use **canonical English** structure (headings, field labels)
so AI agents can locate sections reliably across projects. The free-form
content you write inside templates can be in any team language — English,
Traditional Chinese, Simplified Chinese, or others. The init flow asks for
the project's prose language and stores it in
`dflow/specs/shared/_conventions.md`.

Practical effect:

- AI tools see stable English structure across projects.
- Humans read and write specs in the team's chosen language.
- No need to translate templates or maintain parallel localized copies.

## Where to Go Next

If you decided Dflow fits:

- Run `init` in your real project (consider a branch first).
- Read [`tutorial/`](../tutorial/) for end-to-end walk-throughs and worked
  outputs.
- See [`CONTRIBUTING.md`](../CONTRIBUTING.md) before opening issues or
  pull requests.

If you are still deciding:

- Read [`docs/why-ddd-for-ai.en.md`](why-ddd-for-ai.en.md) for the design
  rationale behind spec-first plus DDD.
- Compare a tutorial scenario step-by-step with its `outputs/` tree to see
  what production-shape Dflow specs look like.

If Dflow does not fit your project today:

- The structured-spec idea is portable; you can adopt parts of it without
  the CLI.
- Open a docs feedback issue (see
  [`CONTRIBUTING.md`](../CONTRIBUTING.md)) if a specific gap blocked you.
  That feedback helps future evaluators.
