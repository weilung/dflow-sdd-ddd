# Migrating to Dflow V1

> **Audience**: maintainers of an existing project that adopted an early
> Dflow form (pre-`dflow-sdd-ddd@0.1.0`) and want to align it with the
> V1 baseline that ships from npm.
>
> **Stance**: V1 took a clean cut. Dflow does not perform automatic
> migration. This guide is a manual checklist. The CLI only warns when
> it detects legacy paths; it does not modify existing files.

> **Audience reality (2026-05-15)**: To date, the only known user of
> this guide has been the **OBTS** migration (a single, completed
> one-off). Dflow has not had broad pre-V1 adoption; this guide is
> maintained as a contingency endpoint for `dflow doctor` and
> `dflow init` warning messages, not as documentation of an active
> migration program. If you reach this page via those tool outputs
> and your case isn't covered below, please open a docs feedback issue
> so the guide can be extended.

## When You Need This Guide

Skip this guide if you started using Dflow at `dflow-sdd-ddd@0.1.0`
or later. Your project is already on the V1 baseline.

Read this guide if any of the following are true:

- Your project has a top-level `specs/` directory that holds Dflow
  spec material (not the V1 `dflow/specs/`).
- Your project has `specs/_共用/` instead of `dflow/specs/shared/`.
- Your spec headings are in Traditional Chinese rather than the
  canonical English vocabulary documented in
  `TEMPLATE-LANGUAGE-GLOSSARY.md`.
- Your AI instructions point teammates to `/dflow:init-project`
  instead of the Dflow CLI init command (`dflow init`, or
  `npx dflow-sdd-ddd init` on the no-install path).
- Your `CLAUDE.md` (or equivalent root instruction file) was generated
  by an early Dflow variant that wrote a full Claude-only file rather
  than the V1 multi-AI thin shim that points to
  `dflow/specs/shared/AI-AGENT-GUIDE.md`.

You may need only some of these steps; the five sections below are
independent.

## Before You Start

- Work on a dedicated branch or a disposable copy. None of the steps
  are destructive, but move-and-rename mistakes are easier to recover
  from a clean branch.
- Make sure the working tree is clean (`git status`).
- Note your current Dflow version if you can identify it. Older
  internal Dflow forms may not have been versioned at all.
- Open these V1 reference files for cross-checking:
  - `TEMPLATE-LANGUAGE-GLOSSARY.md` — canonical English headings.
  - `TEMPLATE-COVERAGE.md` — V1 file layout and parity matrix.
  - `docs/evaluating-dflow.en.md` — what a fresh V1 `init` produces, if
    you want to spin up a sample project to compare against.
- For an on-demand read-only summary of legacy artifacts in your
  project, run `dflow doctor` (or `npx dflow-sdd-ddd doctor` on the
  no-install path). The command lists detected legacy paths and missing
  V1 fields; it never modifies files.

## Migration Steps

### 1. Move root `specs/` to `dflow/specs/`

V1 puts every Dflow-managed spec under `dflow/specs/`, so the `dflow/`
directory becomes a single Dflow namespace separate from any
unrelated `specs/` directory another tool may own (PROPOSAL-014).

If your project has top-level `specs/` containing Dflow content:

```bash
mkdir -p dflow
git mv specs dflow/specs
git status
```

Commit the rename in a single commit. Avoid mixing the rename with
content edits in the same commit so reviewers can read the diff
cleanly.

If you also have an unrelated `specs/` directory used by another
tool, move only the Dflow material into `dflow/specs/`. The CLI will
warn when it sees a non-Dflow `specs/` directory but will not modify
it.

### 2. Rename `_共用/` to `shared/`

V1 uses canonical English directory names (PROPOSAL-012). If your
project has `dflow/specs/_共用/`:

```bash
git mv dflow/specs/_共用 dflow/specs/shared
git status
```

Update any cross-references in spec files or AI instructions. A
project-wide grep after the rename catches leftover references:

```bash
grep -rn "_共用" .
```

### 3. Translate Chinese headings to canonical English

V1 templates use canonical English structure for section headings,
field labels, anchors, and placeholders (PROPOSAL-013). Free prose
inside those sections may stay in your team language.

This is the most labor-intensive step. Recommended approach:

1. Open `TEMPLATE-LANGUAGE-GLOSSARY.md` for the heading-by-heading
   mapping.
2. For each generated spec file, replace Chinese H2 / H3 headings,
   table column labels, and bold inline labels with their canonical
   English form.
3. Leave free prose (descriptions, decision rationale, task text) in
   the team language. The Prose Language convention recorded in
   `dflow/specs/shared/_conventions.md` applies here — see also
   step 6 below.

An AI assistant can walk through each spec file heading-by-heading
faster than a global search-and-replace, because earlier Dflow
adoption may have used slightly different wording per team. After
translation, run a project-wide search for the most common Chinese
headings to catch missed files. Adjust the search list to match the
templates your team actually used:

```bash
grep -rn "## 業務規則\|## 行為情境\|## 領域模型" dflow/specs/
```

### 4. Switch the init entry point

Pre-V1 documentation may have instructed teammates to start a Dflow
project by running `/dflow:init-project` from inside an AI agent. V1
removed that runtime slash command (PROPOSAL-014). The init flow now
runs as a shell command. Install Dflow globally and run:

```bash
npm install -g dflow-sdd-ddd
dflow init
```

If you cannot or do not want to install globally, use the no-install path:

```bash
npx dflow-sdd-ddd init
```

If you already have an initialized project, you do not need to re-run
`init`. The other `/dflow:*` workflow commands (`/dflow:new-feature`,
`/dflow:modify-existing`, `/dflow:bug-fix`, `/dflow:new-phase`,
`/dflow:finish-feature`, `/dflow:verify`, `/dflow:pr-review`) are
unchanged and continue to work.

Update any team documentation, runbooks, or onboarding notes that
still reference `/dflow:init-project` so new project setups use the
shell command instead.

### 5. Adopt multi-AI thin shims

V1 separates the canonical project guide from each per-tool
instruction file (PROPOSAL-020). The canonical guide lives at
`dflow/specs/shared/AI-AGENT-GUIDE.md`. Per-tool files (`AGENTS.md`,
`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) are thin
shims pointing at the canonical guide.

If your project's `CLAUDE.md` (or equivalent) was generated by an
early Dflow form that wrote a full file rather than a thin shim:

```bash
dflow configure-agents
```

This command adds shims for any AI tools you select. `dflow configure-agents`
does not overwrite an existing `CLAUDE.md`; instead, it writes a
`dflow/specs/shared/<tool>-md-snippet.md` that you can merge into the
existing file at your own pace.

If you prefer a fully clean V1 layout, archive the existing root
instruction file under another name first, then run
`dflow configure-agents` so it can write the new shim from scratch.

## After Migration

Verify the migrated project:

- Ask the AI agent to run `/dflow:status` and confirm it can locate
  Dflow flow material and report the project's current state.
- Open `dflow/specs/shared/_conventions.md` and confirm a `## Prose
  Language` section exists. If your project predates the
  prose-language convention (PROPOSAL-015), add the section manually
  with the correct BCP-47 language tag, for example `zh-TW` or `en`.
- Run a final grep to confirm no legacy paths or terms remain inside
  `dflow/specs/`. Adjust the term list to match your earlier Dflow
  adoption:

```bash
grep -rn "_共用\|/dflow:init-project" dflow/specs/
```

## Out of Scope

This guide stays manual on purpose. The items below are not part of
V1 and may or may not arrive in a later release; do not rely on them
when planning a migration today.

- Automatic migration of legacy paths or headings.
- A `dflow doctor` health check command.
- A `dflow migrate` subcommand that edits files.
- Automated translation of free prose between languages.

If any of these would help your team, open a docs feedback issue so
the request is recorded. The maintainer position is not to refuse
them, only to keep V1 a clean cut.

## Where To Go Next

- `docs/evaluating-dflow.en.md` for what a fresh V1 `init` produces, in
  case you want to compare against your migrated project.
- Per-tool walkthroughs under `docs/` for the AI tool you use:
  - `docs/using-with-claude-code.en.md`
  - `docs/using-with-codex.en.md`
- `TEMPLATE-COVERAGE.md` for the V1 logical / generated file parity
  between Greenfield and Brownfield tracks.

If something in this guide does not match your project's actual
pre-V1 state, open a docs feedback issue. The guide can be extended
as new edge cases come in.
