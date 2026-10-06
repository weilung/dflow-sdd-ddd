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

⚠ **For those last two rows, `dflow doctor` sees only files that are already there.** It reports a partial set of command entries (naming which are missing), `0.5.0`-era filenames left behind, and a Dflow-generated `SKILL.md` that has fallen behind the current CLI. It does **not** report "none of them are there" — that silence is deliberate, and its reasoning and residual risk are written up in [`doctor-uncertainty.en.md`](doctor-uncertainty.en.md) under "Shapes that are known and deliberately not reported". So if you **want** `/dflow:*` after an upgrade, run `dflow configure-agents --command-adapters` and check for yourself rather than waiting for doctor to tell you.

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
- feature `_index.md` files under `features/active/` still in an older template shape (`completed/` is not scanned) — for a dashboard without a shape marker; one that carries a marker is judged by the next check
- spec docs whose **shape marker** is older or newer than the current template's, missing, or unreadable — out of place, damaged, or not the only one (see [Shape markers](#shape-markers))
- agent files that point at the canonical guide but are not managed by Dflow
- a **partially installed** set of command entries — `.claude/commands/dflow/` or `.github/prompts/dflow-*.prompt.md` holding some of the 11 but not all, and `0.5.0`-era filenames left behind. ⚠ A set that is entirely absent is **not** reported; see the ownership table above
- a Dflow-generated `SKILL.md` (Claude, Codex, or Copilot) whose content has fallen behind this CLI — its `description` frontmatter is what a tool matches on to auto-engage, so a stale copy keeps an older trigger boundary. A `SKILL.md` without the Dflow marker is yours and is never reported
- a `.dflow-bundle-manifest.json` that exists but cannot be read or parsed. A manifest that has never been written is a normal state and stays silent; a damaged one is reported, because it silently disables both the bundle-version check and the edition every other check asks it for

⚠ Several of these checks used to switch themselves off when a value they read was absent — a missing `## Git Policy` section, an edition that could not be inferred, an unreadable packaged template — and said nothing about having done so. They no longer do: where the check can still be made without the value it is now made against every candidate, and where it genuinely cannot be, doctor says which checks did not run. Expect an upgraded project in one of those states to surface findings it was not shown before; they were always true.

## Thorough verification (the baseline procedure)

doctor is the first pass. To fully confirm nothing was missed, use the clean-comparison baseline:

1. Run a fresh `dflow init` somewhere else with the **same edition and the same answers** (and the same CLI version).
2. Diff it file by file against your project.
3. Every difference should classify as one of three things: "your user content", "a known outside-the-markers region", or **"a section a newer template added that your project predates"**. The third class has two routes: `dflow doctor` (previous section) names the missing sections it recognizes and tells you how to restore them; for anything doctor does not name, see `CHANGELOG.md` (currently zh-TW only), where the release entry says what the section is and whether to adopt it — and, where placement matters, where it goes (e.g. P-083 restoring `### SPEC-ID Format` and `### Slug Conventions` to `_conventions.md` notes they belong above `## Prose Language`). Of that pair, doctor now names `### SPEC-ID Format` directly; `### Slug Conventions` has no fingerprint, so it remains a CHANGELOG-only case. Anything that fits none of the three is a missed fix — handle it item by item.
   ⚠ One difference is none of the three and is **not** to be copied across: the `<!-- dflow-shape: ... -->` line at the top of a fresh doc. Its number states which template shape a doc was compared against, so give your existing docs one only through the procedure in [Shape markers](#shape-markers).

## Shape markers

Every template a Dflow flow creates a spec doc from carries one line, and the doc takes it along:

```markdown
<!-- dflow-shape: greenfield/rules.md 1 — keep this line: dflow doctor reads it -->
```

It records **which track's template, and which shape number of it, the doc was written against** — like the version number printed on a paper form. It is the first line of the doc, or the line right after the frontmatter when the doc has one. The rendered page does not show it; leave it where it is. Doctor reads it from that line only, and the text after the number (`— keep this line: …`) is optional. If any other line in the doc contains `dflow-shape:` — a marker quoted as an example, or an old one commented out, included — doctor does not judge the doc and reports it as unreadable instead: it does not decide which of those lines is the live marker.

**Which docs carry one.** The docs flows create from the workflow bundle's templates — `glossary.md`, `context-map.md`, a context's `models.md`, `rules.md`, `behavior.md`, `analysis.md` and `context.md`, `tech-debt.md` (plus `events.md` on greenfield), and in a feature directory `_index.md`, the phase specs and the lightweight specs (plus `aggregate-design.md` on greenfield) — and `shared/_overview.md`. Not `_conventions.md`, `Git-principles-*.md`, `AI-AGENT-GUIDE.md`, the agent snippets, or the ADR folder's README.

**What `dflow doctor` does with it.** It compares the number with the current number of the same template, in the CLI you have installed:

| The doc's marker | `dflow doctor` |
|---|---|
| Same number | Nothing. Wherever the doc differs from the template, that is your decision |
| Older number | One `info` listing the docs, the two numbers, and what changed in between, in three kinds:<br>**added** — a section, a column or a frontmatter field: you can add these;<br>**renamed, split, moved or removed** — reported only: you decide how to adapt;<br>**notes, comments and section order** — `>` notes, HTML comments, the order of the sections: they do not change the doc's structure, and you (with your AI assistant) decide whether to bring the doc in line |
| Newer number | One `warn`: your CLI is older than the doc — upgrade it |
| No marker | One `info` listing the docs; this check does **not** judge their shape (next section). A feature `_index.md` without a marker still gets the older-template check listed above |
| Unreadable (not on the marker's line, damaged, or more than one line containing `dflow-shape:`) | One `uncertain`, `unreadable-shape-marker` ([doctor-uncertainty.en.md](doctor-uncertainty.en.md)), with the line numbers and what to do |

Doctor checks the docs under `dflow/specs/`, except `shared/` — Dflow's own files; of those only `shared/_overview.md` is checked — and, under `features/`, anything outside `active/`: `completed/` and `backlog/` are never checked. When your project's workflow bundle comes from a newer Dflow than the installed CLI, doctor skips this check and says so: it would be comparing your docs against templates older than the ones your project uses.

### Adding markers to docs that have none (once)

Docs created before the release that introduced markers have none, so doctor lists them and leaves their shape alone — it will not guess which differences the template made and which you made. Adding the markers is a one-time job, best done with your AI assistant, doc by doc, **with you judging each difference**:

1. **Use the current templates.** If doctor says your workflow bundle is older than the CLI, run `dflow configure-agents` first. `_overview.md` is not in the bundle: use `templates/<track>/scaffolding/_overview.md` in the installed package, or run `dflow init` in a scratch directory.
2. **Confirm the track** (greenfield or brownfield) — the marker names it.
3. **Compare the doc with its template**: the `##` and `###` headings and their order, each table's header row, the frontmatter fields, and the `>` notes and HTML comments. Ignore example headings and rows (anything with a `{…}` placeholder), other prose, and — in a lightweight spec written in a no-BR family — `## Root Cause` and the change-type subsection under `## Behavior Delta`, which the family replaces on purpose.
4. **Judge every difference.** Before you handle a difference the template made later, check whether `dflow doctor`'s shape finding printed a migration for that item of that template: if it did, follow it instead of the default for its kind ([Changes that carry their own migration](#changes-that-carry-their-own-migration)). Something the template added after the doc was written → add the shape: the section; or the column, with `{TBD}` in existing rows and a comment above the table saying what the value is, when to backfill it and how to tell it is done; or the frontmatter field. Add the shape, not the content. Something the template renamed, split, moved or removed after the doc was written → decide how to adapt the doc yourself: carrying the template's version in beside yours would leave the old and the new side by side. Something you chose → keep it exactly as it is. (A project that writes one `## Rules` section where the template has three is making a choice; the marker is what lets doctor stop calling it drift.) Notes, comments and section order do not change the doc's structure: bring them in line with the template or keep yours — either is fine. A template note or comment already translated into your project's prose language (`_conventions.md` § Prose Language) counts as the same note: keep the translation and do not add the English original beside it, or the two will sit side by side. When you cannot tell whether a difference is a later template change or your own choice, use the project's own git history: the workflow bundle templates (`dflow/specs/shared/dflow-workflows/templates/`) in the commit that created the doc (if the doc was renamed, follow the rename back: `git log --follow --diff-filter=A -- <doc path>`) are the template it followed — if that spot is the same there and in the current template, the difference is your own choice; if it changed, the template changed it later. When that commit has no such template (the project predates the workflow bundle, the doc predates its template, or the doc is `shared/_overview.md`, which is not in the bundle), this comparison cannot decide: judge that difference yourself, and **never compare against a later commit** — a later template may already have changed, and a later template addition would then read as your own choice. The same difference in several docs created from the same template version can be judged once, listing the docs.
5. **Add the marker line**, copied from the current template, at the top of the doc — or right after its frontmatter.

⚠ **The number is a conclusion you reached, not a step to automate.** A current number on a doc that still has an older shape makes doctor silent about that doc from then on — the one mistake doctor cannot detect.
⚠ **Leave a zero-phase feature that has not closed out alone** — a minimal host: a feature directory holding one small change, with an empty Phase Specs table and no phase spec. Its closeout takes exactly two commits and allows only a closed list of changes, so a marker added now would block it. Doctor lists those docs apart; at closeout they move to `features/completed/`, which is not checked. A feature whose Phase Specs table is empty while its directory holds a phase spec is one doctor cannot place, so it lists those docs apart too: leave them alone if the feature is a minimal host, and handle them like the rest if it is not.
⚠ **Do not copy a whole template head into an older doc** — for example to pick up the table-formatting comment. The head carries the template's current marker.

A prompt you can give your AI assistant:

```text
For each doc `dflow doctor` lists as having no shape marker — except the ones it says to leave alone until closeout (for a feature doctor cannot place, ask me first whether it is a minimal host) — compare it with its current template under dflow/specs/shared/dflow-workflows/templates/ (for shared/_overview.md: templates/<track>/scaffolding/_overview.md in the installed dflow package). Compare the ## and ### headings and their order, each table's header row, the frontmatter fields, and the > notes and HTML comments; ignore {…} placeholder headings and rows, other prose, and the sections a lightweight spec's no-BR family replaces. List every difference and ask me, one difference at a time (the same difference in several docs created from the same template version is one question that names the docs), whether the template added it later, the template renamed, split, moved or removed it later, or I chose it; for a note, a comment or the section order, ask me whether to bring the doc in line. To tell a later template change from my choice, compare that spot in the workflow bundle template of the commit that created the doc (following renames: git log --follow --diff-filter=A -- <doc>) with the current template; if that commit has no such template (the project predates the bundle, the doc predates its template, or the doc is shared/_overview.md), say you cannot tell and ask me — never compare against a later commit. A note or comment translated into the project's prose language is the same note as the template's: never add the English original beside it. Before handling a difference the template made later, check whether dflow doctor's shape finding printed a migration for that item of that template; if it did, follow it instead of the default for its kind. For template additions, add the shape only: the section, the column (existing rows get {TBD}, plus a comment above the table saying what the value is, when to backfill it and how to tell it is done) or the frontmatter field. For a rename, split, move or removal, show me the doc's version and the template's and let me decide how to change the doc — never keep both side by side. Keep my choices as they are. Then copy the template's <!-- dflow-shape: ... --> line into the doc, as its first line or right after its frontmatter. Change nothing else.
```

### When a template's number goes up

After an upgrade, doctor lists the docs that are behind and what changed. A change listed with its own migration follows it instead of the default for its kind (next section). For each **added** item, add the shape as in step 4 above. For each **renamed, split, moved or removed** item, decide how to adapt the doc yourself — adding blindly would leave the old and the new section side by side. **Notes, comments and section order** do not change the doc's structure: compare them with the current template and decide whether to bring the doc in line. When the doc is handled — added to, brought in line, or a difference kept on purpose — change the number on its marker line to the current one; until then doctor reports it on every run.

### Changes that carry their own migration

For a few changes, the default for their kind would leave a doc wrong. Such a change carries a migration — one sentence saying how an existing doc takes it. Doctor prints it right after the change, and its action says to follow it instead of the default for its kind. The no-marker and unreadable-marker findings print the same sentences after the docs they are for. Doctor can do that only for a doc it can match to a template: by its marker, or — without a marker it can read — by the path the flows create the doc at. A renamed or moved doc without a marker it can read gets none: doctor cannot tell which template it came from. The sentences live only in doctor's output; this page explains what lies behind two of them rather than repeating them. As with every change, doctor never edits your docs, and a current number on a doc that has not taken the change makes doctor silent about it.

- **`rules.md`, the `Known deviations` column.** It links a rule to the debt row of a deviation recorded against it: the rule is confirmed, the code does not follow it yet, and the fix was deferred. `—`, which the rows that predate the column get, says only that no deviation is recorded in this format; it never says the code was checked. A deviation recorded the old way — for example as an edge case — does not show in the column: convert it when later work touches that rule and you confirm that it is a deferred defect.
- **`behavior.md`, the Purpose note.** The old note says the file records what the system does right now. The file now holds two things side by side: a rule's scenarios state the rule, and the deviation records next to them state what the code does. Keeping the old note keeps a claim the file no longer makes.

How the column and the deviation records are written, how closeout removes them, and who carries a renamed or moved doc getting no migration: [When a confirmed rule and the code disagree](confirmed-rule-vs-code.en.md).

### What the marker does not cover

Each of these was considered and deliberately left open, because closing it would cost every run — or every adopter — more than the failure it prevents. You carry them; where it applies, each says when it would be looked at again.

- **A doc created without the marker line.** Nothing makes an AI copy the line when it creates a doc from a template; the line says why it is there, which makes losing it less likely, not impossible. Such a doc falls back to "no marker" — possibly in a new project right after its first feature. Closing this for sure would take an instruction in every flow that creates a doc, read on every run. *Looked at again if* the line turns out to be dropped often in practice.
- **A marker deleted or damaged later** falls back to "no marker" or "unreadable". Doctor says so, and never treats such a doc as current.
- **A marker quoted as an example, or an old one commented out**: doctor does not decide whether such a line is the live marker, so it reports the doc as unreadable — one more thing to handle, in exchange for never reporting a doc it cannot read as passing.
- ⚠ **A valid but wrong number** — for example a template head copied onto an older doc — reads as the current shape, and doctor stays silent. This one cannot be detected: nothing in the doc tells a right number from a wrong one.
- **Changes outside the shape.** A shape is the `##` / `###` headings and their order, table header rows, frontmatter fields, notes in `>` blocks (tables in them included) and HTML comments — most of what a template tells the AI about filling it in is in its comments, and so are the definitions of a lightweight spec's no-BR families. Fixed label text, the rows of a vocabulary table (such as `rules.md`'s Status Legend), `####` and below, `#` comments in frontmatter, and other prose do not change a template's number, so doctor never reports them. *Looked at again if* such a change turns out to matter to a real project.
- **Same number, no report — including a section an AI deleted by mistake**, not only one you removed on purpose. That is the price of "same number means your decision".
- **Unmarked docs at paths the flows do not use** — renamed or moved ones — are not listed as missing a marker; doctor says nothing about them. Within the part of `dflow/specs/` doctor checks (above), a doc that carries a marker is judged by it wherever it sits.
- **Shape added, number not changed**: doctor reports the doc again on the next run. Change the number when you are done.
- **On Dflow's side**, a released shape number is protected by a checksum in Dflow's own test suite; a change that rewrites both a shape and its checksum is caught only by review.
- **The marker records which template shape a doc was compared against — not that its content is right.**

## Extra steps for `0.15.0`

> ⚠ **This section applies only to `0.15.0`** (the release containing P-082 /
> P-083). If you are on 0.14.0, the router wording described below does not exist
> yet — skip it (`dflow --version` confirms).

`0.15.0` replaces the wording that decides **when Dflow engages at all**. The
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
