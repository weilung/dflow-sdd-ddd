# Contributing to Dflow

Thanks for taking the time to improve Dflow. This project is a spec-first
SDD/DDD workflow kit for AI-assisted development, so changes are reviewed for
both implementation correctness and workflow clarity.

## Before You Start

Please read:

- `README.md` for the public project overview and installation flow.
- `TEMPLATE-COVERAGE.md` before changing templates, scaffolding, or generated
  document structure.
- `TEMPLATE-LANGUAGE-GLOSSARY.md` before changing template headings or field
  labels.
- The relevant Greenfield or Brownfield skill source when changing workflow
  behavior.

The public source is kept intentionally smaller than the development workspace.
Internal planning notes, proposal handoffs, and review artifacts are maintainer
records; public issues and pull requests should be understandable without them.

## What to Open

Open a bug report when an existing command, generated file, or documented flow
does not behave as described.

Open a workflow change request when you want to change Dflow behavior, template
shape, generated scaffolding, DDD guidance, or the contract of a `/dflow:*`
flow.

Open docs feedback when the current documentation is confusing, incomplete, or
hard to follow.

Open a question when you need help deciding how Dflow applies to your project.
Questions are welcome, but this project does not promise a general support SLA.

If an AI assistant notices a possible Dflow issue while helping in your project,
you can ask it to run `/dflow:report-dflow-feedback`. That flow should produce a
sanitized local draft that you review before opening a GitHub issue or PR. It
must not submit private project details or publish anything automatically.

## Pull Request Expectations

Keep pull requests focused. A good PR explains:

- What changed and why.
- Which files or workflow contracts are affected.
- Whether the change affects Greenfield, Brownfield, or both tracks.
- Whether common flow files were synchronized across both tracks.
- Whether generated templates, tutorial material, or coverage docs need updates.
- What verification was run.

For code or packaging changes, run:

```bash
npm test
npm pack --dry-run
git diff --check
```

For documentation-only changes, at minimum run:

```bash
git diff --check
```

If a command cannot be run in your environment, note that in the PR.

## Greenfield and Brownfield Synchronization

Several Dflow flows are shared between the Greenfield and Brownfield tracks. If
you change a common SDD flow, update both copies unless the change is
intentionally track-specific.

Common shared flows include:

- `init-project-flow.md`
- `new-feature-flow.md`
- `modify-existing-flow.md`
- `new-phase-flow.md`
- `finish-feature-flow.md`
- `drift-verification.md`
- `pr-review-checklist.md`
- `git-integration.md`

Track-specific behavior is fine, but it should be named explicitly in the PR.

## Template and Heading Changes

Dflow templates use canonical English structure so AI agents can locate sections
reliably across projects. User-authored prose inside generated documents may use
the team's chosen prose language.

Do not localize template headings or structural field labels as a drive-by
change. Localized headings require a separate design decision because they
affect templates, anchors, tutorial output, and verification strategy.

## Release Changes

If your change affects published behavior, generated files, CLI commands, or
workflow contracts, mention the expected version impact in the PR:

- Patch: bug fix, docs clarification, release metadata, or non-breaking wording.
- Minor: new command, new generated file, workflow contract expansion, or
  materially changed template shape.
- Breaking change: anything that can make existing Dflow projects or automation
  need manual adjustment.

See `docs/release-versioning-policy.md` for the maintainer release policy.
