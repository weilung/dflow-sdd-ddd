# Upgrading an Existing Dflow Project

> [繁體中文](upgrading.md) | **English**

> This page is the latest guidance and tracks the source `main` branch. Upgrade the CLI to the latest npm release first, then follow this page:
>
> ```bash
> npm install -g dflow-sdd-ddd@latest
> ```
>
> The page describes the behavior of the latest published release; the core principle — who owns what, and what is never touched — applies to older versions as well. Behaviors that require a newer version are called out explicitly.

## The upgrade model

Upgrading Dflow is two steps: update the CLI (the line above), then re-run the projection from your project root:

```bash
dflow configure-agents
```

`configure-agents` is an idempotent *re-projection*: it refreshes only the layers Dflow itself owns, and **never rewrites or migrates content you authored automatically** — the one case that does rewrite user content is marker adoption you **explicitly accept** in an interactive prompt (its cost is spelled out in the state matrix below). What gets refreshed — and what needs a flag — is in the table below.

## Who owns what: the ownership × flag table

| Surface in your project | Examples | Owner | What flagless `dflow configure-agents` does | Flag required |
|---|---|---|---|---|
| Starter scaffolding and your specs | `_overview.md`, the body of `_conventions.md`, the header and `## 6.`-and-below of `Git-principles-{policy}.md`, everything you wrote under `dflow/specs/` | **You** | Untouched; the single exception is advancing the `> Dflow Version:` reconciliation line in `_conventions.md` to the current CLI version | — |
| Workflow bundle | `dflow/specs/shared/dflow-workflows/` (flow docs, blank templates, `.dflow-bundle-manifest.json`) | Dflow | **Re-projected automatically**; files retired by the new version are removed via the manifest diff | — |
| Marker-delimited regions | `agent-shim` marker blocks inside `CLAUDE.md` / `AGENTS.md` / `.github/copilot-instructions.md`; the `guide-canonical` region of `AI-AGENT-GUIDE.md`; the `git-principles-canonical` region of `Git-principles-{policy}.md` (sections 1-5) | Dflow (inside markers) / you (outside) | **Refreshes the `agent-shim`, `guide-canonical` and `git-principles-canonical` regions in place**; everything outside — `## Project Context`, and the Git principles file header plus everything from `## 6. AI Collaboration Rules (Project Policy)` down — is preserved | — |
| Tool-native command entries | `.claude/commands/dflow/`, `.github/prompts/dflow-*.prompt.md`, etc., plus the `codex-command-triggers` marker region inside `AGENTS.md` | Dflow | Not regenerated | `--command-adapters` |
| Project-level skills | `.claude/skills/dflow/`, `.agents/skills/dflow/`, `.github/skills/dflow/` | Dflow | Existing skills are not regenerated; newly selected tools without a skill are offered one (installed by default) | `--skills` (force-regenerate all) |

One-sentence version: **flagless refreshes the bundle plus the `agent-shim`, `guide-canonical` and `git-principles-canonical` regions; command adapters (including the `codex-command-triggers` region in `AGENTS.md`) and existing skills each need their flag; content you wrote is never rewritten or migrated automatically.**

## How existing files are treated

- **Pristine Dflow shims** (fully generated, never edited by you) → regenerated in place.
- **Files that already contain a Dflow marker block** → only the block's interior is refreshed; everything outside is preserved.
- **Existing agent files that do not yet point at the canonical guide** → a marker-managed block is appended at the end after you confirm the overall preview.
- **Agent files you wrote yourself that already point at the canonical guide** → init leaves them untouched (it only warns); an **interactive `configure-agents`** run offers to append the marker-managed block (default **No**), and non-interactive runs always skip with a warning.
- **A damaged or conflicting `agent-shim` marker in an agent file** → your file is left untouched; the content to merge is written as a merge snippet under `dflow/specs/shared/` for you to merge by hand.
- **A damaged `codex-command-triggers` marker in `AGENTS.md`** → the untouched-file + merge-snippet handling applies only on runs where `--command-adapters` manages that region; flagless runs leave the damaged trigger region alone and still refresh the same file's `agent-shim` region normally — provided the trigger markers do not overlap or straddle the shim region; when they do, even a flagless run leaves the whole file untouched and falls back to a merge snippet.
- **A damaged `guide-canonical` marker in `AI-AGENT-GUIDE.md`** → the guide is left untouched; you get instructions to repair or remove the markers (no merge snippet is produced).
- **An `AI-AGENT-GUIDE.md` created by an older version, without markers** → an interactive `configure-agents` run offers marker adoption. **Mind the cost of accepting**: the guide is rebuilt from the packaged template — only your `## Project Context` is preserved and **every other customized section is replaced**; if you edited other sections, decline and merge by hand instead. Until adopted, `dflow doctor` reports the file as frozen and it is never refreshed automatically.
- **A damaged `git-principles-canonical` marker in `Git-principles-{policy}.md`** → your file is left untouched; you get instructions to repair or remove the markers (no merge snippet is produced). `dflow doctor` reports this state on its own and never as "predates the markers" — a file broken by an edit must not be offered a rewrite of sections nobody has re-read.
- **A `Git-principles-{policy}.md` created by an older version, without markers** → an interactive `configure-agents` run offers marker adoption. **This offer is much narrower than the guide's**: only sections 1-5 are replaced with this version's content, while the file header (including the `> Created:` date you filled in) and everything from `## 6. AI Collaboration Rules (Project Policy)` down — your CI / CD section included — is kept exactly as you wrote it. (One normalization applies to the whole file, as it always has: line endings are unified to whichever the file already uses most, so a file with *mixed* endings comes back consistent rather than byte-identical.) Decline only if you customized something inside sections 1-5. Until adopted, `dflow doctor` reports the canonical sections as frozen and they are never refreshed automatically.
  ⚠ **Trunk projects, one extra note**: older starters put adopter choices inside the canonical region — for greenfield, the merge strategy in `## 3.`; for brownfield, that **plus** the "do we require Conventional Commits" choice in `## 2.`. Those *choices* now live under `## 6.`, with the trade-offs left where they were. Because `## 6.` is outside the region, `configure-agents` will **not** add that subsection for you — record your choice there yourself after upgrading.
- **A `Git-principles-{policy}.md` Dflow cannot recognize** (its `## 1. Branch Structure` and `## 6. AI Collaboration Rules (Project Policy)` headings are not both present exactly once) → left untouched with a warning, and no adoption is offered: without both anchors there is no way to tell where the canonical sections end and yours begin.

## First step after upgrading: `dflow doctor`

```bash
dflow doctor
```

doctor is a **read-only** check — it reports and never writes. Upgrade-relevant checks include:

- the reconciliation version in `_conventions.md` lagging behind the current CLI
- policy sections missing from `_conventions.md` (`## Git Policy` / `## AI Commit Policy` / `## Prose Language`) — named individually, with how to restore each
- policy sections that are no longer machine-readable
- `_conventions.md` being **missing entirely, or empty**
- `_conventions.md` **content sections** lagging the current contract — a current rule absent, or wording PROPOSAL-082 retired still present (the escalate-only rule in Ceremony Scaling, the no-BR families in Filling the Templates, the minimal-host exception in SPEC-ID Format). Named section by section, with what to restore
- a frozen (marker-less) guide, or bundle `§` references pointing at sections that no longer exist
- the `Git-principles-{policy}.md` starter for your selected Git policy being missing, or its **canonical sections 1-5** differing from this version — reported apart from three other states: markers not yet adopted, markers damaged, and an installed package whose own packaged starter is unusable. Only sections 1-5 are compared, so your own sections never show up as drift
- feature `_index.md` files under `features/active/` still in an older template shape (`completed/` is not scanned)
- agent files that point at the canonical guide but are not managed by Dflow

## Thorough verification (the baseline procedure)

doctor is the first pass. To fully confirm nothing was missed, use the clean-comparison baseline:

1. Run a fresh `dflow init` somewhere else with the **same edition and the same answers** (and the same CLI version).
2. Diff it file by file against your project.
3. Every difference should classify as one of three things: "your user content", "a known outside-the-markers region", or **"a section a newer template added that your project predates"**. The third class has two routes: `dflow doctor` (previous section) names the missing sections it recognizes and tells you how to restore them; for anything doctor does not name, see `CHANGELOG.md` (currently zh-TW only), where the release entry says what the section is and whether to adopt it — and, where placement matters, where it goes (e.g. P-083 restoring `### SPEC-ID Format` and `### Slug Conventions` to `_conventions.md` notes they belong above `## Prose Language`). Of that pair, doctor now names `### SPEC-ID Format` directly; `### Slug Conventions` has no fingerprint, so it remains a CHANGELOG-only case. Anything that fits none of the three is a missed fix — handle it item by item.

## Extra steps for the release containing P-082 / P-083

> ⚠ **This section applies only to the release containing P-082 / P-083.** If you
> are on 0.14.0, the router wording described below does not exist yet — skip it
> (`dflow --version` confirms).

That release replaces the wording that decides **when Dflow engages at all**. The
old exclusion was unqualified — refactors, renames, chores, formatting and
dependency bumps never triggered, and the root shim additionally said "you need
not read the guide first". But the cascade in the same release classifies a
security / CVE dependency bump, an operational-axis refactor (payment, safety,
compliance), and a Domain / schema rename as work that **must** enter the
workflow. Keeping the old wording keeps a trigger that silently declines
security-class work — and nothing surfaces it on its own, because no test can see
a trigger that decides not to fire.

Two carriers, handled separately:

- **The skill** (`.claude/skills/dflow/`, `.agents/…`, `.github/…`) → run
  `dflow configure-agents --skills`. A flagless run does **not** regenerate an
  existing skill (see the ownership table above), so the flag is required.
- **The root shim** (`CLAUDE.md` / `AGENTS.md` /
  `.github/copilot-instructions.md`) → depends on whether you edited it:
  - **An unedited whole-file Dflow shim** → a flagless `dflow configure-agents`
    regenerates it in place. **Every shim body `dflow init` has generated since
    v0.1.1 is recognized** — all three (the v0.1.1–v0.7.0 pre-bundle form, the
    **0.8.0–v0.9.0** pre-scoping form, and the 0.10.0–0.14.0 scoped form) — so
    none of them is mistaken for a file you wrote.
    **v0.1.0 is the exception**: that release wrote `CLAUDE.md` through a
    different path, from the packaged snippet with project-specific values
    substituted in, so there is no fixed body to match. Such a file is treated
    as one you maintain — `dflow doctor` reports it and the routine paragraph
    has to be replaced by hand.
  - **A file carrying `agent-shim` markers** → only the text inside the markers is
    refreshed; everything outside is preserved.
  - **A file you edited that has no markers** → Dflow leaves it alone. `dflow
    doctor` reports this state; replace the routine paragraph by hand, or accept
    the managed marker block in an interactive `configure-agents` and let it
    regenerate afterwards.

To tell the two apart: the new routine paragraph contains "**Routine is narrower
than it sounds**" and hands the decision back to the guide's § Ceremony Scaling.
The old one does not.

## Version-compatibility notes

- Re-project with the **same CLI version you are aligning to**: upgrade the CLI first, then run `dflow configure-agents`.
- Avoid running an **older** CLI against a newer project layout — it can project outdated content back over newer files.
- For version-control recommendations and gitignore snippets for generated artifacts (command adapters / skills), see the "Version-control policy for generated artifacts" section of the [README](../README.en.md) and the per-tool guides in `docs/`.
