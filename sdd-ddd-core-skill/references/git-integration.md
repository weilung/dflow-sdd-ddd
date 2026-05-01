# Git Integration with SDD/DDD — ASP.NET Core

Same minimal Git coupling as the WebForms version. Key difference: gate
checks validate Clean Architecture layer rules instead of WebForms-specific
checks. Dflow remains agnostic about the project's Git *branching strategy*
(Git Flow, GitHub Flow, trunk-based, etc.) — it only prescribes the
feature-branch-per-feature convention that SDD traceability depends on.

> If your project adopts Git Flow specifically, see the optional
> `scaffolding/Git-principles-gitflow.md` template (provided by PROPOSAL-010)
> for Git-Flow-specific conventions.

> **File history note**: This file was renamed from
> `references/git-flow-integration.md` in commit `bf5bb85` (R7 Wave 1,
> PROPOSAL-011). `git mv` was used, but the same commit also rewrote the
> content more aggressively than the WebForms version (18% similarity),
> which falls below git's default rename-detection threshold (`-M50`). To
> trace the rename history use `git log --follow -M10 <this file>`. See
> CHANGELOG "R7 Implement Review F-02 後記" for details and the
> lesson-learned on splitting large rewrites into separate commits.

## Branch-to-Workflow Mapping

Dflow only requires that every SDD feature / bug-fix lives on its own branch
that links back to a spec. The *base branch* that feature branches are cut
from (e.g. `main`, `develop`, `trunk`) is a project-level decision that Dflow
does not mandate.

```
main (or your project's base branch)
  │
  ├─ feature/{SPEC-ID}-{slug}       ← Full SDD + DDD workflow
  │   Gate: spec + Aggregate design before first commit
  │
  └─ bugfix/{BUG-ID}-{slug}         ← Lightweight SDD workflow
      Gate: lightweight spec with layer identification
```

> If your project adopts Git Flow / GitHub Flow / trunk-based, the choice of
> base branch (and whether you use `develop`, `release/*`, or a single `main`)
> is up to the project. Dflow does not decide this.

## Branch Naming Convention

```
feature/{SPEC-ID}-{slug}
bugfix/{BUG-ID}-{slug}
```

Examples:

```
feature/EXP-001-expense-submission-aggregate
feature/HR-003-leave-approval-workflow
bugfix/BUG-042-money-rounding
```

The SPEC-ID / BUG-ID prefix links the branch to its spec document. This is
the traceability chain:

```
Git Branch → Spec Document → Domain Concepts → Code Implementation → Tests
```

### Slug Language

The branch slug follows the language the developer / AI discuss the
feature in. **Both Chinese and English slugs are valid**; Dflow does not
force translation in either direction. The same slug is reused for the
feature directory name and the first phase-spec filename, so consistency
across branch / dir / phase-spec is automatic.

Examples:

```
feature/SPEC-20260421-001-報表調整                     (Chinese discussion)
feature/SPEC-20260421-002-submit-expense-report      (English discussion)
feature/SPEC-20260423-003-訂單折扣-匯率擴充             (Chinese, hyphenated)
bugfix/BUG-051-money-rounding                        (English)
```

Empirical note: an Obts production team has run Dflow with Chinese
branch / directory / PR titles in 2026-Q1–Q2 without encountering
encoding issues on common Git hosts (GitHub, Azure DevOps), CI runners,
or PR review bots. Other Git platforms may still need spot-checking;
when in doubt, run a smoke test on the project's CI pipeline with one
representative Chinese-slug branch before adopting it widely.

Slug-shape guidance (regardless of language):
- Keep it short (2–4 words / 2–6 中文字 plus separators)
- Avoid characters that break filesystems on contributors' platforms
  (forward slash, backslash, colon, asterisk, question mark, double
  quote, angle brackets, pipe)
- Avoid leading dots, trailing spaces
- Lowercase ASCII / 繁體中文 are both fine; mixed-case is OK but be
  consistent within a project

## Feature Branch per Feature (Required)

This is the one non-negotiable Git coupling Dflow enforces:

- **Every SDD feature must have its own feature branch.** Branch name must
  match its SPEC-ID so that `git log`, PR titles, and spec documents can be
  traced back to one another.
- **Every bug-fix (SDD-tracked) must have its own bugfix branch** following
  the same pattern.
- Commits that span multiple specs (accidentally or deliberately) are
  discouraged; if you notice work on a new spec emerging mid-branch, stop
  and create a new branch off the correct base.

This requirement is independent of the branching strategy — whether you
branch off `develop`, `main`, or something else, the feature-per-branch
convention stays.

## Directory Moves Must Use `git mv`

When you rename or move a directory or file that is tracked in Dflow
(feature directories, spec files, domain knowledge files, reference
files), **always use `git mv` instead of a plain `mv` + `git add`**.

### Why this is non-negotiable in Dflow

Dflow is intentionally tightly coupled to Git for the feature-branch /
feature-directory pairing (one feature = one branch = one directory).
This coupling means feature lifecycle events trigger directory moves,
and rename history is what makes the spec auditable across time.

A plain `mv` followed by `git add` shows up as `delete + add` in git's
diff. That breaks:
- `git log --follow {path}` (won't trace history across the move)
- `git blame` on lines that crossed the rename boundary
- PR diff quality (reviewers see two unrelated big-blob changes
  instead of one rename + small content diff)
- `/dflow:verify` and other tools that walk feature history

This is a known weakness of OpenSpec's directory-rename pattern; Dflow
deliberately avoids it by mandating `git mv`.

### Where `git mv` is required

All of the following situations require `git mv`:

```bash
# 1. /dflow:finish-feature: archive an entire feature directory
git mv dflow/specs/features/active/{SPEC-ID}-{slug} \
       dflow/specs/features/completed/{SPEC-ID}-{slug}

# 2. Slug correction (rare — done right after Step 3.5 if the developer
#    realises the agreed slug needs a tweak)
git mv dflow/specs/features/active/{SPEC-ID}-{old-slug} \
       dflow/specs/features/active/{SPEC-ID}-{new-slug}

# 3. Phase-spec rename inside a feature directory
#    (e.g. fixing a wrong date in the filename)
git mv dflow/specs/features/active/{SPEC-ID}-{slug}/phase-spec-2026-04-23-foo.md \
       dflow/specs/features/active/{SPEC-ID}-{slug}/phase-spec-2026-04-24-foo.md

# 4. Lightweight-spec rename inside a feature directory
git mv dflow/specs/features/active/{SPEC-ID}-{slug}/lightweight-2026-04-15-old.md \
       dflow/specs/features/active/{SPEC-ID}-{slug}/lightweight-2026-04-15-new.md

# 5. Template-level renames (this proposal itself: feature-spec.md → phase-spec.md)
git mv sdd-ddd-core-skill/templates/feature-spec.md \
       sdd-ddd-core-skill/templates/phase-spec.md

# 6. Reference file renames (PROPOSAL-011 example)
git mv sdd-ddd-core-skill/references/git-flow-integration.md \
       sdd-ddd-core-skill/references/git-integration.md
```

### Commit-message hint for renames

When the rename is the primary action (not a rename + many edits),
prefer a commit message that calls it out:

```
[SPEC-ID] git mv {SPEC-ID}-{slug}: active/ → completed/
```

If the rename is bundled with content edits (e.g. archival commit also
updates `rules.md`), one commit is fine — git's rename detection still
holds via similarity index.

### What NOT to do

```bash
# ❌ Wrong: produces delete + add, loses rename detection
mv dflow/specs/features/active/{SPEC-ID}-{slug} dflow/specs/features/completed/
git add -A
```

```bash
# ❌ Also wrong: deleting the source then later adding the destination
#    in a separate commit prevents git rename detection across commits.
git rm -r dflow/specs/features/active/{SPEC-ID}-{slug}
# ... commit ...
# ... later, add the destination: rename trail is now broken
```

### Verifying a rename took

After `git mv`, run `git status` — a successful rename shows:

```
Changes to be committed:
  renamed:    dflow/specs/features/active/{SPEC-ID}-{slug}/_index.md ->
              dflow/specs/features/completed/{SPEC-ID}-{slug}/_index.md
  ...
```

If you see `deleted` + `new file` instead, the rename detection failed
— investigate before committing (most often, the file was edited
heavily enough that git's similarity index dropped below the rename
threshold; consider using `git mv` for the move, then making content
edits in a follow-up commit).

### CI / hook automation (future)

A pre-commit hook can refuse commits where `dflow/specs/features/active/` or
`dflow/specs/features/completed/` show paired `D` + `A` instead of `R` for
the same feature directory. Not part of Dflow today, but compatible
with the rule.

## Gate Checks by Branch Type

### feature/ — Before Creating
- [ ] Feature directory exists at `dflow/specs/features/active/{SPEC-ID}-{slug}/`
      with `_index.md` and at least one phase-spec inside
- [ ] `_index.md` status: `in-progress`
- [ ] Bounded Context identified
- [ ] Aggregate design documented (which Aggregate, what invariants)
- [ ] Domain Events identified
- [ ] At least one Given/When/Then scenario in the first phase-spec

### feature/ — Before Merging (Pre-PR / Pre-Integration)
- [ ] `_index.md` status: completed
- [ ] All `phase-spec-*.md` in the feature directory have `status: completed`
- [ ] `_index.md` Current BR Snapshot has been synced to BC layer
      (`rules.md` / `behavior.md` / `events.md` / `context-map.md`) —
      typically by `/dflow:finish-feature`
- [ ] Whole feature directory ready to `git mv` to `dflow/specs/features/completed/`
      (or already moved if `/dflow:finish-feature` ran)
- [ ] Domain layer: zero external dependencies
- [ ] No business logic outside Domain layer
- [ ] Domain Events documented in events.md
- [ ] Glossary, models, rules updated
- [ ] Domain unit tests pass
- [ ] No ORM/serialization attributes on Domain entities

### bugfix/ — Before Creating
- [ ] Lightweight spec exists or is created during this session
- [ ] Root cause is documented
- [ ] Fix approach is noted (which layer the fix belongs in)

### bugfix/ — Before Merging (Pre-PR / Pre-Integration)
- [ ] Spec has the fix documented
- [ ] Tech debt recorded if the underlying issue is broader (record in
      `dflow/specs/architecture/tech-debt.md` if the bug reveals a systemic issue)
- [ ] Fix is in the correct architectural layer (Domain / Application /
      Infrastructure / Presentation) — no business logic leaked outside
      Domain

> The exact merge strategy (merge commit, squash, rebase, fast-forward)
> is a project-level decision and sits outside Dflow's scope. See your
> project's Git-principles document (e.g. the scaffolding template from
> PROPOSAL-010) for integration commit conventions.

## Commit Message Convention

```
[SPEC-ID] Short description

[EXP-001] Define ExpenseReport Aggregate with submission invariants
[EXP-001] Add CreateExpenseReport command and handler
[EXP-001] Implement EF Core configuration for ExpenseReport
[BUG-042] Fix rounding in Money value object
```

## Daily Development Flow

```
1. Start: Check spec → Create if missing → Design Aggregate → Create branch
2. Implement: Domain first → Application → Infrastructure → Presentation
3. Test: Domain unit tests → Application tests → Integration tests
4. Review: Layer compliance → Spec compliance → Architecture score
5. Before PR/merge: Run through merge checklist → Update docs
6. After merge: Confirm artifacts updated → Move spec to completed/
```

## Integration with CI/CD (Future Enhancement)

These checks could eventually be automated in CI:
- Verify Domain project has zero external NuGet dependencies (beyond allowed list)
- Verify no ORM/serialization attributes on Domain entities
- Verify spec file exists for any branch with feature/ or bugfix/ prefix
- Verify glossary.md / rules.md / events.md updated when Domain/ files change
- Lint commit messages for spec ID format

For now, the AI handles these checks conversationally during development.

<!-- R8b verified: no Chinese structural terms in scope; per F-17 Path A. -->
