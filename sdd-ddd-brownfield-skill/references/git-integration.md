# Git Integration with SDD/DDD

This reference defines the minimal Git coupling Dflow requires for SDD, and
what checks should happen at key branch transitions. Dflow is intentionally
agnostic about which Git *branching strategy* your project adopts (Git Flow,
GitHub Flow, trunk-based, single-`main`, etc.) — it only prescribes the
feature-branch-per-feature convention that SDD traceability depends on.

> Dflow does not pick `gitflow` vs `trunk` for you, but it now requires you to
> record one at `dflow init` so the runtime branch gate and finish-stage merge
> guidance can adapt. The selected policy's `Git-principles-{gitflow|trunk}.md`
> is seeded under `dflow/specs/shared/`.

## Branch-to-Workflow Mapping

Dflow only requires that every SDD feature / bug-fix lives on its own branch
that links back to a spec. The *base branch* that feature branches are cut
from (e.g. `main`, `develop`, `trunk`) is a project-level decision that Dflow
does not mandate.

```
main (or your project's base branch)
  │
  ├─ feature/{SPEC-ID}-{slug}       ← Full SDD workflow
  │   Gate: spec must exist BEFORE first commit
  │
  └─ bugfix/{BUG-ID}-{slug}         ← Lightweight SDD workflow
      Gate: at minimum a lightweight spec
```

> If your project adopts Git Flow / GitHub Flow / trunk-based, the choice of
> base branch (and whether you use `develop`, `release/*`, or a single `main`)
> is up to the project. Dflow does not decide this.

## Branch Naming Convention

```
feature/{SPEC-ID}-{slug}
  Examples:
    feature/EXP-001-jpy-currency-support
    feature/HR-003-leave-approval-workflow
    feature/SHARED-002-audit-logging

bugfix/{BUG-ID}-{slug}
  Examples:
    bugfix/BUG-042-rounding-inconsistency
    bugfix/BUG-051-exchange-rate-cache
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
feature/SPEC-20260421-002-jpy-currency-support       (English discussion)
feature/SPEC-20260423-003-訂單折扣-匯率擴充             (Chinese, hyphenated)
bugfix/BUG-051-rounding-fix                          (English)
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

## Commit Checkpoints, Branch Gate & AI Commits

Dflow actively helps keep the Git trace aligned with the workflow — the AI
reminds, can do the work, and leaves policy to the team.

### Branch gate

Before implementation starts (and before the first commit), the AI checks
whether the current branch is the feature / bugfix branch this work belongs to.
Both Git policies (`gitflow` / `trunk`, per `dflow/specs/shared/_conventions.md`
§ Git Policy) use a feature branch, so:

- **Already on the matching `feature/{SPEC-ID}-{slug}` (or
  `bugfix/{BUG-ID}-{slug}`) branch** — e.g. continuing an active feature with
  `new-phase`, `modify-existing`, or `bug-fix` — the gate is satisfied; nothing
  is created or switched.
- **Not on this work's feature / bugfix branch** (you are on the base branch the
  project cuts features from — `main` / `develop` / `trunk`, or whatever your
  policy uses — or on an unrelated branch) — the AI offers to create and switch
  to the correct branch, switch to an existing matching one, or override and
  stay (recorded in the feature `_index.md` Checkpoint Log; three consecutive
  overrides → the AI suggests re-running `dflow init`, never changing the
  setting on its own).

Dflow does not need to identify your base branch to evaluate the gate — it only
checks whether you are on the right feature branch. The base branch matters only
when a new branch is actually created, and which base to cut from is your
project's decision (GitFlow → `develop`, Trunk / GitHub Flow → `main`).

### Commit checkpoints

At lifecycle milestones the AI offers a commit checkpoint, folded into the
existing Step Gate prompt (it does not add a separate question):

```
✓ {milestone} complete
   Commit here?
   [Y] Yes — the AI commits with your Git identity (marker per _conventions.md § AI Commit Policy)
   [N] No — skip this checkpoint
```

Tier sets how many checkpoints a change has: T1 three (spec / implementation /
closeout), T2 two (spec+implementation merged / closeout), T3 a single commit.
Whether you choose Y or N, the AI records one row in the feature `_index.md`
Checkpoint Log. A commit hash is written only after the commit succeeds; a hook
rejection or failed commit is recorded as `failed` (never a fake hash). After
several consecutive skips in a project the AI mentions you can turn checkpoints
off in config — it does not turn them off for you.

### AI commits

The AI may commit at these checkpoints using your Git identity; you can always
decline. How AI commits are marked is the `## AI Commit Policy` setting in
`_conventions.md` (`none` / `co-authored-by` / `prefix`), chosen once at init.
This is a deliberate reversal of Dflow's earlier "the AI never commits" stance:
the AI helps at natural break points, while merge / push / PR still follow the
team's policy and your explicit go-ahead.

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

### feature/ branch — Before Creating

AI should verify:
- [ ] Feature directory exists at `dflow/specs/features/active/{SPEC-ID}-{slug}/`
      with `_index.md` and at least one phase-spec inside
- [ ] `_index.md` has status: `in-progress`
- [ ] Bounded Context is identified
- [ ] At least one Given/When/Then scenario is defined in the first phase-spec
- [ ] Domain concepts are identified (even if not yet in models.md)

If any are missing, guide the developer through creating them BEFORE the branch.

```
"Before we create the branch, let's set up the spec.
I see this touches the Expense context. Let me help you draft the
spec — it should only take a few minutes and it'll keep us focused
during implementation."
```

### feature/ branch — Before Merging (Pre-PR / Pre-Integration)

AI should verify:
- [ ] `_index.md` status updated to `completed`
- [ ] All `phase-spec-*.md` in the feature directory have `status: completed`
- [ ] `_index.md` Current BR Snapshot has been synced to BC layer
      (`rules.md` / `behavior.md`) — typically by `/dflow:finish-feature`
- [ ] Whole feature directory ready to `git mv` to `dflow/specs/features/completed/`
      (or already moved if `/dflow:finish-feature` ran)
- [ ] All new business logic is in `src/Domain/` (not delivery/entrypoint code — presentation/UI layer, controllers, handlers, jobs, message consumers, data pipelines, or stored procedures)
- [ ] New terms added to `glossary.md`
- [ ] `rules.md` and `models.md` updated if applicable
- [ ] Tech debt recorded for any shortcuts taken
- [ ] Domain layer code has no delivery-framework references

### bugfix/ branch — Before Creating

AI should verify:
- [ ] Lightweight spec exists or is created during this session
- [ ] Root cause is documented
- [ ] Fix approach is noted

### bugfix/ branch — Before Merging (Pre-PR / Pre-Integration)

- [ ] Spec has the fix documented
- [ ] Tech debt recorded if the underlying issue is broader (record in
      `dflow/specs/migration/tech-debt.md` if the bug reveals a systemic issue)
- [ ] If business logic was touched, evaluate Domain extraction

> The exact merge strategy (merge commit, squash, rebase, fast-forward)
> follows the team's selected Git policy. See the seeded
> `Git-principles-{gitflow|trunk}.md` under `dflow/specs/shared/` for that
> policy's integration commit conventions.

## Commit Message Convention

Tie commits to specs:

```
[SPEC-ID] Short description

Examples:
[EXP-001] Add JPY currency support to Money value object
[EXP-001] Extract exchange rate logic to Domain service
[BUG-042] Fix rounding inconsistency, extract to Money.Round()
```

## Daily Development Flow

```
1. Developer: "I'm starting work on [feature/bug]"
   AI: Check for spec → Guide through spec creation if missing
       → Suggest branch name based on spec ID

2. Developer creates branch
   AI: Confirm branch name matches convention
       → Remind: "Business logic goes in src/Domain/"

3. During development
   AI: Answer questions referencing dflow/specs/domain/ knowledge
       → Flag if business logic is going into delivery/entrypoint code
       → Suggest Domain layer patterns when appropriate
       → Help maintain thin delivery/entrypoint code

4. Before PR/merge
   AI: Run through merge checklist
       → Help update specs, glossary, tech-debt
       → Suggest moving completed spec to completed/

5. After merge
   AI: Confirm all artifacts are updated
       → Suggest next items from backlog/ if relevant
```

## Integration with CI/CD (Future Enhancement)

These checks could eventually be automated in CI:
- Verify no delivery-framework references in `src/Domain/` directory
- Verify spec file exists for any branch with feature/ or bugfix/ prefix
- Verify glossary.md and rules.md were updated when Domain/ files change
- Lint commit messages for spec ID format

For now, the AI handles these checks conversationally during development.

<!-- R8b verified: no Chinese structural terms in scope; per F-17 Path A. -->
