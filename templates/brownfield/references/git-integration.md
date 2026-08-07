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

Dflow only requires that SDD work is traceable from the branch it lands on. A
feature, and a defect that owns its own branch, each get a branch that links
back to what was recorded. Work picked up by a feature that is still in
progress stays on that host's branch — the host `_index.md` `branch:` field is
authoritative — and a T3 change is traced by its `_index.md` row, not by a spec
file of its own. The *base branch* that feature branches are cut
from (e.g. `main`, `develop`, `trunk`) is a project-level decision that Dflow
does not mandate.

```
main (or your project's base branch)
  │
  ├─ feature/{SPEC-ID}-{slug}       ← Full SDD workflow
  │   Gate: spec must exist BEFORE first commit
  │
  └─ bugfix/{BUG-ID}-{slug}         ← a defect that owns its own branch
      (a defect with no feature to host it opens a minimal zero-phase host
       of its own — see references/modify-existing-flow.md Step 1.7)
      Gate: whatever the cascade's tier calls for (T2: at minimum a
      lightweight spec; T3: the host _index.md row only; T1: escalate —
      it belongs on a feature/ branch)
```

> If your project adopts Git Flow / GitHub Flow / trunk-based, the choice of
> base branch (and whether you use `develop`, `release/*`, or a single `main`)
> is up to the project. Dflow does not decide this.

## Branch Naming Convention

```
feature/{SPEC-ID}-{slug}
  Examples:
    feature/SPEC-20260424-001-jpy-currency-support
    feature/SPEC-20260430-001-leave-approval-workflow
    feature/SPEC-20260502-002-audit-logging

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
across branch / dir / phase-spec is automatic. A **minimal (zero-phase)
host** has no phase-spec, so its slug is shared by the branch and the
directory only — the absent third name is the host's shape, not drift.

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
- **A defect that owns its own branch uses a `bugfix/` branch** following the
  same pattern — including a standalone defect whose own minimal host is what
  owns it, and whose branch therefore carries a BUG-NUMBER rather than that
  host's SPEC-ID. A defect picked up by a feature that is still in progress is
  hosted work instead: it stays on that host's branch. Either way the host
  `_index.md` `branch:` field is authoritative — every spec inside that host,
  and every branch gate applied to it, takes its value.
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
  stay (three consecutive overrides → the AI suggests re-running `dflow init`,
  never changing the setting on its own).

  **How "override and stay" is recorded, so closeout can honour it.** Write one
  row in the feature `_index.md` Checkpoint Log:

  | Timestamp | Checkpoint | Result |
  |---|---|---|
  | {YYYY-MM-DD HH:MM} | `branch-override` | `override ({branch-you-stayed-on})` |

  The Result **names the branch you stayed on** — not the value of `branch:`,
  which stays exactly as the host opened it. That name is what makes the record
  usable, and it is exactly what closeout reads: **its branch check passes when
  *any* `branch-override` row on this host names the branch `HEAD` is on** — not
  only the most recent one, because a host may override onto different branches
  in different phases and closeout fires no branch gate of its own, so it never
  writes a newer row. A record that does not say *where* you stayed excuses
  nothing.
  ⚠ **This row is a record, not a lifecycle checkpoint.** It is not a commit and
  it does not count toward the tier's checkpoint count.
  ⚠ **Where it can appear at all: only on a phase-bearing host.**
  `references/modify-existing-flow.md` withholds this override from every
  **minimal host** (Step 1.6's follow-up variant, Step 1.7 standalone, Step 1.8
  post-hoc), because those hosts assert branch equality against a `branch:` they
  cut by change class. So `references/finish-feature-flow.md`'s closeout branch
  check reads this row and honours it, while its minimal-host checkpoint count
  is never looking at one — that count says so at the site rather than carrying
  an exclusion for a row that cannot reach it.

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
"T3 = a single commit" means a single **implementation** commit — its hash is
only knowable afterwards, so the `_index.md` inline row and checkpoint row are
swept up by the host's **next** commit (more work, or closeout). If the host has
no next commit scheduled, one ledger-only tracking commit that references the T3
hash is allowed. It is bookkeeping, not a lifecycle milestone: it adds no
Checkpoint Log row of its own (unlike closeout, which is a checkpoint and does get
a row).
**Minimal host (zero-phase) exception — there, tier does not set the count.**
On a minimal host (`references/modify-existing-flow.md` Step 1.7 standalone, or
its Step 1.6 follow-up minimal variant) there is no later host commit for a row
to ride, so the count is **two for every tier** — implementation, or
`spec-baseline` for a baseline capture, then closeout — and a T3's `_index.md`
row is written into checkpoint 1 itself instead of sweeping into a later commit.
Everything above about "T3 = a single commit" describes a **hosted** T3, the
case where a later host commit exists.
Whether you choose Y or N, the AI records one row in the feature `_index.md`
Checkpoint Log — every checkpoint is accounted for (`committed` / `skipped` /
`failed`), even when no commit happens. A commit hash is written only after the
commit succeeds; a hook rejection or failed commit is recorded as `failed`
(never a fake hash).
**One further Result value — `reconciled ({merged-hotfix-hash})`.** It records
that this checkpoint documents a change that was **already merged** before any
ceremony ran, and it is written only on a post-hoc hotfix host's implementation
row (`references/modify-existing-flow.md` Step 1.8). The hash in the parentheses
belongs to the **merged hotfix**, not to this host's own documentation commit —
that one goes in the Lightweight Changes row's `Commit` cell, and the two have
different provenance and must never be swapped. On every other host the three
values above are the whole vocabulary.
**Exception — the closeout row**: the closeout commit
cannot contain its own hash, so the closeout row is written before the commit
as `closeout | committed` with **no hash** (see
`references/finish-feature-flow.md` Step 4); trace that commit via
`git log -1 -- dflow/specs/features/completed/{SPEC-ID}-{slug}` or the optional
`Dflow-Checkpoint` trailer below. After several consecutive skips in a project
the AI mentions you can turn checkpoints off in config — it does not turn them
off for you.

**Optional machine-greppable trailer.** Teams that want cross-flow checkpoint
accounting can append a commit trailer at checkpoint commits:

```
Dflow-Checkpoint: {SPEC-ID} {spec|impl|closeout}
```

The `_index.md` Checkpoint Log **remains the source of truth**; the trailer is
a cheap derived mirror (`git log --grep 'Dflow-Checkpoint: {SPEC-ID}'`). Use
role names, not (k/N) counts — the checkpoint total can change mid-feature
(tier escalation, follow-ups), and a role gap ("impl exists but no closeout for
this SPEC-ID") is detectable without predicting N, even across flows.

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

This is the **phase-bearing** (T1) list. A **minimal (zero-phase) host** cuts a
`feature/{SPEC-ID}-{slug}` branch too and takes the short list under it: it has
no phase-spec *by definition*, so every item that reads one is not merely unmet
but unmeetable, and demanding them would block the change the branch exists for.

AI should verify:
- [ ] Feature directory exists at `dflow/specs/features/active/{SPEC-ID}-{slug}/`
      with `_index.md` and at least one phase-spec inside
- [ ] `_index.md` has status: `in-progress`
- [ ] Bounded Context is identified
- [ ] At least one Given/When/Then scenario is defined in the first phase-spec
- [ ] Domain concepts are identified (even if not yet in models.md)

**Minimal (zero-phase) host — this list instead**
(any route in `references/modify-existing-flow.md` that opens a zero-phase host
— Step 1.7 standalone, Step 1.6's follow-up variant, Step 1.8's post-hoc
hotfix, or one added later; a baseline capture uses the same shape):
- [ ] Feature directory exists at `dflow/specs/features/active/{SPEC-ID}-{slug}/`
      with a minimal `_index.md` — all seven sections, Phase Specs table
      **empty**, and no `phase-spec-*` file
- [ ] `_index.md` has status: `in-progress`, and its `branch:` equals the branch
      being cut — that field is authoritative for everything in this host
- [ ] The tier's artifact is ready to be written into the first commit: a
      lightweight-spec for a **T2**, a Lightweight Changes row for a **T3**, a
      `Tier = baseline` row for a baseline capture — in every case with the
      paths it declares named. For a **T2 / T3** those are the implementation
      paths; a **baseline capture** is observation-only and declares the
      **BC-layer documents it wrote** instead — that is its counterpart
      (`references/modify-existing-flow.md` Step 1.7). Do not ask a capture for
      implementation paths: `references/finish-feature-flow.md` Step 1 blocks a
      baseline commit that carries implementation source at all
- [ ] Bounded Context is identified **only if this change has one**; a no-BC
      host records `none` and must not acquire a context to pass this gate.
      **A baseline capture is never no-BC** — it sets `BC:` to the context it
      captured, because capturing that context is the whole point of the host

If any are missing, guide the developer through creating them BEFORE the branch.
On the minimal-host list that governs the `_index.md` items; the tier's artifact
only has to be *decided and ready to write*, because Step 1.7 records it after
the branch is cut, not before.

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

> **On a minimal (zero-phase) host**, split this list by what each item reads.
> Items about **this host's own record** — `_index.md` status, archival
> readiness, and the phase-spec check, which passes vacuously on an empty
> table — apply **unchanged**: they are what stops a host merging with its
> record still open. Every item that names a **Domain or bounded-context
> artifact**, the BR-Snapshot sync included, applies only to what this change
> **actually touched**: a **no-BC** host has no bounded context to sync or
> document, a **T3** does no Domain work at all, and a **baseline capture** has
> already written the BC layer directly rather than syncing to it — so for
> those they read N/A. **Bounded-context-scoped only** — `glossary.md` and
> `migration/tech-debt.md` belong to no bounded context, stay in a no-BC host's
> sweep, and are a baseline capture's own capture destinations, so they are
> **not** N/A for either. **Code invariants are not artifacts** — the items
> here that state a rule about the **source** rather than name a document to
> update are **never N/A**: they hold for any change that touches code at all,
> and a host wrongly claiming to be no-BC is exactly what they catch. Record
> the N/A — do not invent a context, a Domain document, or a BR row to tick
> one.

### bugfix/ branch — Before Creating

> **A `bugfix/` branch is always a minimal (zero-phase) host**, so the
> minimal-host list above applies here **in full** — the `_index.md` shape, the
> authoritative `branch:` field, and the artifact's declaration of the paths it
> touches, which is what closeout blocks on. Every route that cuts one opens the
> host through `references/modify-existing-flow.md` **Step 1.7's mechanics** —
> its own numbered **step 4**, "Branch gate — by change class". The known routes
> are Step 1.7 directly, Step 1.6's minimal follow-up variant, and Step 1.8's
> post-hoc hotfix; the latter two delegate to that same step (steps 2–4), and a
> route added later reaches it the same way.
> Not the top-level `## Step 4`, which cuts no branch. A **T1**
> escalates to `feature/`, a defect hosted under a phase-bearing feature never
> gets a branch of its own, and a baseline capture is not a functional bug so it
> cuts `feature/`. This matters because a functional bug walks **this** gate and
> never the `feature/` one. The items below are what `bugfix/` adds on top.

AI should verify:
- [ ] **The tier's artifact** exists or is created during this session — a
      **lightweight spec** for a T2; for a **T3**, the host `_index.md`
      Lightweight Changes row and *no* spec file, exactly as the branch map
      above says. A T3 spec file does not exist in Dflow, so asking for one
      blocks the change instead of documenting it. A **T1** does not belong on
      a `bugfix/` branch — escalate it to `feature/`.
- [ ] Root cause is documented — a T2's `## Root Cause`, or the evidence
      section its no-BR family substitutes for it; for a **T3** the row
      Description is the whole record and there is no separate root-cause
      artifact
- [ ] Fix approach is noted

### bugfix/ branch — Before Merging (Pre-PR / Pre-Integration)

- [ ] `_index.md` status: `completed`, and the whole feature directory ready to
      `git mv` to `dflow/specs/features/completed/` (or already moved if
      `/dflow:finish-feature` ran). A `bugfix/` host closes out exactly like a
      `feature/` one; an un-closed-out host must not merge.
- [ ] **The tier's artifact** has the fix documented — a **T2**'s lightweight
      spec, or for a **T3** the host `_index.md` Lightweight Changes row, which
      is its whole record. Do not ask a T3 for a spec file here either: the
      Before-Creating item above says why, and this gate is the last place that
      mistake can still block the merge.
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
[SPEC-20260424-001] Add JPY currency support to Money value object
[SPEC-20260424-001] Extract exchange rate logic to Domain service
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
- Verify a spec file exists for any branch with feature/ or bugfix/ prefix — except a host whose entire record is inline in its `_index.md` and therefore has no spec file by design (a T3-only host or a baseline-only capture today, and any later shape with that same property); check for the row instead
- Verify glossary.md and rules.md were updated when Domain/ files change
- Lint commit messages for spec ID format

For now, the AI handles these checks conversationally during development.

<!-- R8b verified: no Chinese structural terms in scope; per F-17 Path A. -->
