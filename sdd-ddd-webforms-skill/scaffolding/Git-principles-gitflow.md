<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

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
| release | `release/{version}` | `develop` | `main` + `develop` |
| hotfix | `hotfix/{version}-hotfix{n}` | `main` | `main` + `develop` |

The `feature/{SPEC-ID}-{slug}` pattern is a **Dflow requirement** (not
a Git Flow requirement). It ties each feature branch to its
corresponding `dflow/specs/features/active/{SPEC-ID}-{slug}/` directory.

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

# 2. Version bump / final adjustments
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
upfront SDD cycle for speed. This project commits to writing a
lightweight spec within **24 hours** after the hotfix lands, documenting
root cause + fix + (if applicable) a tech-debt entry in
`dflow/specs/migration/tech-debt.md` if the bug reveals a systemic issue.
This is a **human-to-human commitment** — Dflow / AI cannot track the
24-hour clock; the team enforces it in retros.

---

## 2. Commit Message Format

Commits must tie back to a SPEC-ID:

```
[{SPEC-ID}] {short description}

{optional detailed body}

Co-Authored-By: Claude <noreply@anthropic.com>   ← suggested, not mandatory
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

Example: `[EXP-001] feat: add JPY currency support to Money VO`

---

## 3. Gate Checks

See `Git-principles-gitflow.md` § 1 for the branch naming. Additionally,
before making key Git operations:

### Before `git commit`

- [ ] If the change corresponds to a phase-spec, that phase-spec's
      `Implementation Tasks` section items are checked (or remaining items have
      justification in the spec's notes section)
- [ ] `_index.md` status reflects the current work (Phase Specs row
      updated, `Resume Pointer` refreshed if the commit reaches a meaningful
      checkpoint)

### Before merging a feature branch to `develop`

- [ ] `/dflow:finish-feature` has run (or the equivalent Step 8.4
      manual archival is complete)
- [ ] `_index.md` status = `completed`, feature directory moved to
      `dflow/specs/features/completed/` via `git mv`
- [ ] BC layer synced: `dflow/specs/domain/{context}/rules.md` and
      `behavior.md` reflect the feature's net BR changes
- [ ] `dflow/specs/domain/glossary.md` updated with any new terms
- [ ] `dflow/specs/migration/tech-debt.md` updated with any debt discovered
- [ ] Domain layer (`src/Domain/`) has no `System.Web` references

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
- Phase Count: {N}
- Lightweight Changes: {n_t2} T2 + {n_t3} T3

Related BR-IDs:
- ADDED: BR-NN, BR-NN
- MODIFIED: BR-NN
- REMOVED: (none)

Related SPEC-IDs: {SPEC-ID}{, follow-up SPEC-IDs if any}
```

### Concrete example

```bash
git checkout develop
git pull origin develop
git merge --no-ff feature/SPEC-20260421-001-jpy-support \
  -m "Merge feature/SPEC-20260421-001-jpy-support into develop" \
  -m "Feature Goal: 支援 JPY 幣別，涵蓋報銷與匯率換算" \
  -m "Change Scope: BC Expense; Phase Count 2; Lightweight Changes 1 T2" \
  -m "Related BR-IDs: ADDED BR-07, BR-08; MODIFIED BR-03" \
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
# e.g. git tag -a v1.2.3 -m "Expense report export + JPY support"
```

### `CHANGELOG.md`

Detailed version history lives in `CHANGELOG.md` at the repo root. One
section per release tag; link back to the SPEC-IDs included in that
release.

Example entry:

```markdown
## [1.2.3] — {YYYY-MM-DD}

### Added
- {SPEC-20260421-001}: JPY currency support in Money value object

### Changed
- {SPEC-20260415-003}: Tightened expense report validation

### Fixed
- {BUG-042}: Rounding inconsistency in multi-currency totals
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

### AI commit authorship (suggested, not enforced)

When an AI assists in producing a commit, appending a `Co-Authored-By`
line is **suggested** but not mandatory. The canonical form for
Claude is:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

For other AI assistants, use the vendor-documented author line (or omit
it). This is a project-level transparency convention, not a Dflow
requirement.

---

## 7. CI / CD

{Fill in this project's CI/CD pipeline shape: trigger (e.g. push to
develop, tag), stages (build → test → deploy), environments
(dev / staging / prod). Reference the pipeline config file if one
exists, e.g. `.github/workflows/ci.yml` or `azure-pipelines.yml`.}

---

## Related Documents

- `references/git-integration.md` in the Dflow skill — canonical
  source for feature-branch-per-feature, `git mv` mandate, Gate Checks
- [System overview](_overview.md)
- [Spec conventions](_conventions.md)
- `CHANGELOG.md` at repo root
