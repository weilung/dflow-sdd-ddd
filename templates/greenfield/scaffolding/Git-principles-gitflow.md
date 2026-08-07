<!-- Seeded by Dflow. -->

# Git Principles — Git Flow edition

> Created: {YYYY-MM-DD}
> Scope: project Git conventions. This project adopts **Git Flow** as
> its branching strategy.
> Audience: engineers + AI assistants performing Git operations.

Dflow itself is branching-strategy-neutral — it only requires the
feature-branch-per-feature convention (see the Dflow skill's
`references/git-integration.md`). This file records the Git Flow-
specific conventions chosen by this project.

If your project adopts a different branching strategy (single `main`,
trunk-based, GitHub Flow), use `Git-principles-trunk.md` instead.

---

## 1. Branch Structure

| Branch | Naming | Cut from | Merges to |
|--------|--------|----------|-----------|
| `main` / `master` | `main` | — | release / hotfix only |
| `develop` | `develop` | — | integration branch for features |
| feature | `feature/{SPEC-ID}-{slug}` | `develop` | `develop` |
| bugfix | `bugfix/{BUG-ID}-{slug}` | `develop` | `develop` |
| release | `release/{version}` | `develop` | `main` + `develop` |
| hotfix | `hotfix/{version}-hotfix{n}` | `main` | `main` + `develop` |

The `feature/{SPEC-ID}-{slug}` pattern is a **Dflow requirement** (not
a Git Flow requirement). It ties each feature branch to its
corresponding `dflow/specs/features/active/{SPEC-ID}-{slug}/` directory.

A **`bugfix/{BUG-ID}-{slug}`** branch is the same shape as a feature branch and
follows the same topology — cut from the same base, pushed the same way,
integrated the same way, and **closed out the same way**. It is used when a
defect owns its own host rather than being picked up by a feature already in
flight. Its host is a **minimal (zero-phase) host**, so it carries no
phase-spec: the SPEC-ID lives in the directory name while the branch name
carries the BUG-NUMBER, and the host `_index.md` `branch:` field is
authoritative for both. Closeout is not optional because the branch prefix
differs — `/dflow:finish-feature` runs and the directory is archived to
`completed/` before the branch merges, exactly as for `feature/`.

### Feature Branch Workflow

```bash
# 1. Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/{SPEC-ID}-{slug}

# 2. Stay in sync with develop during development
git fetch origin
git rebase origin/develop

# 3. Commit as you go (see § 2 below)
git add .
git commit -m "[{SPEC-ID}] {short description}"

# 4. Push
git push -u origin feature/{SPEC-ID}-{slug}
```

### Release Workflow

```bash
# 1. Cut release branch
git checkout develop
git pull origin develop
git checkout -b release/{version}

# 2. Version bump / final adjustments (e.g. update AssemblyInfo,
#    appsettings version, db migration baseline)
git add .
git commit -m "release {version}"

# 3. Merge to main with --no-ff
git checkout main
git pull origin main
git merge --no-ff release/{version} -m "Release {version}"

# 4. Tag
git tag -a {version} -m "{version summary}"

# 5. Back-merge into develop
git checkout develop
git merge --no-ff release/{version} -m "Merge release/{version} back to develop"

# 6. Push + cleanup
git push origin main develop --tags
git branch -d release/{version}
```

### Hotfix Workflow

```bash
# 1. Cut hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/{version}-hotfix{n}

# 2. Fix + commit
git add .
git commit -m "hotfix{n}: {fix description}"

# 3. Merge to main + tag
git checkout main
git merge --no-ff hotfix/{version}-hotfix{n}
git tag -a {version}-hotfix{n} -m "{fix description}"

# 4. Back-merge to develop
git checkout develop
git merge --no-ff hotfix/{version}-hotfix{n}

# 5. Push + cleanup
git push origin main develop --tags
git branch -d hotfix/{version}-hotfix{n}
```

**Hotfix spec requirement (team convention)**: Hotfixes often skip the
upfront SDD cycle for speed. This project commits to documenting the fix
within **24 hours** after it lands. Run `/dflow:modify-existing` in
**post-hoc mode** (`references/modify-existing-flow.md` Step 1.8): it opens a
minimal host of its own for the fix, records the implementation checkpoint as
`reconciled ({merged-hotfix-hash})`, and reconciles rather than re-running work
that is already on the mainline.
What gets written is whatever the cascade's tier calls for — a **T2** lands a
lightweight spec (root cause + fix + a `dflow/specs/architecture/tech-debt.md` entry
if the bug reveals a systemic issue); a **T3** lands one `_index.md` Lightweight
Changes row and no spec file. Step 1.8 admits **T2 / T3 only**: a **T1**
post-hoc keeps the normal phase-bearing route and documents the merged work
there.
This is a **human-to-human commitment** — Dflow / AI cannot track the
24-hour clock; the team enforces it in retros.

---

## 2. Commit Message Format

Commits must tie back to a SPEC-ID:

```
[{SPEC-ID}] {short description}

{optional detailed body}
```

### Type prefix (recommended)

When applicable, prefix with a type (conventional commits-style):

| Type | Meaning |
|------|---------|
| feat | new feature |
| fix | bug fix |
| refactor | internal refactor (no behavior change) |
| docs | documentation only |
| style | formatting only |
| test | tests only |
| chore | build / tooling |

Example: `[SPEC-20260424-002] feat: introduce ExpenseReport Aggregate with submission invariants`

---

## 3. Gate Checks

Before making key Git operations:

### Before `git commit`

- [ ] If the change corresponds to a phase-spec, that phase-spec's
      `Implementation Tasks` section items are checked (or remaining items have
      justification in the spec's notes section)
- [ ] `_index.md` status reflects the current work (Phase Specs row
      updated, `Resume Pointer` refreshed if the commit reaches a meaningful
      checkpoint). A **minimal (zero-phase) host** has no Phase Specs row to
      update — its record is the Lightweight Changes row, and that row must
      already be written **before** this commit, not after it. Refresh the
      Resume Pointer as usual.
- [ ] Clean Architecture layer rules hold (Domain has no external
      package deps, no business logic leaked into handlers /
      controllers)

### Before merging a feature branch to `develop`

- [ ] `/dflow:finish-feature` has run (or the equivalent Step 8.4
      manual archival is complete)
- [ ] `_index.md` status = `completed`, feature directory moved to
      `dflow/specs/features/completed/` via `git mv`
- [ ] BC layer synced: `dflow/specs/domain/{context}/rules.md`,
      `behavior.md`, `events.md`, and (if cross-context)
      `context-map.md` reflect the feature's net changes
- [ ] `dflow/specs/domain/glossary.md` updated with any new terms
- [ ] `dflow/specs/architecture/tech-debt.md` updated with any debt discovered
- [ ] Domain project has zero external package dependencies
- [ ] No ORM / serialization attributes on Domain entities
- [ ] Domain unit tests pass (invariants + value object equality)

> **Minimal (zero-phase) host.** The items about this host's own record —
> `/dflow:finish-feature` having run, `_index.md` status `completed`, and the
> archival move — apply **unchanged**: they are what stops a host merging with
> its record still open. Every item naming a **Domain or bounded-context
> artifact** applies only to what this change **actually touched**: a **no-BC**
> host has no context to sync or document, and a **T3** does no Domain work at
> all, so for those they read N/A. **Bounded-context-scoped only** —
> `glossary.md` and the tech-debt file belong to no bounded context, stay in a
> no-BC host's sweep, and are **not** N/A for it. **Code invariants are not
> artifacts** — the items here that state a rule about the **source** rather
> than name a document to update are **never N/A**: they hold for any change
> that touches code at all, and a host wrongly claiming to be no-BC is exactly
> what they catch. Record the N/A; do not create a context, a Domain document,
> or a BR row to tick a box.

---

## 4. Integration Commit Message Conventions

`/dflow:finish-feature` emits a **Git-strategy-neutral Integration
Summary** (see `references/finish-feature-flow.md` in the Dflow skill).
This section specifies how to turn that Summary into the actual merge
commit message under Git Flow.

Git Flow typically uses `--no-ff` merges (keeps the branch history
visible). The recommended merge commit format is:

```
Merge feature/{SPEC-ID}-{slug} into develop

{Feature Goal block, copied from Integration Summary}

Change Scope:
- BC: {context-name}
- Aggregate(s) touched: {Aggregate names}
- Phase Count: {N}
- Lightweight Changes: {n_t2} T2 + {n_t3} T3

Related BR-IDs:
- ADDED: BR-NN, BR-NN
- MODIFIED: BR-NN
- REMOVED: (none)

Domain Events introduced / modified: {Event names, or "(none)"}

Related SPEC-IDs: {SPEC-ID}{, follow-up SPEC-IDs if any}
```

**Zero-phase (minimal host) form.** A minimal host has no phases and may have
no bounded context, so its Change Scope block carries the values that are
actually true rather than padded ones:

```
Change Scope:
- BC: none                          # or the real context, when the change has one
- Aggregate(s) touched: none
- Phase Count: 0
- Lightweight Changes: 1 T2 + 0 T3  # at least one row, always

Related BR-IDs: {empty, or the per-family no-BR marker this change carries}

Domain Events introduced / modified: (none)
```

`none` and `0` are the honest values here, not placeholders waiting to be
filled. **`Related BR-IDs` is the exception — never force it to `none`.**
It reports what this change's own record carries, not what was synced, so it
takes the same values a BC-bearing host would: empty, or the per-family no-BR
marker when the T2 carries one. Writing `none` there erases the marker the
zero-phase shape requires (`references/finish-feature-flow.md` Step 5 states
this directly). A minimal host that genuinely touches a bounded context
reports that context and its real BR delta exactly as a phase-bearing feature
would — the zero is the **phase count**, not the significance.

### Concrete example

```bash
git checkout develop
git pull origin develop
git merge --no-ff feature/SPEC-20260421-001-submit-expense-report \
  -m "Merge feature/SPEC-20260421-001-submit-expense-report into develop" \
  -m "Feature Goal: 實作 ExpenseReport 提交流程，含狀態機與事件發佈。" \
  -m "Change Scope: BC Expense; Aggregate ExpenseReport; Phase Count 2; Lightweight Changes 0 T2" \
  -m "Related BR-IDs: ADDED BR-12; MODIFIED BR-05" \
  -m "Domain Events: ExpenseReportSubmitted" \
  -m "Related SPEC-IDs: SPEC-20260421-001"
git push origin develop
```

The `-m` flags stack as separate paragraphs in the commit body.
Alternatively, write a single `-m` with the entire body or open the
editor with `git merge --no-ff feature/...` and paste the Integration
Summary directly.

### Why `--no-ff` is recommended here

Git Flow's value proposition is preserving branch history. `--no-ff`
makes the merge commit an explicit node on `develop`, which:
- Keeps the feature branch visible in `git log --graph`
- Lets `git log --first-parent develop` summarise features as single
  commits
- Gives reviewers a single commit to reference for the whole feature

If your project prefers squash merge under Git Flow (unusual but valid),
use the trunk-edition template (`Git-principles-trunk.md`) for the
commit format; the branch model stays Git Flow.

---

## 5. Tags & Release Notes

### Tag naming

```bash
git tag -a v{major}.{minor}.{patch} -m "{release summary}"
# e.g. git tag -a v1.2.3 -m "Expense report submission + event handlers"
```

### `CHANGELOG.md`

Detailed version history lives in `CHANGELOG.md` at the repo root. One
section per release tag; link back to the SPEC-IDs included in that
release.

Example entry:

```markdown
## [1.2.3] — {YYYY-MM-DD}

### Added
- {SPEC-20260421-001}: ExpenseReport submission flow with Domain Events

### Changed
- {SPEC-20260415-003}: ApprovalPolicy Aggregate invariant tightened

### Fixed
- {BUG-042}: Fix Money rounding in multi-currency totals
```

---

## 6. AI Collaboration Rules (Project Policy)

Three categories:

### Must-confirm operations (AI asks before running)

| Operation | Why |
|-----------|-----|
| `git commit` | Stage needs human review |
| `git push` | Publishing to shared remote |
| `git merge` (onto develop / main / release) | Shared-branch impact |
| Any `git rebase` that rewrites shared history | Force-push risk |

### Forbidden operations

| Operation | Reason |
|-----------|--------|
| `git push -f` to `main` / `develop` | Overwrites other people's work |
| `git reset --hard` to a remote branch | Irreversible |
| `git commit --amend` on a pushed commit | Rewrites public history |
| Deleting `main` / `develop` | Protected branches |

### Allowed without asking

| Operation |
|-----------|
| `git status` / `git diff` / `git log` / `git show` |
| `git fetch` (no merge) |
| `git stash` (local-only) |
| `git branch` (listing only) |

### AI commit authorship

How AI-made commits are marked is chosen once at `dflow init` and recorded in
`dflow/specs/shared/_conventions.md` § AI Commit Policy:

- `none` — AI commits carry no extra marker.
- `co-authored-by` — a `Co-Authored-By: dflow-ai <noreply@dflow.local>` trailer
  (teams may customize the name / email).
- `prefix` — an `[ai-assisted]` commit-subject prefix.

This recorded setting is authoritative and the runtime does not re-ask. The AI
offers commits at lifecycle checkpoints (see `references/git-integration.md`
§ Commit Checkpoints, Branch Gate & AI Commits) using your Git identity, and you
can always decline. If your team also wants vendor attribution, appending the
assistant's documented line (e.g. `Co-Authored-By: Claude
<noreply@anthropic.com>`) is an independent, optional convention on top.

---

## 7. CI / CD

{Fill in this project's CI/CD pipeline shape: trigger (e.g. push to
develop, tag), stages (build → test → deploy), environments
(dev / staging / prod). Reference the pipeline config file if one
exists, e.g. `.github/workflows/ci.yml` or `azure-pipelines.yml`.}

### Suggested CI gates for Clean Architecture

- Verify Domain project has zero (or allow-listed) external package deps
- Run Domain unit tests + Application tests on every PR
- Run Integration tests on `develop` and `release/*` branches
- Verify EF migrations build cleanly

---

## Related Documents

- `references/git-integration.md` in the Dflow skill — canonical
  source for feature-branch-per-feature, `git mv` mandate, Gate Checks
- [System overview](_overview.md)
- [Spec conventions](_conventions.md)
- `CHANGELOG.md` at repo root
