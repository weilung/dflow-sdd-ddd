# Release and Versioning Policy

This document defines the lightweight release policy for Dflow while the project
is in the `0.x` series. It is maintainer-facing; contributors can use it to
describe expected version impact in a PR, but only maintainers publish releases.

## Versioning During 0.x

Dflow uses SemVer-style version numbers, with extra care in `0.x` because the
workflow contract is still evolving.

Use a patch release for:

- Bug fixes.
- Documentation corrections or clarifications.
- Non-breaking template wording changes.
- Release metadata fixes.
- Internal cleanup that does not change generated output or workflow contracts.

Use a minor release for:

- A new CLI command.
- A new generated file.
- A materially changed generated file shape.
- A new or expanded `/dflow:*` workflow contract.
- A change that affects how Greenfield or Brownfield projects are initialized.
- A migration-relevant template, scaffolding, or skill behavior change.

Major versions are reserved for `1.0` and later. Before `1.0`, breaking changes
may still appear in minor releases, but release notes must call them out clearly
and describe the expected user action.

## What Counts as Breaking

A change is breaking when an existing Dflow user may need to adjust project
files, scripts, AI-agent instructions, or workflow habits after upgrading.

Examples:

- Renaming generated paths.
- Removing a generated file.
- Changing required init prompts.
- Changing the meaning of a template section.
- Changing command behavior in a way that invalidates existing docs.
- Replacing a workflow contract that AI agents rely on.

Counter-examples (NOT breaking):

- Replacing stack-specific framing with stack-neutral umbrella terms when
  the architectural meaning is unchanged (e.g., "Code-Behind" →
  "delivery/entrypoint code") — adopter's existing files are not
  rewritten by Dflow.
- Renaming an init placeholder if the previous name still resolves via a
  backward-compat alias and the substituted value is identical (e.g.,
  `{ASP.NET Core version}` continuing to resolve while `{Framework version}`
  becomes canonical).
- Adding a new optional placeholder; existing templates that don't use it
  are unaffected.

## Release Ownership

Dflow currently has four release surfaces:

- Development repo: source of truth for design work, implementation, planning,
  and release preparation.
- Dist repo: clean public projection of selected source files.
- npm package: executable CLI and packaged templates selected by
  `package.json#files`.
- GitHub Release: public release note and tag record.

For now, npm publishing may remain a manual maintainer action. Release
automation should be introduced only after the manual dist shape and release
checklist remain stable across multiple releases.

## Tags

Use `v<version>` tags, for example `v0.1.1`.

When both development and dist repos are maintained, tag both repos for the same
published version after verification. The tags may point to different commits
because the dist repo is a selected projection of the development repo.

## Changelog and Release Notes

Update `CHANGELOG.md` before publishing. Each release entry should state:

- The version and date.
- User-facing changes.
- Changed files or affected areas when useful.
- Verification performed.
- Any breaking change or migration note.

GitHub Release notes may summarize the changelog entry, but they should not be
the only place where release history is recorded.

## Greenfield and Brownfield Changes

If a change touches a common SDD flow, update both Greenfield and Brownfield
skill sources unless the release intentionally changes only one track.

Common synchronized flow files include:

- `init-project-flow.md`
- `new-feature-flow.md`
- `modify-existing-flow.md`
- `new-phase-flow.md`
- `finish-feature-flow.md`
- `drift-verification.md`
- `pr-review-checklist.md`
- `git-integration.md`

Track-specific changes should be named in the changelog and release notes.
